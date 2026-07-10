import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { getIo } from "./realtime.js";

const user = (req: Request) => (req as any).user as SessionUser;
const isDMRole = (role: string | null) => role === "dm" || role === "co-dm";
const MAX_DATA_BYTES = 200_000;

// The sheet itself is a JSON blob — the schema lives client-side and will
// evolve fast; the server only cares about ownership and campaign scoping.

function defaultData() {
  return {
    race: "",
    class: "",
    level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    profBonus: 2,
    maxHp: 10,
    hp: 10,
    tempHp: 0,
    ac: 10,
    speed: 30,
    hitDiceType: "d8",
    hitDiceRemaining: 1,
    skillProfs: [],
    saveProfs: [],
    conditions: [],
    exhaustion: 0,
    gold: 0,
    inventory: [],
    spellSlots: Array.from({ length: 9 }, () => ({ max: 0, used: 0 })),
    concentratingOn: "",
    spells: [],
    languages: "",
    proficiencies: "",
    backstory: "",
    notes: "",
  };
}

interface CharacterRow {
  id: number;
  campaign_id: number;
  user_id: number;
  display_name: string;
  name: string;
  data: string;
  updated_at: string;
}

function toPayload(row: CharacterRow) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    ownerId: row.user_id,
    ownerName: row.display_name,
    name: row.name,
    data: JSON.parse(row.data),
    updatedAt: row.updated_at,
  };
}

const getCharacter = (charId: number, campaignId: number): CharacterRow | undefined =>
  db
    .prepare(
      `SELECT c.id, c.campaign_id, c.user_id, u.display_name, c.name, c.data, c.updated_at
       FROM characters c JOIN users u ON u.id = c.user_id
       WHERE c.id = ? AND c.campaign_id = ?`
    )
    .get(charId, campaignId) as CharacterRow | undefined;

export const charactersRouter = Router();
charactersRouter.use(requireAuth);

charactersRouter.get("/:id/characters", (req, res) => {
  const campaignId = Number(req.params.id);
  if (!memberRole(campaignId, user(req).id)) return res.status(404).json({ error: "Campaign not found." });
  const rows = db
    .prepare(
      `SELECT c.id, c.campaign_id, c.user_id, u.display_name, c.name, c.data, c.updated_at
       FROM characters c JOIN users u ON u.id = c.user_id
       WHERE c.campaign_id = ? ORDER BY c.name`
    )
    .all(campaignId) as unknown as CharacterRow[];
  res.json({
    characters: rows.map((r) => {
      const p = toPayload(r);
      // list view: summary only, no full sheet
      const d = p.data;
      return {
        id: p.id,
        name: p.name,
        ownerId: p.ownerId,
        ownerName: p.ownerName,
        summary: `${d.race || ""} ${d.class || ""}`.trim() + (d.level ? ` ${d.level}` : ""),
        hp: d.hp,
        maxHp: d.maxHp,
      };
    }),
  });
});

charactersRouter.post("/:id/characters", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (role === "spectator") return res.status(403).json({ error: "Spectators can't create characters." });
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Your character needs a name." });
  const info = db
    .prepare("INSERT INTO characters (campaign_id, user_id, name, data) VALUES (?, ?, ?, ?)")
    .run(campaignId, user(req).id, name, JSON.stringify(defaultData()));
  res.json({ id: Number(info.lastInsertRowid) });
});

charactersRouter.get("/:id/characters/:charId", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const row = getCharacter(Number(req.params.charId), campaignId);
  if (!row) return res.status(404).json({ error: "Character not found." });
  const canEdit = row.user_id === user(req).id || isDMRole(role);
  res.json({ character: toPayload(row), canEdit });
});

charactersRouter.put("/:id/characters/:charId", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const row = getCharacter(Number(req.params.charId), campaignId);
  if (!row) return res.status(404).json({ error: "Character not found." });
  if (row.user_id !== user(req).id && !isDMRole(role)) {
    return res.status(403).json({ error: "Only the character's player or the DM can edit this sheet." });
  }

  const name = String(req.body?.name ?? row.name).trim() || row.name;
  const data = req.body?.data;
  if (typeof data !== "object" || data === null) {
    return res.status(400).json({ error: "Missing sheet data." });
  }
  const json = JSON.stringify(data);
  if (json.length > MAX_DATA_BYTES) return res.status(400).json({ error: "Sheet is too large." });

  db.prepare("UPDATE characters SET name = ?, data = ?, updated_at = datetime('now') WHERE id = ?").run(
    name,
    json,
    row.id
  );

  getIo()
    .to(`campaign:${campaignId}`)
    .emit("character:update", {
      campaignId,
      updatedBy: user(req).id,
      character: { ...toPayload({ ...row, name, data: json }), updatedAt: new Date().toISOString() },
    });
  res.json({ ok: true });
});

charactersRouter.delete("/:id/characters/:charId", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const row = getCharacter(Number(req.params.charId), campaignId);
  if (!row) return res.status(404).json({ error: "Character not found." });
  if (row.user_id !== user(req).id && !isDMRole(role)) {
    return res.status(403).json({ error: "Only the character's player or the DM can delete this sheet." });
  }
  db.prepare("DELETE FROM characters WHERE id = ?").run(row.id);
  getIo().to(`campaign:${campaignId}`).emit("character:delete", { campaignId, characterId: row.id });
  res.json({ ok: true });
});

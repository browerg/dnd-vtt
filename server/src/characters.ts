import { Router, type Request } from "express";
import multer from "multer";
import { randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { db, uploadsDir } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { getIo } from "./realtime.js";

const user = (req: Request) => (req as any).user as SessionUser;
const isDMRole = (role: string | null) => role === "dm" || role === "co-dm";
const MAX_DATA_BYTES = 200_000;

// Portraits are small images, unlike the 500MB battle maps.
const PORTRAIT_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};
const portraitUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) =>
      cb(null, `portrait-${randomBytes(10).toString("hex")}${PORTRAIT_TYPES[file.mimetype] ?? ".png"}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in PORTRAIT_TYPES),
});

// Inventory item photos: same small-image rules as portraits. The image URL is
// stored inside the sheet JSON (not a column), so old files aren't auto-reaped
// when an item changes — acceptable for a private tool.
const itemImageUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) =>
      cb(null, `item-${randomBytes(10).toString("hex")}${PORTRAIT_TYPES[file.mimetype] ?? ".png"}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in PORTRAIT_TYPES),
});

// The sheet itself is a JSON blob — the schema lives client-side and will
// evolve fast; the server only cares about ownership and campaign scoping.

// New Remnant character: the starting array is 1d8/4d6/1d4 placed by the
// player, so default everything to d6 and let them arrange it on the sheet.
function remnantDefaultData() {
  return {
    system: "remnant",
    age: "",
    gender: "",
    species: "Human",
    hometown: "",
    academy: "Beacon",
    academyYear: "",
    teamName: "",
    teamRole: "",
    teammates: ["", "", ""],
    archetype: "Bladesman",
    mainAttribute: "brawn",
    rank: "Initiate",
    attributes: { brawn: 6, finesse: 6, resolve: 6, wit: 6, aura: 6, grit: 6 },
    trainedSkills: [],
    armor: "none",
    aura: 45,
    auraMax: 45,
    auraColor: "#78e1ff",
    hp: 14,
    maxHp: 14,
    weaponName: "",
    weaponForms: [
      { type: "", range: "Close", damage: 8, special: "" },
      { type: "", range: "Mid", damage: 8, special: "" },
    ],
    activeForm: 0,
    semblance: {
      name: "",
      undiscovered: false,
      type: "Enhancement",
      scope: "Personal",
      intensity: "Minor",
      duration: "Instant",
      limitation: "",
      description: "",
      upgrades: [],
      active: false,
      maintainedRounds: 0,
    },
    dust: {},
    conditions: [],
    lien: 0,
    inventory: [],
    equipment: "",
    bond: "",
    trait: "",
    ideal: "",
    flaw: "",
    fear: "",
    backstory: "",
    notes: "",
  };
}

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
  portrait_path: string;
  updated_at: string;
  is_npc: number;
  player_controllable: number;
}

const portraitUrl = (p: string) => (p ? `/uploads/${path.basename(p)}` : "");

// Who may VIEW a full sheet: its owner, any DM, or a player-controllable NPC
// (shared with the table). Everyone else's sheet stays private.
const canViewCharacter = (row: CharacterRow, userId: number, role: string) =>
  row.user_id === userId || isDMRole(role) || (!!row.is_npc && !!row.player_controllable);

// Who may edit a sheet: its owner, any DM, or — for a player-controllable NPC —
// any non-spectator member.
const canEditCharacter = (row: CharacterRow, userId: number, role: string) =>
  row.user_id === userId ||
  isDMRole(role) ||
  (!!row.is_npc && !!row.player_controllable && role !== "spectator");

function toPayload(row: CharacterRow) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    ownerId: row.user_id,
    ownerName: row.display_name,
    name: row.name,
    data: JSON.parse(row.data),
    portraitUrl: portraitUrl(row.portrait_path),
    updatedAt: row.updated_at,
    isNpc: !!row.is_npc,
    playerControllable: !!row.player_controllable,
  };
}

const CHAR_COLS = `c.id, c.campaign_id, c.user_id, u.display_name, c.name, c.data, c.portrait_path,
       c.updated_at, c.is_npc, c.player_controllable`;

const getCharacter = (charId: number, campaignId: number): CharacterRow | undefined =>
  db
    .prepare(
      `SELECT ${CHAR_COLS}
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
      `SELECT ${CHAR_COLS}
       FROM characters c JOIN users u ON u.id = c.user_id
       WHERE c.campaign_id = ? ORDER BY c.name`
    )
    .all(campaignId) as unknown as CharacterRow[];
  res.json({
    characters: rows.map((r) => {
      const p = toPayload(r);
      // list view: summary only, no full sheet
      const d = p.data;
      const summary =
        d.system === "remnant"
          ? [d.archetype, d.rank].filter(Boolean).join(" · ")
          : `${d.race || ""} ${d.class || ""}`.trim() + (d.level ? ` ${d.level}` : "");
      return {
        id: p.id,
        name: p.name,
        ownerId: p.ownerId,
        ownerName: p.ownerName,
        summary,
        portraitUrl: p.portraitUrl,
        hp: d.hp,
        maxHp: d.maxHp,
        aura: d.system === "remnant" ? d.aura : undefined,
        auraMax: d.system === "remnant" ? d.auraMax : undefined,
        isNpc: p.isNpc,
        playerControllable: p.playerControllable,
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
  // Only the DM stocks NPCs.
  const isNpc = Boolean(req.body?.isNpc) && isDMRole(role);
  const system = (db.prepare("SELECT system FROM campaigns WHERE id = ?").get(campaignId) as any)
    ?.system;
  const data = system === "remnant" ? remnantDefaultData() : defaultData();
  const info = db
    .prepare("INSERT INTO characters (campaign_id, user_id, name, data, is_npc) VALUES (?, ?, ?, ?, ?)")
    .run(campaignId, user(req).id, name, JSON.stringify(data), isNpc ? 1 : 0);
  broadcastCharacter(campaignId, Number(info.lastInsertRowid), user(req).id);
  res.json({ id: Number(info.lastInsertRowid) });
});

charactersRouter.get("/:id/characters/:charId", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const row = getCharacter(Number(req.params.charId), campaignId);
  if (!row) return res.status(404).json({ error: "Character not found." });
  if (!canViewCharacter(row, user(req).id, role)) {
    return res.status(403).json({ error: "This sheet is private to its player and the DM." });
  }
  res.json({ character: toPayload(row), canEdit: canEditCharacter(row, user(req).id, role) });
});

charactersRouter.put("/:id/characters/:charId", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const row = getCharacter(Number(req.params.charId), campaignId);
  if (!row) return res.status(404).json({ error: "Character not found." });
  if (!canEditCharacter(row, user(req).id, role)) {
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

// DM toggles whether players may drive an NPC (view + edit + roll as it).
charactersRouter.post("/:id/characters/:charId/npc-control", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can change NPC control." });
  const row = getCharacter(Number(req.params.charId), campaignId);
  if (!row) return res.status(404).json({ error: "Character not found." });
  if (!row.is_npc) return res.status(400).json({ error: "Only NPCs can be player-controllable." });
  const on = Boolean(req.body?.playerControllable);
  db.prepare("UPDATE characters SET player_controllable = ? WHERE id = ?").run(on ? 1 : 0, row.id);
  broadcastCharacter(campaignId, row.id, user(req).id);
  res.json({ ok: true, playerControllable: on });
});

// Portrait upload/replace — shows on the sheet, the hub roster, and map tokens.
charactersRouter.post("/:id/characters/:charId/portrait", portraitUpload.single("portrait"), async (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const row = getCharacter(Number(req.params.charId), campaignId);
  if (!row) return res.status(404).json({ error: "Character not found." });
  if (row.user_id !== user(req).id && !isDMRole(role)) {
    return res.status(403).json({ error: "Only the character's player or the DM can set the portrait." });
  }
  if (!req.file) return res.status(400).json({ error: "Attach a PNG, JPEG, or WebP image." });
  if (row.portrait_path) await unlink(row.portrait_path).catch(() => {});
  db.prepare("UPDATE characters SET portrait_path = ? WHERE id = ?").run(req.file.path, row.id);
  broadcastCharacter(campaignId, row.id, user(req).id);
  res.json({ portraitUrl: portraitUrl(req.file.path) });
});

charactersRouter.delete("/:id/characters/:charId/portrait", async (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const row = getCharacter(Number(req.params.charId), campaignId);
  if (!row) return res.status(404).json({ error: "Character not found." });
  if (row.user_id !== user(req).id && !isDMRole(role)) {
    return res.status(403).json({ error: "Only the character's player or the DM can remove the portrait." });
  }
  if (row.portrait_path) await unlink(row.portrait_path).catch(() => {});
  db.prepare("UPDATE characters SET portrait_path = '' WHERE id = ?").run(row.id);
  broadcastCharacter(campaignId, row.id, user(req).id);
  res.json({ ok: true });
});

// Inventory item photo upload. Returns a URL the client stores on the item in
// the sheet JSON; owner-or-DM only, same as editing the sheet.
charactersRouter.post(
  "/:id/characters/:charId/item-image",
  itemImageUpload.single("image"),
  (req, res) => {
    const campaignId = Number(req.params.id);
    const role = memberRole(campaignId, user(req).id);
    if (!role) return res.status(404).json({ error: "Campaign not found." });
    const row = getCharacter(Number(req.params.charId), campaignId);
    if (!row) return res.status(404).json({ error: "Character not found." });
    if (row.user_id !== user(req).id && !isDMRole(role)) {
      return res.status(403).json({ error: "Only the character's player or the DM can add item photos." });
    }
    if (!req.file) return res.status(400).json({ error: "Attach a PNG, JPEG, or WebP image." });
    res.json({ url: `/uploads/${path.basename(req.file.path)}` });
  }
);

function broadcastCharacter(campaignId: number, charId: number, updatedBy: number) {
  const fresh = getCharacter(charId, campaignId);
  if (!fresh) return;
  getIo().to(`campaign:${campaignId}`).emit("character:update", {
    campaignId,
    updatedBy,
    character: toPayload(fresh),
  });
}

charactersRouter.delete("/:id/characters/:charId", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const row = getCharacter(Number(req.params.charId), campaignId);
  if (!row) return res.status(404).json({ error: "Character not found." });
  if (row.user_id !== user(req).id && !isDMRole(role)) {
    return res.status(403).json({ error: "Only the character's player or the DM can delete this sheet." });
  }
  if (row.portrait_path) unlink(row.portrait_path).catch(() => {});
  db.prepare("DELETE FROM characters WHERE id = ?").run(row.id);
  getIo().to(`campaign:${campaignId}`).emit("character:delete", { campaignId, characterId: row.id });
  res.json({ ok: true });
});

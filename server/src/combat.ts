import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { performRoll } from "./rolls.js";
import { DiceError } from "./dice.js";
import { getIo } from "./realtime.js";

const user = (req: Request) => (req as any).user as SessionUser;
const isDMRole = (role: string | null) => role === "dm" || role === "co-dm";

export interface Combatant {
  id: number;
  tokenId: number | null;
  name: string;
  initiative: number;
}

export interface CombatState {
  active: boolean;
  round: number;
  turn: number; // index into the sorted combatant list
  combatants: Combatant[];
}

export function combatState(campaignId: number): CombatState {
  const c = db
    .prepare("SELECT combat_round, combat_turn FROM campaigns WHERE id = ?")
    .get(campaignId) as any;
  const combatants = (
    db
      .prepare(
        `SELECT id, token_id, name, initiative FROM combatants
         WHERE campaign_id = ? ORDER BY initiative DESC, id ASC`
      )
      .all(campaignId) as any[]
  ).map((r) => ({ id: r.id, tokenId: r.token_id, name: r.name, initiative: r.initiative }));
  return {
    active: c.combat_round > 0,
    round: c.combat_round,
    turn: c.combat_turn,
    combatants,
  };
}

function broadcast(campaignId: number) {
  getIo().to(`campaign:${campaignId}`).emit("combat:update", {
    campaignId,
    state: combatState(campaignId),
  });
}

function requireDM(req: Request, res: any): number | null {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) {
    res.status(404).json({ error: "Campaign not found." });
    return null;
  }
  if (!isDMRole(role)) {
    res.status(403).json({ error: "Only the DM runs combat." });
    return null;
  }
  return campaignId;
}

export const combatRouter = Router();
combatRouter.use(requireAuth);

combatRouter.get("/:id/combat", (req, res) => {
  const campaignId = Number(req.params.id);
  if (!memberRole(campaignId, user(req).id)) return res.status(404).json({ error: "Campaign not found." });
  res.json({ state: combatState(campaignId) });
});

combatRouter.post("/:id/combat/combatants", (req, res) => {
  const campaignId = requireDM(req, res);
  if (campaignId === null) return;
  const b = req.body ?? {};
  const tokenId = b.tokenId ? Number(b.tokenId) : null;
  let name = String(b.name ?? "").trim();
  let dexMod = 0;

  if (tokenId) {
    const t = db
      .prepare(
        `SELECT t.name, json_extract(c.data, '$.abilities.dex') AS dex
         FROM tokens t
         JOIN maps m ON m.id = t.map_id AND m.campaign_id = ?
         LEFT JOIN characters c ON c.id = t.character_id
         WHERE t.id = ?`
      )
      .get(campaignId, tokenId) as any;
    if (!t) return res.status(404).json({ error: "Token not found." });
    name = name || t.name;
    if (t.dex != null) dexMod = Math.floor((t.dex - 10) / 2);
  }
  if (!name) return res.status(400).json({ error: "The combatant needs a name." });

  let initiative: number;
  if (Number.isFinite(b.initiative)) {
    initiative = b.initiative;
  } else {
    // Roll it for real: shows up in the feed and on the 3D dice.
    const formula = dexMod === 0 ? "1d20" : dexMod > 0 ? `1d20+${dexMod}` : `1d20${dexMod}`;
    try {
      initiative = performRoll(user(req), campaignId, formula, `${name}: Initiative`).total!;
    } catch (e) {
      if (e instanceof DiceError) return res.status(400).json({ error: e.message });
      throw e;
    }
  }

  db.prepare("INSERT INTO combatants (campaign_id, token_id, name, initiative) VALUES (?, ?, ?, ?)").run(
    campaignId,
    tokenId,
    name,
    initiative
  );
  broadcast(campaignId);
  res.json({ state: combatState(campaignId) });
});

combatRouter.put("/:id/combat/combatants/:cid", (req, res) => {
  const campaignId = requireDM(req, res);
  if (campaignId === null) return;
  const initiative = Number(req.body?.initiative);
  if (!Number.isFinite(initiative)) return res.status(400).json({ error: "Initiative must be a number." });
  db.prepare("UPDATE combatants SET initiative = ? WHERE id = ? AND campaign_id = ?").run(
    initiative,
    Number(req.params.cid),
    campaignId
  );
  broadcast(campaignId);
  res.json({ ok: true });
});

combatRouter.delete("/:id/combat/combatants/:cid", (req, res) => {
  const campaignId = requireDM(req, res);
  if (campaignId === null) return;
  db.prepare("DELETE FROM combatants WHERE id = ? AND campaign_id = ?").run(
    Number(req.params.cid),
    campaignId
  );
  broadcast(campaignId);
  res.json({ ok: true });
});

combatRouter.post("/:id/combat/start", (req, res) => {
  const campaignId = requireDM(req, res);
  if (campaignId === null) return;
  const count = (db.prepare("SELECT COUNT(*) AS n FROM combatants WHERE campaign_id = ?").get(campaignId) as any).n;
  if (count === 0) return res.status(400).json({ error: "Add combatants before starting." });
  db.prepare("UPDATE campaigns SET combat_round = 1, combat_turn = 0 WHERE id = ?").run(campaignId);
  broadcast(campaignId);
  res.json({ state: combatState(campaignId) });
});

combatRouter.post("/:id/combat/next", (req, res) => {
  const campaignId = requireDM(req, res);
  if (campaignId === null) return;
  const state = combatState(campaignId);
  if (!state.active) return res.status(400).json({ error: "Combat hasn't started." });
  let turn = state.turn + 1;
  let round = state.round;
  if (turn >= state.combatants.length) {
    turn = 0;
    round += 1;
  }
  db.prepare("UPDATE campaigns SET combat_round = ?, combat_turn = ? WHERE id = ?").run(
    round,
    turn,
    campaignId
  );
  broadcast(campaignId);
  res.json({ state: combatState(campaignId) });
});

combatRouter.post("/:id/combat/end", (req, res) => {
  const campaignId = requireDM(req, res);
  if (campaignId === null) return;
  db.prepare("UPDATE campaigns SET combat_round = 0, combat_turn = 0 WHERE id = ?").run(campaignId);
  db.prepare("DELETE FROM combatants WHERE campaign_id = ?").run(campaignId);
  broadcast(campaignId);
  res.json({ state: combatState(campaignId) });
});

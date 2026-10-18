import type { DatabaseSync } from "node:sqlite";

// Kept apart from combat.ts so it can be tested against an in-memory database.

export interface TokenInitiative { name: string; formula: string; tieBreaker: number }

/**
 * A token's initiative name, default roll and tie-breaker: Dexterity in D&D,
 * the Finesse (or a Grimm's Ferocity) die in Remnant. Null if the token isn't
 * on one of this campaign's maps.
 */
export function tokenInitiative(db: DatabaseSync, campaignId: number, tokenId: number, system: string): TokenInitiative | null {
  const t = db.prepare(
    `SELECT t.name,
            json_extract(c.data, '$.abilities.dex') AS dex,
            json_extract(c.data, '$.attributes.finesse') AS finesse,
            json_extract(mo.data, '$.ferocity') AS ferocity
     FROM tokens t
     JOIN maps m ON m.id = t.map_id AND m.campaign_id = ?
     LEFT JOIN characters c ON c.id = t.character_id
     LEFT JOIN monsters mo ON mo.id = t.monster_id
     WHERE t.id = ?`
  ).get(campaignId, tokenId) as { name: string; dex: number | null; finesse: number | null; ferocity: number | null } | undefined;
  if (!t) return null;
  if (system === "remnant") {
    const die = Number(t.finesse ?? t.ferocity ?? 0);
    return die ? { name: t.name, formula: `2d10+1d${die}`, tieBreaker: die } : { name: t.name, formula: "2d10", tieBreaker: 0 };
  }
  if (t.dex != null) {
    const dexMod = Math.floor((Number(t.dex) - 10) / 2);
    const formula = dexMod === 0 ? "1d20" : dexMod > 0 ? `1d20+${dexMod}` : `1d20${dexMod}`;
    return { name: t.name, formula, tieBreaker: Number(t.dex) || 0 };
  }
  return { name: t.name, formula: "1d20", tieBreaker: 0 };
}

export type OwnInitiativeResult = { ok: true; added: boolean } | { ok: false; status: 400 | 403 | 404; error: string };

/**
 * A player types the initiative they rolled (at the table or in the app) for
 * their own character's token. Adds them to the order, or corrects their
 * number if they are already in it. The GM keeps full control as before.
 */
export function setOwnInitiative(db: DatabaseSync, campaignId: number, userId: number, tokenId: number, initiative: unknown): OwnInitiativeResult {
  const role = (db.prepare("SELECT role FROM campaign_members WHERE campaign_id = ? AND user_id = ?").get(campaignId, userId) as { role: string } | undefined)?.role;
  if (!role) return { ok: false, status: 404, error: "Campaign not found." };
  if (role === "spectator") return { ok: false, status: 403, error: "Spectators can't join initiative." };
  const value = Number(initiative);
  if (!Number.isInteger(value) || value < -99 || value > 999) {
    return { ok: false, status: 400, error: "Enter the whole number you rolled." };
  }
  const owner = db.prepare(
    `SELECT c.user_id AS owner FROM tokens t JOIN maps m ON m.id = t.map_id AND m.campaign_id = ?
     LEFT JOIN characters c ON c.id = t.character_id WHERE t.id = ?`
  ).get(campaignId, tokenId) as { owner: number | null } | undefined;
  if (!owner) return { ok: false, status: 404, error: "Token not found." };
  if (owner.owner !== userId) return { ok: false, status: 403, error: "You can only set initiative for your own character." };

  const existing = db.prepare("SELECT id FROM combatants WHERE campaign_id = ? AND token_id = ?").get(campaignId, tokenId) as { id: number } | undefined;
  if (existing) {
    db.prepare("UPDATE combatants SET initiative = ? WHERE id = ?").run(value, existing.id);
    return { ok: true, added: false };
  }
  const system = (db.prepare("SELECT system FROM campaigns WHERE id = ?").get(campaignId) as { system: string } | undefined)?.system ?? "dnd5e";
  const info = tokenInitiative(db, campaignId, tokenId, system)!;
  db.prepare("INSERT INTO combatants (campaign_id, token_id, name, initiative, initiative_tiebreak) VALUES (?, ?, ?, ?, ?)")
    .run(campaignId, tokenId, info.name, value, info.tieBreaker);
  return { ok: true, added: true };
}

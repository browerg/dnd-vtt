import type { DatabaseSync } from "node:sqlite";

export const RELIC_ID = "relic-first-flame";
export const RELIC_ADDITIONS = ["crit1-first-flame", "border-first-flame", "chat-first-flame"];

// The bundle marker also entitles earlier winners to newly completed pieces.
// No backfill, wallet mutation, or automatic equipment change is necessary.
export function ownsCosmetic(db: DatabaseSync, userId: number, id: string): boolean {
  return !!db.prepare(`SELECT 1 FROM cosmetic_unlocks WHERE user_id = ?
    AND (cosmetic_id = ? OR (? = 1 AND cosmetic_id = ?)) LIMIT 1`)
    .get(userId, id, RELIC_ADDITIONS.includes(id) ? 1 : 0, RELIC_ID);
}

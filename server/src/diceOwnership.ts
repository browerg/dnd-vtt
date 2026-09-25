import type { DatabaseSync } from "node:sqlite";
import { mythicDiceForTheme } from "../../shared/mythicDice.js";

/** Public/custom themes use the auth allowlist; mythic themes always need a grant. */
export function ownsMythicDice(db: DatabaseSync, userId: number, theme: string): boolean {
  const dice = mythicDiceForTheme(theme);
  return !!dice && !!db.prepare("SELECT 1 FROM cosmetic_unlocks WHERE user_id = ? AND cosmetic_id = ?").get(userId, dice.unlockId);
}

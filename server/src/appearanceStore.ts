import type { DatabaseSync } from "node:sqlite";
import { ownsCosmetic } from "./relicOwnership.js";

export const APPEARANCE_IDS = { tokenBorder: "border-first-flame", chatFlair: "chat-first-flame" } as const;
export type AppearanceSlot = keyof typeof APPEARANCE_IDS;

export function createAppearanceStore(db: DatabaseSync) {
  // Critical loadouts constrain their slots to nat20/nat1. Keep appearance
  // choices separate, just as the existing turn-start loadout does.
  db.exec(`CREATE TABLE IF NOT EXISTS appearance_loadout (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slot TEXT NOT NULL CHECK(slot IN ('tokenBorder', 'chatFlair')),
    cosmetic_id TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(user_id, slot)
  )`);
  function equipped(userId: number): Record<AppearanceSlot, string> {
    const result = { tokenBorder: "", chatFlair: "" };
    const rows = db.prepare("SELECT slot, cosmetic_id FROM appearance_loadout WHERE user_id = ?").all(userId);
    for (const row of rows) {
      const slot = row.slot as AppearanceSlot;
      if (Object.hasOwn(APPEARANCE_IDS, slot) && row.cosmetic_id === APPEARANCE_IDS[slot]
        && ownsCosmetic(db, userId, String(row.cosmetic_id))) result[slot] = String(row.cosmetic_id);
    }
    return result;
  }
  return {
    equipped,
    equip(userId: number, slot: AppearanceSlot, cosmeticId: string): boolean {
      if (!Object.hasOwn(APPEARANCE_IDS, slot)) return false;
      if (cosmeticId === "") {
        db.prepare("DELETE FROM appearance_loadout WHERE user_id = ? AND slot = ?").run(userId, slot);
        return true;
      }
      if (cosmeticId !== APPEARANCE_IDS[slot] || !ownsCosmetic(db, userId, cosmeticId)) return false;
      db.prepare(`INSERT INTO appearance_loadout (user_id, slot, cosmetic_id) VALUES (?, ?, ?)
        ON CONFLICT(user_id, slot) DO UPDATE SET cosmetic_id = excluded.cosmetic_id, updated_at = datetime('now')`)
        .run(userId, slot, cosmeticId);
      return true;
    },
  };
}

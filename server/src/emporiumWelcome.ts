import type { DatabaseSync } from "node:sqlite";

export const EMPORIUM_WELCOME_GIFT = 1000;
export function createEmporiumWelcome(db: DatabaseSync, startingBalance: number) {
  db.exec(`CREATE TABLE IF NOT EXISTS emporium_welcome (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    seen_at TEXT
  )`);
  return {
    visit(userId: number) {
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare("INSERT OR IGNORE INTO user_wallets (user_id, balance) VALUES (?, ?)").run(userId, startingBalance);
        const grant = db.prepare("INSERT OR IGNORE INTO emporium_welcome (user_id) VALUES (?)").run(userId);
        if (grant.changes) {
          db.prepare("UPDATE user_wallets SET balance = balance + ? WHERE user_id = ?").run(EMPORIUM_WELCOME_GIFT, userId);
          db.prepare("INSERT INTO vcoin_transactions (user_id, amount, reason, reference) VALUES (?, ?, ?, ?)").run(userId, EMPORIUM_WELCOME_GIFT, "Emporium welcome gift", "emporium-welcome-v1");
        }
        const row = db.prepare("SELECT seen_at FROM emporium_welcome WHERE user_id = ?").get(userId) as { seen_at: string | null };
        db.exec("COMMIT");
        return { needsIntroduction: !row.seen_at, gift: EMPORIUM_WELCOME_GIFT };
      } catch (error) {
        if (db.isTransaction) db.exec("ROLLBACK");
        throw error;
      }
    },
    acknowledge(userId: number) {
      db.prepare("UPDATE emporium_welcome SET seen_at = COALESCE(seen_at, datetime('now')) WHERE user_id = ?").run(userId);
    },
  };
}

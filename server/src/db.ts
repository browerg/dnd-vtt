import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "vtt.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name  TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_by  INTEGER NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS campaign_members (
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('dm','co-dm','player','spectator')),
    joined_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (campaign_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id    INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    channel        TEXT NOT NULL CHECK (channel IN ('ic','ooc','whisper')),
    target_user_id INTEGER REFERENCES users(id),
    speaker        TEXT NOT NULL DEFAULT '',
    body           TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages (campaign_id, id);

  CREATE TABLE IF NOT EXISTS characters (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    name        TEXT NOT NULL,
    data        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters (campaign_id);

  CREATE TABLE IF NOT EXISTS rolls (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    formula     TEXT NOT NULL,
    label       TEXT NOT NULL DEFAULT '',
    mode        TEXT NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal','advantage','disadvantage')),
    visibility  TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private','dm','blind')),
    detail      TEXT NOT NULL,
    total       INTEGER NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_rolls_campaign ON rolls (campaign_id, id);

  CREATE TABLE IF NOT EXISTS invites (
    code        TEXT PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('co-dm','player','spectator')),
    created_by  INTEGER NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Additive migrations for tables that already exist in older databases.
// SQLite has no ADD COLUMN IF NOT EXISTS; a duplicate-column error means done.
for (const ddl of [
  "ALTER TABLE campaigns ADD COLUMN chapter TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE campaigns ADD COLUMN session_number INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE campaigns ADD COLUMN house_rules TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE campaigns ADD COLUMN announcement TEXT NOT NULL DEFAULT ''",
]) {
  try {
    db.exec(ddl);
  } catch (e: any) {
    if (!String(e?.message).includes("duplicate column")) throw e;
  }
}

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
export const uploadsDir = path.join(dataDir, "uploads");
mkdirSync(uploadsDir, { recursive: true });

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

  CREATE TABLE IF NOT EXISTS combatants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    token_id    INTEGER REFERENCES tokens(id) ON DELETE SET NULL,
    name        TEXT NOT NULL,
    initiative  REAL NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_combatants_campaign ON combatants (campaign_id);

  CREATE TABLE IF NOT EXISTS maps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    image_path  TEXT NOT NULL,
    grid_size   INTEGER NOT NULL DEFAULT 70,
    grid_on     INTEGER NOT NULL DEFAULT 1,
    active      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_maps_campaign ON maps (campaign_id);

  CREATE TABLE IF NOT EXISTS tokens (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    map_id       INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    color        TEXT NOT NULL DEFAULT '#c9a24b',
    x            REAL NOT NULL DEFAULT 0,
    y            REAL NOT NULL DEFAULT 0,
    size         INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tokens_map ON tokens (map_id);

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
  "ALTER TABLE campaigns ADD COLUMN combat_round INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE campaigns ADD COLUMN combat_turn INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE maps ADD COLUMN fog_on INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE maps ADD COLUMN fog_data TEXT NOT NULL DEFAULT '[]'",
  "ALTER TABLE maps ADD COLUMN youtube_id TEXT NOT NULL DEFAULT ''",
]) {
  try {
    db.exec(ddl);
  } catch (e: any) {
    if (!String(e?.message).includes("duplicate column")) throw e;
  }
}

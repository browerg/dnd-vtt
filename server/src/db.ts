import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
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

  CREATE TABLE IF NOT EXISTS quests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','failed')),
    hidden      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_quests_campaign ON quests (campaign_id);

  CREATE TABLE IF NOT EXISTS npcs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id  INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    location     TEXT NOT NULL DEFAULT '',
    alive        INTEGER NOT NULL DEFAULT 1,
    hidden       INTEGER NOT NULL DEFAULT 0,
    secret_notes TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_npcs_campaign ON npcs (campaign_id);

  CREATE TABLE IF NOT EXISTS journal_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_journal_campaign ON journal_entries (campaign_id);

  CREATE TABLE IF NOT EXISTS handouts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    file_path   TEXT NOT NULL,
    revealed    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_handouts_campaign ON handouts (campaign_id);

  CREATE TABLE IF NOT EXISTS spells (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    data  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_spells_name ON spells (name COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS monsters (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL DEFAULT 'srd',
    name   TEXT NOT NULL,
    cr     REAL NOT NULL DEFAULT 0,
    data   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_monsters_name ON monsters (name COLLATE NOCASE);

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

  CREATE TABLE IF NOT EXISTS map_objects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    map_id      INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT 'custom',
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    dm_notes    TEXT NOT NULL DEFAULT '',
    loot        TEXT NOT NULL DEFAULT '',
    state       TEXT NOT NULL DEFAULT 'closed',
    hidden      INTEGER NOT NULL DEFAULT 0,
    x           REAL NOT NULL DEFAULT 400,
    y           REAL NOT NULL DEFAULT 300,
    size        REAL NOT NULL DEFAULT 1,
    image_path  TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_map_objects_map ON map_objects (map_id);

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

  CREATE TABLE IF NOT EXISTS session_notes (
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL DEFAULT '',
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (campaign_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS rolls (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    formula     TEXT NOT NULL,
    label       TEXT NOT NULL DEFAULT '',
    mode        TEXT NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal','advantage','disadvantage','edge','setback')),
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

// Older databases created rolls with a mode CHECK that predates edge/setback;
// SQLite can't alter constraints, so rebuild the table once.
const rollsSql =
  ((db.prepare("SELECT sql FROM sqlite_master WHERE name = 'rolls' AND type = 'table'").get() as any)
    ?.sql as string) ?? "";
if (rollsSql && !rollsSql.includes("'edge'")) {
  db.exec(`
    BEGIN;
    CREATE TABLE rolls_migrated (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      formula     TEXT NOT NULL,
      label       TEXT NOT NULL DEFAULT '',
      mode        TEXT NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal','advantage','disadvantage','edge','setback')),
      visibility  TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private','dm','blind')),
      detail      TEXT NOT NULL,
      total       INTEGER NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO rolls_migrated SELECT * FROM rolls;
    DROP TABLE rolls;
    ALTER TABLE rolls_migrated RENAME TO rolls;
    CREATE INDEX IF NOT EXISTS idx_rolls_campaign ON rolls (campaign_id, id);
    COMMIT;
  `);
  console.log("migrated rolls table for edge/setback modes");
}

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
  "ALTER TABLE maps ADD COLUMN draw_data TEXT NOT NULL DEFAULT '[]'",
  "ALTER TABLE maps ADD COLUMN music_path TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE maps ADD COLUMN youtube_audio INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE tokens ADD COLUMN monster_id INTEGER REFERENCES monsters(id) ON DELETE SET NULL",
  "ALTER TABLE tokens ADD COLUMN hp INTEGER",
  "ALTER TABLE tokens ADD COLUMN max_hp INTEGER",
  "ALTER TABLE tokens ADD COLUMN image_path TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE tokens ADD COLUMN image_scale REAL NOT NULL DEFAULT 1",
  "ALTER TABLE tokens ADD COLUMN conditions TEXT NOT NULL DEFAULT '[]'",
  "ALTER TABLE monsters ADD COLUMN campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE",
  // Existing campaigns predate the system setting and were built on 5e.
  "ALTER TABLE campaigns ADD COLUMN system TEXT NOT NULL DEFAULT 'dnd5e'",
  "ALTER TABLE campaigns ADD COLUMN theme TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE characters ADD COLUMN portrait_path TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN dice_theme TEXT NOT NULL DEFAULT ''",
  // NPCs the DM runs; player_controllable lets players drive one too.
  "ALTER TABLE characters ADD COLUMN is_npc INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE characters ADD COLUMN player_controllable INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN avatar_path TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN pronouns TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''",
]) {
  try {
    db.exec(ddl);
  } catch (e: any) {
    if (!String(e?.message).includes("duplicate column")) throw e;
  }
}

// Seed the SRD spell list on first boot (319 spells, CC-BY-4.0 via Open5e).
const spellCount = (db.prepare("SELECT COUNT(*) AS n FROM spells").get() as any).n;
if (spellCount === 0) {
  const srdPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "srd", "srd-spells.json");
  try {
    const raw = readFileSync(srdPath, "utf8").replace(/^﻿/, "");
    const spells = JSON.parse(raw) as any[];
    const insert = db.prepare("INSERT INTO spells (name, level, data) VALUES (?, ?, ?)");
    for (const s of spells) insert.run(s.name, Number(s.level) || 0, JSON.stringify(s));
    console.log(`seeded ${spells.length} SRD spells`);
  } catch (e) {
    console.warn("SRD spell seed skipped:", (e as Error).message);
  }
}

// Seed the SRD monster collection on first boot (322 monsters, CC-BY-4.0 via Open5e).
const monsterCount = (db.prepare("SELECT COUNT(*) AS n FROM monsters").get() as any).n;
if (monsterCount === 0) {
  const srdPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "srd", "srd-monsters.json");
  try {
    const raw = readFileSync(srdPath, "utf8").replace(/^﻿/, "");
    const monsters = JSON.parse(raw) as any[];
    // CRs come as strings and may be fractions ("1/4").
    const parseCr = (v: unknown): number => {
      const s = String(v ?? "0");
      if (s.includes("/")) {
        const [num, den] = s.split("/").map(Number);
        return den ? num / den : 0;
      }
      return Number(s) || 0;
    };
    const insert = db.prepare("INSERT INTO monsters (source, name, cr, data) VALUES ('srd', ?, ?, ?)");
    for (const m of monsters) {
      insert.run(m.name, parseCr(m.challenge_rating), JSON.stringify(m));
    }
    console.log(`seeded ${monsters.length} SRD monsters`);
  } catch (e) {
    console.warn("SRD monster seed skipped:", (e as Error).message);
  }
}

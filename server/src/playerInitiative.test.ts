import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { setOwnInitiative, tokenInitiative } from "./playerInitiative.js";

// Campaign 1 (D&D): user 1 DM, 2 player (owns Pat's token 10), 3 player, 4 spectator.
// Campaign 2 (Remnant): user 2 owns Ruby's token 20.
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE campaigns (id INTEGER PRIMARY KEY, system TEXT);
    CREATE TABLE campaign_members (campaign_id INTEGER, user_id INTEGER, role TEXT);
    CREATE TABLE maps (id INTEGER PRIMARY KEY, campaign_id INTEGER);
    CREATE TABLE characters (id INTEGER PRIMARY KEY, user_id INTEGER, data TEXT);
    CREATE TABLE monsters (id INTEGER PRIMARY KEY, data TEXT);
    CREATE TABLE tokens (id INTEGER PRIMARY KEY, map_id INTEGER, name TEXT, character_id INTEGER, monster_id INTEGER);
    CREATE TABLE combatants (id INTEGER PRIMARY KEY, campaign_id INTEGER, token_id INTEGER, name TEXT, initiative INTEGER, initiative_tiebreak INTEGER);
    INSERT INTO campaigns VALUES (1, 'dnd5e'), (2, 'remnant');
    INSERT INTO campaign_members VALUES (1,1,'dm'),(1,2,'player'),(1,3,'player'),(1,4,'spectator'),(2,2,'player');
    INSERT INTO maps VALUES (100,1),(200,2);
    INSERT INTO characters VALUES (1, 2, '{"abilities":{"dex":14}}'), (2, 2, '{"attributes":{"finesse":8}}');
    INSERT INTO monsters VALUES (1, '{"ferocity":6}');
    INSERT INTO tokens VALUES (10,100,'Pat',1,NULL),(11,100,'Goblin',NULL,NULL),(20,200,'Ruby',2,NULL),(21,200,'Beowolf',NULL,1);
  `);
  return db;
}
const rows = (db: DatabaseSync) => db.prepare("SELECT token_id, name, initiative, initiative_tiebreak FROM combatants ORDER BY id").all() as any[];

test("a player adds their own token with the number they rolled, then can correct it", () => {
  const db = fixture();
  assert.deepEqual(setOwnInitiative(db, 1, 2, 10, 17), { ok: true, added: true });
  assert.deepEqual(rows(db).map(r => ({ ...r })), [{ token_id: 10, name: "Pat", initiative: 17, initiative_tiebreak: 14 }], "DEX breaks D&D ties");
  assert.deepEqual(setOwnInitiative(db, 1, 2, 10, 19), { ok: true, added: false });
  assert.equal(rows(db).length, 1, "no duplicate entry");
  assert.equal(rows(db)[0].initiative, 19);
  assert.deepEqual(setOwnInitiative(db, 2, 2, 20, 23), { ok: true, added: true });
  assert.equal(rows(db)[1].initiative_tiebreak, 8, "the Finesse die breaks Remnant ties");
});

test("players can't set anyone else's initiative, spectators can't join, and numbers must be sane", () => {
  const db = fixture();
  const status = (user: number, token: number, value: unknown, campaign = 1) => { const r = setOwnInitiative(db, campaign, user, token, value); return r.ok ? 200 : r.status; };
  assert.equal(status(3, 10, 12), 403, "another player's character");
  assert.equal(status(2, 11, 12), 403, "an NPC");
  assert.equal(status(4, 10, 12), 403, "spectator");
  assert.equal(status(2, 20, 12, 1), 404, "a token from another campaign");
  assert.equal(status(2, 10, 12.5), 400);
  assert.equal(status(2, 10, "lots"), 400);
  assert.equal(status(2, 10, 5000), 400);
  assert.equal(rows(db).length, 0);
});

test("token initiative info covers characters, Grimm and plain tokens", () => {
  const db = fixture();
  assert.deepEqual(tokenInitiative(db, 1, 10, "dnd5e"), { name: "Pat", formula: "1d20+2", tieBreaker: 14 });
  assert.deepEqual(tokenInitiative(db, 1, 11, "dnd5e"), { name: "Goblin", formula: "1d20", tieBreaker: 0 });
  assert.deepEqual(tokenInitiative(db, 2, 21, "remnant"), { name: "Beowolf", formula: "2d10+1d6", tieBreaker: 6 });
  assert.equal(tokenInitiative(db, 1, 20, "dnd5e"), null);
});

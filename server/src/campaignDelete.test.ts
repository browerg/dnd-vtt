import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { deleteCampaign } from "./campaignDelete.js";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE users (id INTEGER PRIMARY KEY);
    CREATE TABLE campaigns (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE campaign_members (campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE, user_id INTEGER, role TEXT);
    CREATE TABLE maps (id INTEGER PRIMARY KEY, campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE);
    CREATE TABLE tokens (id INTEGER PRIMARY KEY, map_id INTEGER REFERENCES maps(id) ON DELETE CASCADE);
    INSERT INTO users VALUES (1),(2),(3);
    INSERT INTO campaigns VALUES (1, 'Beacon Nights'), (2, 'Other Table');
    INSERT INTO campaign_members VALUES (1,1,'dm'),(1,2,'co-dm'),(1,3,'player'),(2,1,'dm');
    INSERT INTO maps VALUES (10,1),(20,2); INSERT INTO tokens VALUES (100,10),(200,20);`);
  return db;
}
const count = (db: DatabaseSync, sql: string) => (db.prepare(sql).get() as { n: number }).n;

test("only the DM can delete, and only after typing the name exactly", () => {
  const db = fixture();
  const status = (actor: number, name: unknown, id = 1) => { const r = deleteCampaign(db, id, actor, name); return r.ok ? 200 : r.status; };
  assert.equal(status(2, "Beacon Nights"), 403, "co-DM");
  assert.equal(status(3, "Beacon Nights"), 403, "player");
  assert.equal(status(1, "beacon nights"), 400, "case matters");
  assert.equal(status(1, undefined), 400);
  assert.equal(status(1, "Beacon Nights", 99), 404);
  assert.equal(count(db, "SELECT COUNT(*) AS n FROM campaigns"), 2);
});

test("deleting removes everything the campaign owns and nothing else", () => {
  const db = fixture();
  assert.deepEqual(deleteCampaign(db, 1, 1, "  Beacon Nights "), { ok: true });
  assert.equal(count(db, "SELECT COUNT(*) AS n FROM campaigns WHERE id = 1"), 0);
  assert.equal(count(db, "SELECT COUNT(*) AS n FROM campaign_members WHERE campaign_id = 1"), 0);
  assert.equal(count(db, "SELECT COUNT(*) AS n FROM tokens WHERE id = 100"), 0, "cascades through maps to tokens");
  assert.equal(count(db, "SELECT COUNT(*) AS n FROM tokens WHERE id = 200"), 1, "other campaigns untouched");
  assert.equal(count(db, "SELECT COUNT(*) AS n FROM users"), 3, "accounts stay");
});

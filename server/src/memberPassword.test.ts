import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { setMemberPassword } from "./memberPassword.js";

const hash = (password: string) => `hashed:${password}`;

// Campaign 1: user 1 DM, 2 co-DM, 3 player, 4 spectator. User 5 plays only in campaign 2.
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, display_name TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE password_reset_tokens (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE campaign_members (campaign_id INTEGER, user_id INTEGER, role TEXT, PRIMARY KEY (campaign_id, user_id));
    INSERT INTO users VALUES (1,'Dee','old'),(2,'Cody','old'),(3,'Pat','old'),(4,'Spec','old'),(5,'Stranger','old');
    INSERT INTO campaign_members VALUES (1,1,'dm'),(1,2,'co-dm'),(1,3,'player'),(1,4,'spectator'),(2,5,'player'),(2,3,'dm');
    INSERT INTO sessions VALUES ('a',3,'2099-01-01'),('b',3,'2099-01-01'),('c',1,'2099-01-01');
    INSERT INTO password_reset_tokens VALUES (1,3,'t','2099-01-01');
  `);
  return db;
}
const passwordOf = (db: DatabaseSync, id: number) => (db.prepare("SELECT password_hash FROM users WHERE id = ?").get(id) as { password_hash: string }).password_hash;

test("the GM sets a player's password, which signs them out everywhere and voids recovery links", () => {
  const db = fixture();
  assert.deepEqual(setMemberPassword(db, 1, 1, 3, "new-pass-123", hash), { ok: true, displayName: "Pat" });
  assert.equal(passwordOf(db, 3), "hashed:new-pass-123");
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = 3").get() as { n: number }).n, 0);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM password_reset_tokens").get() as { n: number }).n, 0);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = 1").get() as { n: number }).n, 1, "the GM stays signed in");
  assert.equal(setMemberPassword(db, 1, 2, 4, "another-pass", hash).ok, true, "a co-DM can reset a spectator");
});

test("only GMs can reset, only within their campaign, and never another GM or themselves", () => {
  const db = fixture();
  const fail = (campaign: number, actor: number, target: number, password = "long-enough-1") => {
    const result = setMemberPassword(db, campaign, actor, target, password, hash);
    assert.equal(result.ok, false);
    return result.ok ? 0 : result.status;
  };
  assert.equal(fail(1, 3, 4), 403, "a player cannot reset");
  assert.equal(fail(1, 1, 5), 404, "not a member of this campaign");
  assert.equal(fail(1, 2, 1), 403, "co-DM cannot reset the DM");
  assert.equal(fail(1, 2, 2), 400, "nobody resets themselves here");
  assert.equal(fail(2, 3, 1), 404, "a DM elsewhere has no reach into campaign 1 members");
  assert.equal(fail(1, 1, 3, "short"), 400, "minimum length");
  assert.equal(setMemberPassword(db, 1, 1, 2, "co-dm-pass-1", hash).ok, true, "the DM can reset a co-DM");
  assert.equal(passwordOf(db, 1), "old");
  assert.equal(passwordOf(db, 5), "old");
});

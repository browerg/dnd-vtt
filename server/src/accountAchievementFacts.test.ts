import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createAchievementStore } from "./achievementStore.js";
import { readAccountAchievementFacts } from "./accountAchievementFacts.js";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, bio TEXT DEFAULT '', profile_style TEXT DEFAULT 'astral');
    INSERT INTO users (id) VALUES (1), (2);
    CREATE TABLE campaign_members (campaign_id INTEGER, user_id INTEGER, role TEXT);
    CREATE TABLE characters (id INTEGER PRIMARY KEY, campaign_id INTEGER, user_id INTEGER, is_npc INTEGER);
    CREATE TABLE cosmetic_unlocks (user_id INTEGER, cosmetic_id TEXT, PRIMARY KEY(user_id, cosmetic_id));
    CREATE TABLE cosmetic_loadout (user_id INTEGER, cosmetic_id TEXT);
    CREATE TABLE turn_start_loadout (user_id INTEGER, cosmetic_id TEXT);`);
  return { db, store: createAchievementStore(db) };
}

test("existing memberships and owned player characters count with role and account isolation", () => {
  const { db, store } = fixture();
  try {
    db.exec(`INSERT INTO campaign_members VALUES (1,1,'spectator'), (2,2,'dm');
      INSERT INTO characters VALUES (1,1,1,0), (2,2,2,0);`);
    const facts = () => readAccountAchievementFacts(db, 1);
    assert.equal(facts().campaign_member, 0);
    assert.equal(facts().characters_owned, 0);
    db.exec("UPDATE campaign_members SET role='co-dm' WHERE user_id=1");
    assert.equal(facts().campaign_member, 1);
    assert.equal(facts().campaign_dm, 0);
    assert.equal(facts().characters_owned, 1);
    db.exec(`UPDATE campaign_members SET role='dm' WHERE user_id=1;
      INSERT INTO campaign_members VALUES (3,1,'player');
      INSERT INTO characters VALUES (3,1,1,1), (4,3,1,0), (5,3,1,0), (6,99,1,0);`);
    assert.equal(facts().characters_owned, 3);
    assert.deepEqual(store.recordAccountFacts(1, facts()).map((a) => a.id), ["first-campaign", "first-dm", "first-character", "three-characters"]);
    db.exec("DELETE FROM characters WHERE user_id=1; DELETE FROM campaign_members WHERE user_id=1");
    assert.deepEqual(store.recordAccountFacts(1, facts()), []);
    assert.ok(store.list(1).find((a) => a.id === "three-characters")!.unlockedAt);
    assert.equal(store.list(2).filter((a) => a.unlockedAt).length, 0);
  } finally { db.close(); }
});

test("saved bios, palettes and owned non-default loadouts backfill exactly once", () => {
  const { db, store } = fixture();
  try {
    const facts = () => readAccountAchievementFacts(db, 1);
    db.exec(`UPDATE users SET bio='   ' WHERE id=1;
      INSERT INTO cosmetic_loadout VALUES (1,'crit20-golden');
      INSERT INTO cosmetic_unlocks VALUES (1,'crit20-golden'), (2,'crit20-rose');`);
    assert.equal(facts().profile_bio, 0);
    assert.equal(facts().profile_palette, 0);
    assert.equal(facts().cosmetic_equipped, 0);
    db.exec("UPDATE cosmetic_loadout SET cosmetic_id='crit20-rose' WHERE user_id=1");
    assert.equal(facts().cosmetic_equipped, 0);
    db.exec(`INSERT INTO cosmetic_unlocks VALUES (1,'crit20-rose');
      UPDATE users SET bio='My adventure', profile_style='gilded' WHERE id=1;`);
    assert.deepEqual(store.recordAccountFacts(1, facts()).map((a) => a.id), ["profile-bio", "profile-palette", "first-cosmetic"]);
    assert.deepEqual(store.recordAccountFacts(1, facts()), []);
    db.exec("DELETE FROM cosmetic_loadout; INSERT INTO turn_start_loadout VALUES (1,'turn-none'); INSERT INTO cosmetic_unlocks VALUES (1,'turn-none');");
    assert.equal(facts().cosmetic_equipped, 0);
    db.exec("UPDATE turn_start_loadout SET cosmetic_id='turn-rose'; INSERT INTO cosmetic_unlocks VALUES (1,'turn-rose');");
    assert.equal(facts().cosmetic_equipped, 1);
  } finally { db.close(); }
});

test("existing equipped earned badges count and snapshot unlocks roll back atomically", () => {
  const { db, store } = fixture();
  try {
    db.exec(`INSERT INTO achievement_unlocks (user_id, achievement_id) VALUES (1,'first-max');
      INSERT INTO profile_badges VALUES (1,'first-max',0);`);
    const facts = readAccountAchievementFacts(db, 1);
    assert.equal(facts.badge_equipped, 1);
    db.exec("BEGIN"); store.recordAccountFacts(1, facts); db.exec("ROLLBACK");
    assert.equal(store.list(1).find((a) => a.id === "first-badge")!.unlockedAt, null);
    assert.deepEqual(store.recordAccountFacts(1, facts).map((a) => a.id), ["first-badge"]);
    assert.deepEqual(createAchievementStore(db).recordAccountFacts(1, facts), []);
    assert.throws(() => store.recordAccountFacts(2, { ...facts, characters_owned: NaN }));
    assert.equal(store.list(2).filter((a) => a.unlockedAt).length, 0);
  } finally { db.close(); }
});

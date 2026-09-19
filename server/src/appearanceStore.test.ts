import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createAppearanceStore, type AppearanceSlot } from "./appearanceStore.js";
import { ownsCosmetic } from "./relicOwnership.js";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id INTEGER PRIMARY KEY);
    INSERT INTO users VALUES(1),(2);
    CREATE TABLE cosmetic_unlocks(user_id INTEGER, cosmetic_id TEXT, PRIMARY KEY(user_id, cosmetic_id));
    INSERT INTO cosmetic_unlocks VALUES(1,'relic-first-flame');`);
  return { db, store: createAppearanceStore(db) };
}

test("earlier Relic owners get additions without rewriting inventory or equipping anything", () => {
  const { db, store } = fixture();
  try {
    for (const id of ["crit1-first-flame", "border-first-flame", "chat-first-flame"]) assert.ok(ownsCosmetic(db, 1, id));
    assert.equal(ownsCosmetic(db, 2, "border-first-flame"), false);
    assert.equal(ownsCosmetic(db, 1, "crit20-lightning"), false);
    assert.deepEqual(store.equipped(1), { tokenBorder: "", chatFlair: "" });
    assert.equal(db.prepare("SELECT count(*) AS n FROM cosmetic_unlocks").get()!.n, 1);
  } finally { db.close(); }
});

test("appearance selection rejects unowned items and invalid slots; persists independent choices", () => {
  const { db, store } = fixture();
  try {
    assert.equal(store.equip(2, "tokenBorder", "border-first-flame"), false);
    assert.equal(store.equip(1, "chatFlair", "border-first-flame"), false);
    assert.equal(store.equip(1, "nat20" as AppearanceSlot, ""), false);
    assert.equal(store.equip(1, "tokenBorder", "border-first-flame"), true);
    assert.equal(store.equip(1, "chatFlair", "chat-first-flame"), true);
    const restarted = createAppearanceStore(db);
    assert.deepEqual(restarted.equipped(1), { tokenBorder: "border-first-flame", chatFlair: "chat-first-flame" });
    assert.deepEqual(restarted.equipped(2), { tokenBorder: "", chatFlair: "" });
    assert.ok(restarted.equip(1, "tokenBorder", ""));
    assert.deepEqual(restarted.equipped(1), { tokenBorder: "", chatFlair: "chat-first-flame" });
    db.exec("DELETE FROM cosmetic_unlocks");
    assert.equal(restarted.equipped(1).chatFlair, "");
  } finally { db.close(); }
});

test("explicit individual grants work without granting the rest of the bundle", () => {
  const { db, store } = fixture();
  try {
    db.exec("INSERT INTO cosmetic_unlocks VALUES(2,'border-first-flame')");
    assert.ok(store.equip(2, "tokenBorder", "border-first-flame"));
    assert.equal(store.equip(2, "chatFlair", "chat-first-flame"), false);
  } finally { db.close(); }
});

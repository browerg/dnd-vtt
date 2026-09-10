import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { ACHIEVEMENT_REWARDS, createAchievementStore } from "./achievementStore.js";
import type { RollDetail } from "./dice.js";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE users (id INTEGER PRIMARY KEY);
    INSERT INTO users VALUES (1), (2);
    CREATE TABLE cosmetic_unlocks (user_id INTEGER, cosmetic_id TEXT, PRIMARY KEY(user_id, cosmetic_id));`);
  return { db, store: createAchievementStore(db) };
}
function detail(sides: number, results: number[], modifier = 0): RollDetail {
  return { mode: "normal", kept: { groups: [{ count: results.length, sides, results }], modifier, total: results.reduce((a, b) => a + b, modifier) } };
}

test("max/min totals, streak resets, persistent unlocks and account isolation", () => {
  const { db, store } = fixture();
  try {
    const read = (id: string) => store.list(1).find((a) => a.id === id)!;
    store.recordRoll(1, detail(20, [20], -100), "public");
    assert.equal(read("first-max").progress, 1);
    store.recordRoll(1, detail(20, [12]), "public");
    assert.equal(read("double-max").progress, 0);
    store.recordRoll(1, detail(20, [20]), "private");
    assert.equal(read("double-max").unlockedAt, null);
    store.recordRoll(1, detail(20, [20]), "dm");
    assert.ok(read("double-max").unlockedAt);
    for (let i = 0; i < 12; i++) store.recordRoll(1, detail(20, [20]), "public");
    for (let i = 0; i < 12; i++) store.recordRoll(1, detail(20, [1], 50), "public");
    assert.equal(store.list(1).filter((a) => a.unlockedAt).length, 6);
    assert.equal(read("ten-max").progress, 10);
    assert.equal(read("ten-min").progress, 10);
    assert.equal(store.list(2).filter((a) => a.unlockedAt).length, 0);
    assert.equal(createAchievementStore(db).list(1).filter((a) => a.unlockedAt).length, 6);
  } finally { db.close(); }
});

test("whole dice pools count once; modifiers and discarded dice are ignored", () => {
  const { db, store } = fixture();
  try {
    store.recordRoll(1, detail(10, [10, 9]), "public");
    assert.equal(store.list(1)[0].progress, 0);
    const remnant = detail(10, [10, 10]);
    remnant.kept.groups.push({ count: 1, sides: 8, results: [8], droppedResults: [1] });
    remnant.mode = "edge";
    store.recordRoll(1, remnant, "public");
    assert.equal(store.list(1).find((a) => a.id === "ten-max")!.progress, 1);
    const advantage = detail(20, [5]);
    advantage.mode = "disadvantage";
    advantage.dropped = detail(20, [20]).kept;
    store.recordRoll(1, advantage, "public");
    assert.equal(store.list(1).find((a) => a.id === "double-max")!.progress, 0);
    store.recordRoll(1, detail(6, [1, 1]), "public");
    assert.ok(store.list(1).find((a) => a.id === "first-min")!.unlockedAt);
  } finally { db.close(); }
});

test("manual and blind rolls neither leak progress nor break streaks", () => {
  const { db, store } = fixture();
  try {
    store.recordRoll(1, detail(20, [20]), "public");
    store.recordRoll(1, { ...detail(20, [1]), manual: true }, "public");
    store.recordRoll(1, detail(20, [1]), "blind");
    assert.equal(store.list(1).find((a) => a.id === "first-min")!.progress, 0);
    store.recordRoll(1, detail(20, [20]), "public");
    assert.ok(store.list(1).find((a) => a.id === "double-max")!.unlockedAt);
  } finally { db.close(); }
});

test("quest unlocks are idempotent, transactional, and support future cosmetic grants", () => {
  const { db, store } = fixture();
  try {
    db.exec("BEGIN");
    store.recordQuest([1, 2]);
    db.exec("ROLLBACK");
    assert.equal(store.list(1).find((a) => a.id === "first-quest")!.unlockedAt, null);
    store.recordQuest([1, 1, 2]);
    store.recordQuest([1, 2]);
    assert.equal(db.prepare("SELECT count(*) AS n FROM achievement_unlocks").get()!.n, 2);
    ACHIEVEMENT_REWARDS["first-quest"] = "future-test-cosmetic";
    store.list(1);
    store.list(1);
    assert.equal(db.prepare("SELECT count(*) AS n FROM cosmetic_unlocks WHERE user_id = 1").get()!.n, 1);
    assert.equal(db.prepare("SELECT count(*) AS n FROM cosmetic_unlocks WHERE user_id = 2").get()!.n, 0);
  } finally { delete ACHIEVEMENT_REWARDS["first-quest"]; db.close(); }
});

test("profile showcases reject unearned, unknown, duplicate and excess badges without losing selections", () => {
  const { db, store } = fixture();
  try {
    assert.deepEqual(store.showcase(1), []);
    assert.throws(() => store.setShowcase(1, ["first-max"]), /earned/);
    store.recordRoll(1, detail(20, [20]), "public");
    store.recordRoll(1, detail(20, [20]), "public");
    store.recordQuest([1]);
    const ids = ["first-quest", "double-max", "first-max"];
    assert.deepEqual(store.setShowcase(1, ids).map((badge) => badge.id), ids);
    assert.deepEqual(createAchievementStore(db).showcase(1).map((badge) => badge.id), ids);
    for (const bad of [null, "first-max", [1], ["unknown"], ["first-max", "first-max"], [...ids, "first-min"]]) {
      assert.throws(() => store.setShowcase(1, bad));
      assert.deepEqual(store.showcase(1).map((badge) => badge.id), ids);
    }
    assert.throws(() => store.setShowcase(2, ["first-max"]), /earned/);
    assert.deepEqual(store.showcase(2), []);
    assert.ok(store.showcase(1).every((badge) => !Object.hasOwn(badge, "progress") && badge.badgeImage.endsWith(".png")));
    assert.deepEqual(store.setShowcase(1, []), []);
    assert.ok(store.list(1).find((badge) => badge.id === "first-max")!.unlockedAt);
  } finally { db.close(); }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { statSync } from "node:fs";
import { ACHIEVEMENTS, ACHIEVEMENT_REWARDS, createAchievementStore } from "./achievementStore.js";
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

test("badge delivery assets stay within notification and profile download budgets", () => {
  for (const badge of ACHIEVEMENTS) {
    for (const [size, budget] of [[72, 4096], [144, 10240], [384, 40960]]) {
      const asset = new URL(`../../client/public/assets/achievements/${badge.id}-${size}.webp`, import.meta.url);
      assert.ok(statSync(asset).size <= budget, `${badge.id} at ${size}px exceeds its ${budget}-byte budget`);
    }
  }
});

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
    assert.equal(store.list(1).filter((a) => a.unlockedAt).length, 9);
    assert.equal(read("ten-max").progress, 10);
    assert.equal(read("ten-min").progress, 10);
    assert.equal(store.list(2).filter((a) => a.unlockedAt).length, 0);
    assert.equal(createAchievementStore(db).list(1).filter((a) => a.unlockedAt).length, 9);
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
    store.recordQuest([1, 2], 42);
    db.exec("ROLLBACK");
    assert.equal(store.list(1).find((a) => a.id === "first-quest")!.unlockedAt, null);
    store.recordQuest([1, 1, 2], 42);
    store.recordQuest([1, 2], 42);
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
    store.recordQuest([1], 42);
    const ids = ["first-quest", "double-max", "first-max"];
    assert.deepEqual(store.setShowcase(1, ids).showcase.map((badge) => badge.id), ids);
    assert.deepEqual(createAchievementStore(db).showcase(1).map((badge) => badge.id), ids);
    for (const bad of [null, "first-max", [1], ["unknown"], ["first-max", "first-max"], [...ids, "first-min"]]) {
      assert.throws(() => store.setShowcase(1, bad));
      assert.deepEqual(store.showcase(1).map((badge) => badge.id), ids);
    }
    assert.throws(() => store.setShowcase(2, ["first-max"]), /earned/);
    assert.deepEqual(store.showcase(2), []);
    assert.ok(store.showcase(1).every((badge) => !Object.hasOwn(badge, "progress") && badge.badgeImage.endsWith("-384.webp")));
    assert.deepEqual(store.setShowcase(1, []).showcase, []);
    assert.ok(store.list(1).find((badge) => badge.id === "first-max")!.unlockedAt);
  } finally { db.close(); }
});

test("notification payloads contain only newly earned achievements for their owner", () => {
  const { db, store } = fixture();
  try {
    const first = store.recordRoll(1, detail(20, [20]), "private");
    assert.deepEqual(first.map((a) => a.id), ["first-max", "first-roll"]);
    assert.equal(first[0].userId, 1);
    assert.equal(first[0].badgeImage, "/assets/achievements/first-max-384.webp");
    assert.equal(first[0].badgeThumbnail, "/assets/achievements/first-max-72.webp");
    assert.equal(first[0].badgeThumbnail2x, "/assets/achievements/first-max-144.webp");
    assert.deepEqual(store.recordRoll(1, detail(20, [20]), "public").map((a) => a.id), ["double-max"]);
    assert.deepEqual(store.recordRoll(1, detail(20, [20]), "public").map((a) => a.id), ["triple-max"]);
    assert.deepEqual(store.recordRoll(1, detail(20, [1]), "blind"), []);
    assert.deepEqual(store.recordQuest([1, 2], 42).map((a) => [a.userId, a.id]), [[1, "first-quest"], [2, "first-quest"]]);
    assert.deepEqual(store.recordQuest([1, 2], 42), []);
  } finally { db.close(); }
});

test("roll totals count events, preserve exclusions, and unlock at exact thresholds", () => {
  const { db, store } = fixture();
  try {
    for (let n = 0; n < 99; n++) store.recordRoll(1, detail(6, [2, 3, 4]), "public");
    const read = (id: string) => store.list(1).find((a) => a.id === id)!;
    assert.equal(read("hundred-rolls").progress, 99);
    assert.equal(read("hundred-rolls").unlockedAt, null);
    store.recordRoll(1, detail(20, [20]), "blind");
    store.recordRoll(1, { ...detail(20, [20]), manual: true }, "public");
    assert.equal(read("hundred-rolls").progress, 99);
    assert.ok(store.recordRoll(1, detail(6, [2]), "private").some((a) => a.id === "hundred-rolls"));
    for (let n = 100; n < 999; n++) store.recordRoll(1, detail(6, [2]), "public");
    assert.equal(read("thousand-rolls").unlockedAt, null);
    assert.ok(store.recordRoll(1, detail(6, [2]), "public").some((a) => a.id === "thousand-rolls"));
    assert.deepEqual(store.recordRoll(1, detail(6, [2]), "public"), []);
  } finally { db.close(); }
});

test("dramatic reversals require adjacent eligible rolls and triple maximum resets", () => {
  const { db, store } = fixture();
  try {
    const read = (id: string) => store.list(1).find((a) => a.id === id)!;
    for (const face of [20, 12, 1]) store.recordRoll(1, detail(20, [face]), "public");
    assert.equal(read("max-then-min").unlockedAt, null);
    assert.ok(store.recordRoll(1, detail(20, [20]), "public").some((a) => a.id === "min-then-max"));
    assert.ok(store.recordRoll(1, detail(20, [1]), "public").some((a) => a.id === "max-then-min"));
    for (const face of [20, 20, 12, 20, 20]) store.recordRoll(1, detail(20, [face]), "public");
    assert.equal(read("triple-max").unlockedAt, null);
    assert.ok(store.recordRoll(1, detail(20, [20]), "public").some((a) => a.id === "triple-max"));
  } finally { db.close(); }
});

test("quest milestones count distinct completions and roll back with the reward transaction", () => {
  const { db, store } = fixture();
  try {
    for (let id = 1; id <= 4; id++) { store.recordQuest([1, 1], id); store.recordQuest([1], id); }
    const read = (id: string) => store.list(1).find((a) => a.id === id)!;
    assert.equal(read("five-quests").progress, 4);
    db.exec("BEGIN"); store.recordQuest([1], 5); db.exec("ROLLBACK");
    assert.equal(read("five-quests").unlockedAt, null);
    assert.ok(store.recordQuest([1], 5).some((a) => a.id === "five-quests"));
    for (let id = 6; id < 25; id++) store.recordQuest([1], id);
    assert.equal(read("twenty-five-quests").unlockedAt, null);
    assert.ok(store.recordQuest([1], 25).some((a) => a.id === "twenty-five-quests"));
    assert.equal(store.list(2).find((a) => a.id === "five-quests")!.progress, 0);
  } finally { db.close(); }
});

test("paid purchases and full showcases issue one persistent unlock", () => {
  const { db, store } = fixture();
  try {
    db.exec("BEGIN"); store.recordPurchase(1); db.exec("ROLLBACK");
    assert.equal(store.list(1).find((a) => a.id === "first-purchase")!.unlockedAt, null);
    assert.deepEqual(store.recordPurchase(1).map((a) => a.id), ["first-purchase"]);
    assert.deepEqual(store.recordPurchase(1), []);
    store.recordRoll(1, detail(20, [20]), "public");
    assert.deepEqual(store.setShowcase(1, ["first-max", "first-roll"]).unlocks, []);
    assert.deepEqual(store.setShowcase(1, ["first-max", "first-roll", "first-purchase"]).unlocks.map((a) => a.id), ["full-showcase"]);
    assert.deepEqual(store.setShowcase(1, ["first-max", "first-roll", "first-purchase"]).unlocks, []);
    store.setShowcase(1, []);
    assert.ok(store.list(1).find((a) => a.id === "full-showcase")!.unlockedAt);
  } finally { db.close(); }
});

test("upgrading old progress preserves known quest credit without resetting or double migrating", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY); INSERT INTO users VALUES (1);
      CREATE TABLE achievement_progress (user_id INTEGER PRIMARY KEY, maximum INTEGER DEFAULT 0, minimum INTEGER DEFAULT 0, max_streak INTEGER DEFAULT 0, min_streak INTEGER DEFAULT 0, quests INTEGER DEFAULT 0);
      INSERT INTO achievement_progress VALUES (1, 7, 4, 2, 0, 1);`);
    const store = createAchievementStore(db);
    assert.equal(store.list(1).find((a) => a.id === "five-quests")!.progress, 1);
    assert.equal(store.list(1).find((a) => a.id === "hundred-rolls")!.progress, 0);
    store.recordQuest([1], 100);
    assert.equal(createAchievementStore(db).list(1).find((a) => a.id === "five-quests")!.progress, 2);
    assert.equal(store.list(1).find((a) => a.id === "ten-max")!.progress, 7);
  } finally { db.close(); }
});

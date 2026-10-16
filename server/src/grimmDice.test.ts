import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { CACHE_REWARDS, createVividCacheStore } from "./vividCacheStore.js";
import { COSMETICS } from "./shopCatalog.js";
import { ownsMythicDice } from "./diceOwnership.js";
import { mythicDiceForTheme } from "../../shared/mythicDice.js";
import { canPreviewRwbyDice } from "../../shared/rwbyDice.js";
import { GRIMM_DICE, createGrimmTrail } from "../../client/src/grimmDice.js";
import { SPECIAL_DICE } from "../../client/src/specialDice.js";

test("Grimm Awakening is a concealed Mythic won only in Vivid Cache", () => {
  const reward = CACHE_REWARDS.find(r => r.diceTheme === "grimm-awakening")!;
  assert.ok(reward);
  assert.equal(reward.rarity, "mythic");
  assert.deepEqual(reward.unlockIds, ["dice-grimm-awakening"]);
  assert.equal(reward.weight, CACHE_REWARDS.find(r => r.id === "event-horizon")!.weight, "shares the Mythic tier equally");
  assert.equal(mythicDiceForTheme("grimm-awakening")?.rarity, "mythic");
  assert.equal(COSMETICS.some(item => item.id === "dice-grimm-awakening"), false, "never sold in the Emporium");
  assert.equal(canPreviewRwbyDice("grimm-awakening"), false, "appearance stays concealed in Mystery dice");
  assert.ok(SPECIAL_DICE.some(dice => dice.id === "grimm-awakening"));

  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY); INSERT INTO users VALUES(1),(2);
      CREATE TABLE cosmetic_unlocks(user_id INTEGER,cosmetic_id TEXT,PRIMARY KEY(user_id,cosmetic_id));
      CREATE TABLE user_wallets(user_id INTEGER PRIMARY KEY,balance INTEGER);
      CREATE TABLE vcoin_transactions(user_id INTEGER,amount INTEGER,reason TEXT,reference TEXT);`);
    assert.equal(ownsMythicDice(db, 1, "grimm-awakening"), false);
    createVividCacheStore(db, 250, () => reward).open(1, "grimm-test-opening-0001");
    assert.equal(ownsMythicDice(db, 1, "grimm-awakening"), true);
    assert.equal(ownsMythicDice(db, 2, "grimm-awakening"), false);
    assert.equal(ownsMythicDice(db, 1, "event-horizon"), false);
  } finally { db.close(); }
});

test("Grimm Awakening carries its own signature trail", () => {
  assert.equal(GRIMM_DICE.trailId, "grimm");
  assert.equal(GRIMM_DICE.signatureTrail, true);
});

// Records every call; numbers passed to ellipse/arc must never be negative.
function recordingContext() {
  const radii: number[] = [];
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_target, key) {
      if (key === "ellipse") return (_x: number, _y: number, rx: number, ry: number) => radii.push(rx, ry);
      if (key === "arc") return (_x: number, _y: number, r: number) => radii.push(r);
      if (key === "createRadialGradient") return (...args: number[]) => { radii.push(args[2], args[5]); return gradient; };
      return () => {};
    },
    set() { return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, radii };
}

test("the Grimm trail is bounded, expires, and survives a landing timestamped before the frame", () => {
  const trail = createGrimmTrail();
  const die = {};
  for (let i = 0; i < 400; i++) trail.sample(die, { x: i * 30, y: 0 }, i);
  trail.land([{ x: 10, y: 10 }, { x: 40, y: 20 }], 1000);
  const { ctx, radii } = recordingContext();
  // rAF timestamps can trail performance.now(): draw "before" the landing.
  assert.equal(trail.draw(ctx, 990), true);
  assert.ok(radii.every(r => r >= 0), "no negative radii");
  assert.equal(trail.draw(ctx, 5000), false, "everything fades out");
  trail.sample(die, { x: 0, y: 0 }, 6000);
  trail.clear();
  assert.equal(trail.draw(ctx, 6001), false);
});

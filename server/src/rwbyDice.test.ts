import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { RWBY_DICE, canPreviewRwbyDice } from "../../shared/rwbyDice.js";
import { CACHE_REWARDS, createVividCacheStore } from "./vividCacheStore.js";
import { COSMETICS, isCacheExclusive, RARITY_PRICES } from "./shopCatalog.js";
import { ownsMythicDice } from "./diceOwnership.js";

function freshDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY); INSERT INTO users VALUES(1),(2);
    CREATE TABLE cosmetic_unlocks(user_id INTEGER,cosmetic_id TEXT,PRIMARY KEY(user_id,cosmetic_id));
    CREATE TABLE user_wallets(user_id INTEGER PRIMARY KEY,balance INTEGER);
    CREATE TABLE vcoin_transactions(user_id INTEGER,amount INTEGER,reason TEXT,reference TEXT);`);
  return db;
}

test("each RWBY set is a Legendary Cache reward at Legendary odds; previews never grant ownership", () => {
  const legendaryWeight = CACHE_REWARDS.find(r => r.id === "rose")!.weight;
  for (const dice of RWBY_DICE) {
    const reward = CACHE_REWARDS.find(r => r.diceTheme === dice.theme)!;
    assert.equal(reward.rarity, "legendary"); assert.equal(reward.weight, legendaryWeight);
    assert.deepEqual(reward.unlockIds, [dice.unlockId]);
    assert.equal(reward.preview.description, dice.description);
    const db = freshDb();
    try {
      assert.equal(canPreviewRwbyDice(dice.theme), true);
      assert.equal(ownsMythicDice(db,1,dice.theme),false);
      const store=createVividCacheStore(db,250,()=>reward);
      const result=store.open(1,"rwby-test-opening-0001");
      assert.equal(result.balance,0); assert.equal(ownsMythicDice(db,1,dice.theme),true);
      assert.equal(ownsMythicDice(db,2,dice.theme),false);
      for(const other of RWBY_DICE.filter(d=>d.theme!==dice.theme)) assert.equal(ownsMythicDice(db,1,other.theme),false);
    } finally { db.close(); }
  }
  for(const hidden of ["first-flame","event-horizon","chronos-engine","prismatic-echo","unknown"]) assert.equal(canPreviewRwbyDice(hidden),false);
});

test("each RWBY set is sold in the Emporium at the Legendary price and a purchase unlocks only that set", () => {
  for (const dice of RWBY_DICE) {
    const item = COSMETICS.find(entry => entry.id === dice.unlockId)!;
    assert.ok(item, dice.unlockId);
    assert.equal(item.type, "dice"); assert.equal(item.effect, dice.theme);
    assert.equal(item.price, RARITY_PRICES.legendary); assert.equal(item.price, 1000);
    assert.equal(isCacheExclusive(item), false);
    // The purchase route records the catalogue ID; that row is the dice entitlement.
    const db = freshDb();
    try {
      db.prepare("INSERT INTO cosmetic_unlocks (user_id, cosmetic_id) VALUES (?, ?)").run(1, item.id);
      assert.equal(ownsMythicDice(db,1,dice.theme),true);
      for(const other of RWBY_DICE.filter(d=>d.theme!==dice.theme)) assert.equal(ownsMythicDice(db,1,other.theme),false);
    } finally { db.close(); }
  }
});

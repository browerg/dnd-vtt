import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { CACHE_REWARDS, RELIC_UNLOCKS, createVividCacheStore, selectCacheReward } from "./vividCacheStore.js";
import { buildCacheReel, CACHE_WINNER_INDEX } from "../../shared/vividCacheReel.js";

const key = "11111111-1111-4111-8111-111111111111";
const next = "22222222-2222-4222-8222-222222222222";
function fixture(balance = 1000, choose = () => CACHE_REWARDS[0]) {
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE users (id INTEGER PRIMARY KEY);
    INSERT INTO users VALUES (1), (2);
    CREATE TABLE user_wallets (user_id INTEGER PRIMARY KEY, balance INTEGER CHECK(balance >= 0));
    CREATE TABLE cosmetic_unlocks (user_id INTEGER REFERENCES users(id), cosmetic_id TEXT, PRIMARY KEY(user_id, cosmetic_id));
    CREATE TABLE vcoin_transactions (user_id INTEGER, amount INTEGER, reason TEXT, reference TEXT);
  `);
  db.prepare("INSERT INTO user_wallets VALUES (1, ?), (2, ?)").run(balance, balance);
  const store = createVividCacheStore(db, 100, choose);
  return { db, store, balance: () => Number(db.prepare("SELECT balance FROM user_wallets WHERE user_id=1").get()!.balance) };
}
test("insufficient funds and invalid keys cannot select or grant rewards", () => {
  const f = fixture(499, () => { throw new Error("must not select"); });
  try {
    assert.throws(() => f.store.open(1, "bad"), /Invalid/);
    assert.throws(() => f.store.open(1, key), /500 VCoins/);
    assert.equal(f.balance(), 499);
    assert.equal(f.db.prepare("SELECT count(*) n FROM cosmetic_unlocks").get()!.n, 0);
    assert.equal(f.db.prepare("SELECT count(*) n FROM vivid_cache_openings").get()!.n, 0);
  } finally { f.db.close(); }
});
test("successful opening debits exactly 500 and persists grant, ledger and audit", () => {
  const f = fixture(500);
  try {
    const result = f.store.open(1, key);
    assert.equal(result.balance, 0); assert.equal(result.cost, 500); assert.equal(result.refund, 0);
    assert.equal(f.balance(), 0); assert.ok(f.store.owned(1, "trail-ember"));
    const audit = f.db.prepare("SELECT * FROM vivid_cache_openings").get()!;
    assert.equal(audit.user_id, 1); assert.equal(audit.reward_id, "ember"); assert.equal(audit.rarity, "common"); assert.ok(audit.opened_at);
    assert.equal(f.db.prepare("SELECT sum(amount) n FROM vcoin_transactions").get()!.n, -500);
  } finally { f.db.close(); }
});
test("same and different request IDs share one pending result, including after restart", () => {
  let calls = 0;
  const f = fixture(1500, () => { calls++; return CACHE_REWARDS[0]; });
  try {
    const result = f.store.open(1, key);
    assert.deepEqual(f.store.open(1, key), result);
    assert.deepEqual(f.store.open(1, next), result);
    const restarted = createVividCacheStore(f.db, 100);
    assert.deepEqual(restarted.pending(1), result);
    assert.deepEqual(restarted.open(1, next), result);
    restarted.acknowledge(2, key); // Another account cannot dismiss it.
    assert.deepEqual(restarted.pending(1), result);
    assert.equal(calls, 1); assert.equal(f.balance(), 1000);
    restarted.acknowledge(1, key);
    assert.equal(restarted.pending(1), null);
    assert.deepEqual(restarted.open(1, key), result); // Replay after dismissal still safe.
    const duplicate = f.store.open(1, next);
    assert.equal(duplicate.duplicate, true); assert.equal(duplicate.refund, 100); assert.equal(f.balance(), 600);
  } finally { f.db.close(); }
});
test("original five-piece Relic owners still receive the Mythic duplicate refund", () => {
  const f = fixture(1000, () => CACHE_REWARDS.at(-1)!);
  try {
    for (const id of ["relic-first-flame", "dice-first-flame", "trail-first-flame", "crit20-first-flame", "title-relic-owner"]) {
      f.db.prepare("INSERT INTO cosmetic_unlocks VALUES (1, ?)").run(id);
    }
    assert.ok(RELIC_UNLOCKS.every(id => f.store.owned(1, id)));
    const result = f.store.open(1, key);
    assert.equal(result.duplicate, true);
    assert.equal(result.refund, 400);
    assert.equal(f.balance(), 900);
  } finally { f.db.close(); }
});

test("mythic grants every bundle component; duplicates refund without extra copies", () => {
  const f = fixture(2000, () => CACHE_REWARDS.at(-1)!);
  try {
    f.db.prepare("INSERT INTO cosmetic_unlocks VALUES (1, ?)").run(RELIC_UNLOCKS[0]);
    assert.equal(f.store.open(1, key).duplicate, false); // Partial grant repaired.
    for (const id of RELIC_UNLOCKS) assert.ok(f.store.owned(1, id));
    f.store.acknowledge(1, key);
    const result = f.store.open(1, next);
    assert.equal(result.refund, 400); assert.equal(f.balance(), 1400);
    assert.equal(f.db.prepare("SELECT count(*) n FROM cosmetic_unlocks").get()!.n, RELIC_UNLOCKS.length);
  } finally { f.db.close(); }
});
test("accounts can use the same request key without sharing wallets or rewards", () => {
  const f = fixture();
  try {
    f.store.open(1, key);
    assert.equal(f.store.pending(2), null);
    assert.equal(f.store.owned(2, "trail-ember"), false);
    const second = f.store.open(2, key);
    assert.equal(second.duplicate, false);
    assert.equal(second.balance, 500);
    assert.equal(f.balance(), 500);
    assert.equal(f.db.prepare("SELECT count(*) n FROM vivid_cache_openings").get()!.n, 2);
  } finally { f.db.close(); }
});
test("grant or persistence failures roll back the debit, unlock and ledger", () => {
  const f = fixture();
  try {
    f.db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON vivid_cache_openings BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END;");
    assert.throws(() => f.store.open(1, key), /audit unavailable/);
    assert.equal(f.balance(), 1000);
    assert.equal(f.db.prepare("SELECT count(*) n FROM cosmetic_unlocks").get()!.n, 0);
    assert.equal(f.db.prepare("SELECT count(*) n FROM vcoin_transactions").get()!.n, 0);
    assert.equal(f.store.pending(1), null);
  } finally { f.db.close(); }
});
test("weighted selection covers every ticket exactly with configured rarity counts", () => {
  const counts: Record<string, number> = {};
  for (let ticket = 0; ticket < 10000; ticket++) {
    const reward = selectCacheReward(ticket); counts[reward.rarity] = (counts[reward.rarity] || 0) + 1;
  }
  assert.deepEqual(counts, { common: 7000, rare: 2200, epic: 600, legendary: 180, mythic: 20 });
  assert.throws(() => selectCacheReward(10000)); assert.throws(() => selectCacheReward(-1));
});
test("reel preserves the committed winner with unbiased neighbors on both sides", () => {
  const winner = CACHE_REWARDS.at(-1)!;
  const reel = buildCacheReel(CACHE_REWARDS, winner, () => 0);
  assert.equal(reel[CACHE_WINNER_INDEX], winner);
  assert.equal(reel.length - CACHE_WINNER_INDEX - 1, 6);
  assert.ok(reel.slice(0, CACHE_WINNER_INDEX).every(r => r === CACHE_REWARDS[0]));
  assert.ok(reel.slice(CACHE_WINNER_INDEX + 1).every(r => r === CACHE_REWARDS[0]));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { CACHE_REWARDS, RELIC_UNLOCKS, createVividCacheStore, selectCacheReward } from "./vividCacheStore.js";
import { buildCacheReel, buildSpinPath, CACHE_SHOWCASE_SLOTS, CACHE_SPIN_DURATION_MS, CACHE_WINNER_INDEX } from "../../shared/vividCacheReel.js";

const key = "11111111-1111-4111-8111-111111111111";
const next = "22222222-2222-4222-8222-222222222222";
function fixture(balance = 1000, choose = () => CACHE_REWARDS[0], cost = 500) {
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE users (id INTEGER PRIMARY KEY);
    INSERT INTO users VALUES (1), (2);
    CREATE TABLE user_wallets (user_id INTEGER PRIMARY KEY, balance INTEGER CHECK(balance >= 0));
    CREATE TABLE cosmetic_unlocks (user_id INTEGER REFERENCES users(id), cosmetic_id TEXT, PRIMARY KEY(user_id, cosmetic_id));
    CREATE TABLE vcoin_transactions (user_id INTEGER, amount INTEGER, reason TEXT, reference TEXT);
  `);
  db.prepare("INSERT INTO user_wallets VALUES (1, ?), (2, ?)").run(balance, balance);
  const store = createVividCacheStore(db, 100, choose, cost);
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
    const restarted = createVividCacheStore(f.db, 100, undefined, 500);
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
test("new Legendary trails grant their own entitlement on a free opening without minting duplicate coins", () => {
  for (const id of ["riftwake", "astral-script", "prism-shatter"]) {
    const reward = CACHE_REWARDS.find(item => item.id === id)!;
    const f = fixture(0, () => reward, 0);
    try {
      const first = f.store.open(1, key);
      assert.equal(first.reward.id, id); assert.equal(first.reward.rarity, "legendary");
      assert.equal(first.duplicate, false); assert.ok(f.store.owned(1, `trail-${id}`));
      assert.equal(f.store.owned(2, `trail-${id}`), false);
      f.store.acknowledge(1, key);
      const again = f.store.open(1, next);
      assert.equal(again.duplicate, true); assert.equal(again.refund, 0); assert.equal(f.balance(), 0);
    } finally { f.db.close(); }
  }
});

test("weighted selection covers every ticket exactly with configured rarity counts", () => {
  const counts: Record<string, number> = {};
  for (let ticket = 0; ticket < 70000; ticket++) {
    const reward = selectCacheReward(ticket); counts[reward.rarity] = (counts[reward.rarity] || 0) + 1;
  }
  assert.deepEqual(counts, { common: 49000, rare: 15400, epic: 4200, legendary: 1260, mythic: 140 });
  assert.throws(() => selectCacheReward(70000)); assert.throws(() => selectCacheReward(-1));
});
// Small seeded generator so the theatre tests are deterministic.
function seeded(seed: number) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
test("the showcase and the near miss never touch the committed winner", () => {
  const random = seeded(7);
  for (let i = 0; i < 2000; i++) {
    const winner = CACHE_REWARDS[i % CACHE_REWARDS.length];
    const reel = buildCacheReel(CACHE_REWARDS, winner, random);
    assert.equal(reel[CACHE_WINNER_INDEX], winner);
    assert.equal(reel.length - CACHE_WINNER_INDEX - 1, 6);
  }
});
test("mythics pass the pointer on every spin, slowest last", () => {
  const reel = buildCacheReel(CACHE_REWARDS, CACHE_REWARDS[0], seeded(3));
  for (const slot of CACHE_SHOWCASE_SLOTS) assert.equal(reel[slot].rarity, "mythic");
});
test("a near miss sits beside the winner about half the time, and never beside a mythic win", () => {
  const nearMiss = (winner: (typeof CACHE_REWARDS)[number], random: () => number) => {
    let hits = 0;
    for (let i = 0; i < 4000; i++) {
      const reel = buildCacheReel(CACHE_REWARDS, winner, random);
      const big = (r: { rarity: string }) => r.rarity === "mythic" || r.rarity === "legendary";
      if (big(reel[CACHE_WINNER_INDEX - 1]) || big(reel[CACHE_WINNER_INDEX + 1])) hits++;
    }
    return hits / 4000;
  };
  const common = nearMiss(CACHE_REWARDS[0], seeded(11));
  assert.ok(common > 0.5 && common < 0.62, `common win near-miss rate ${common}`);
  // Only the ordinary random fill can put a big tile there when the win is already mythic.
  const mythic = nearMiss(CACHE_REWARDS.find(r => r.rarity === "mythic")!, seeded(11));
  assert.ok(mythic < 0.06, `mythic win near-miss rate ${mythic}`);
});
test("the three new dice sit in the mythic tier and the tier keeps its 0.2% share", () => {
  for (const theme of ["event-horizon", "chronos-engine", "prismatic-echo"]) {
    const reward = CACHE_REWARDS.find(r => r.id === theme);
    assert.ok(reward, theme);
    assert.equal(reward.rarity, "mythic");
    assert.deepEqual(reward.unlockIds, [`dice-${theme}`]);
    assert.equal(reward.diceTheme, theme);
  }
  const total = CACHE_REWARDS.reduce((n, r) => n + r.weight, 0);
  const mythic = CACHE_REWARDS.filter(r => r.rarity === "mythic").reduce((n, r) => n + r.weight, 0);
  assert.equal(total, 70000);
  assert.equal(mythic, 140);
});
test("a free opening grants the reward, moves no VCoins, and refunds nothing on a duplicate", () => {
  const dice = CACHE_REWARDS.find(r => r.id === "event-horizon")!;
  const f = fixture(0, () => dice, 0);
  try {
    const first = f.store.open(1, key);
    assert.equal(first.cost, 0);
    assert.equal(first.reward.id, "event-horizon");
    assert.equal(f.balance(), 0);
    assert.equal(f.db.prepare("SELECT count(*) n FROM cosmetic_unlocks WHERE user_id=1 AND cosmetic_id='dice-event-horizon'").get()!.n, 1);
    f.store.acknowledge(1, key);
    const again = f.store.open(1, next);
    assert.equal(again.duplicate, true);
    assert.equal(again.refund, 0);
    assert.equal(f.balance(), 0);
    assert.equal(f.db.prepare("SELECT count(*) n FROM vcoin_transactions").get()!.n, 0, "no ledger rows for free openings");
    assert.equal(f.db.prepare("SELECT count(*) n FROM vivid_cache_openings WHERE user_id=1").get()!.n, 2);
  } finally { f.db.close(); }
});
test("the spin curve winds up, overshoots once, and lands exactly on the winner", () => {
  const { positions, tickTimes, settleAt } = buildSpinPath(CACHE_SPIN_DURATION_MS);
  assert.equal(positions[0], 2);
  assert.equal(positions.at(-1), CACHE_WINNER_INDEX);
  // The wind-up pulls back against the launch before anything moves forward.
  assert.ok(Math.min(...positions) < 2 - 0.4, "strip pulls back first");
  // It drifts past the winner exactly once and eases back onto it.
  const past = positions.filter(index => index > CACHE_WINNER_INDEX);
  assert.ok(past.length > 0 && Math.max(...past) - CACHE_WINNER_INDEX < 0.35, "a small settle, not a second pass");
  // Ticks come from the same curve, so they thin out as the strip slows: the
  // first half of the run has to carry far more of them than the last half.
  const half = CACHE_SPIN_DURATION_MS / 2;
  const early = tickTimes.filter(time => time < half).length;
  assert.ok(early > tickTimes.length - early, "ticks slow down with the strip");
  assert.ok(tickTimes.every((time, i) => i === 0 || time >= tickTimes[i - 1]), "ticks are ordered");
  assert.ok(settleAt > half && settleAt < CACHE_SPIN_DURATION_MS, "settles late, but before the end");
});

test("new critical rewards grant independently and preserve the 6% Epic tier", () => {
  assert.equal(CACHE_REWARDS.filter(r => r.rarity === "epic").reduce((n,r) => n+r.weight,0),4200);
  for (const effect of ["void-collapse", "heavens-lance", "chronobreak"]) {
    const reward = CACHE_REWARDS.find(r => r.id === effect)!;
    assert.equal(reward.weight,1050);
    const f = fixture(0, () => reward, 0);
    try {
      const result = f.store.open(1,key);
      assert.equal(result.balance,0);
      assert.ok(f.store.owned(1,`crit20-${effect}`));
      assert.equal(f.store.owned(2,`crit20-${effect}`),false);
      f.store.acknowledge(1,key);
      assert.equal(f.store.open(1,next).refund,0);
    } finally { f.db.close(); }
  }
});


test("each Mythic critical grants only its own effect, persists, and never refunds free duplicates", () => {
  for (const effect of ["silver-requiem", "winter-verdict", "emberheart"]) {
    const reward = CACHE_REWARDS.find(r => r.id === effect)!;
    const f = fixture(0, () => reward, 0);
    try {
      const result = f.store.open(1, key);
      assert.equal(result.reward.rarity, "mythic");
      assert.equal(result.balance, 0);
      assert.equal(result.duplicate, false);
      assert.equal(f.store.owned(1, "crit20-" + effect), true);
      assert.equal(f.store.owned(2, "crit20-" + effect), false);
      assert.equal(f.store.owned(1, "dice-first-flame"), false);
      assert.equal(Number(f.db.prepare("SELECT count(*) n FROM cosmetic_unlocks WHERE user_id = 1").get()!.n), 1);
      assert.equal(createVividCacheStore(f.db, 0, () => reward, 0).pending(1)?.reward.id, effect);
      f.store.acknowledge(1, key);
      const duplicate = f.store.open(1, next);
      assert.equal(duplicate.duplicate, true);
      assert.equal(duplicate.refund, 0);
      assert.equal(f.balance(), 0);
    } finally { f.db.close(); }
  }
});

test("each Mythic failure grants only its own effect, persists, and never refunds free duplicates", () => {
  for (const effect of ["aura-break", "nevermore", "shadow-snare"]) {
    const reward = CACHE_REWARDS.find(r => r.id === effect)!;
    const f = fixture(0, () => reward, 0);
    try {
      const result = f.store.open(1, key);
      assert.equal(result.reward.rarity, "mythic");
      assert.equal(result.balance, 0);
      assert.equal(result.reward.cosmeticType, "nat1-effect");
      assert.equal(f.store.owned(1, "crit20-" + effect), false);
      assert.equal(result.duplicate, false);
      assert.equal(f.store.owned(1, "crit1-" + effect), true);
      assert.equal(f.store.owned(2, "crit1-" + effect), false);
      assert.equal(f.store.owned(1, "dice-first-flame"), false);
      assert.equal(Number(f.db.prepare("SELECT count(*) n FROM cosmetic_unlocks WHERE user_id = 1").get()!.n), 1);
      assert.equal(createVividCacheStore(f.db, 0, () => reward, 0).pending(1)?.reward.id, effect);
      f.store.acknowledge(1, key);
      const duplicate = f.store.open(1, next);
      assert.equal(duplicate.duplicate, true);
      assert.equal(duplicate.refund, 0);
      assert.equal(f.balance(), 0);
    } finally { f.db.close(); }
  }
});

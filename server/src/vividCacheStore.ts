import { MYTHIC_CRITICALS } from "../../shared/mythicCriticals.js";
import { SPECIAL_CRITICALS } from "../../shared/specialCriticals.js";
import { randomInt } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { MYTHIC_DICE } from "../../shared/mythicDice.js";
import { SPECIAL_TRAILS } from "../../shared/specialTrails.js";
import { ownsCosmetic, RELIC_ID, RELIC_ADDITIONS } from "./relicOwnership.js";
export { RELIC_ID } from "./relicOwnership.js";

// VCoins per opening. Free for now -- set a price here to charge again; it
// reaches players with the next VTT update. While it is 0, duplicates refund
// nothing (see cacheRefunds), so free openings can't be farmed for VCoins.
export const CACHE_COST = 0;
export const RELIC_UNLOCKS = [RELIC_ID, "dice-first-flame", "trail-first-flame", "crit20-first-flame", "title-relic-owner", ...RELIC_ADDITIONS];
export const DUPLICATE_REFUNDS = { common: 100, rare: 150, epic: 200, legendary: 300, mythic: 400 };
export type CacheRarity = keyof typeof DUPLICATE_REFUNDS;
export function cacheRefunds(cost: number) {
  return Object.fromEntries(Object.entries(DUPLICATE_REFUNDS).map(([rarity, refund]) => [rarity, Math.min(refund, Math.max(0, cost - 1))])) as typeof DUPLICATE_REFUNDS;
}
export interface CacheReward {
  id: string; name: string; rarity: CacheRarity; weight: number;
  cosmeticType: string; unlockIds: string[]; duplicateBehavior: "refund"; diceTheme?: string;
  preview: { symbol: string; description: string };
}
// Relative weights total 70,000: 70% common, 22% rare, 6% epic,
// 1.8% legendary, 0.2% mythic. Seven equal Mythics each have 20 tickets
// (1 in 3,500). Integer scaling preserves every other reward’s probability.
export const CACHE_REWARDS: CacheReward[] = [
  { id: "ember", name: "Ember Trail", rarity: "common", weight: 24500, cosmeticType: "dice-trail", unlockIds: ["trail-ember"], duplicateBehavior: "refund", preview: { symbol: "✦", description: "Fire sprites follow your throw." } },
  { id: "frost", name: "Frost Trail", rarity: "common", weight: 24500, cosmeticType: "dice-trail", unlockIds: ["trail-frost"], duplicateBehavior: "refund", preview: { symbol: "❄", description: "Cold motes and icy stars." } },
  { id: "shadow", name: "Shadow Trail", rarity: "rare", weight: 7700, cosmeticType: "dice-trail", unlockIds: ["trail-shadow"], duplicateBehavior: "refund", preview: { symbol: "☾", description: "Violet smoke in your wake." } },
  { id: "lightning", name: "Lightning Trail", rarity: "rare", weight: 7700, cosmeticType: "dice-trail", unlockIds: ["trail-lightning"], duplicateBehavior: "refund", preview: { symbol: "ϟ", description: "Electric arcs around the dice." } },
  { id: "storm", name: "Lightning Strike", rarity: "epic", weight: 1050, cosmeticType: "nat20-effect", unlockIds: ["crit20-lightning"], duplicateBehavior: "refund", preview: { symbol: "ϟ", description: "A critical-success electrical surge." } },
  { id: "rose", name: "Rose Burst", rarity: "legendary", weight: 315, cosmeticType: "nat20-effect", unlockIds: ["crit20-rose"], duplicateBehavior: "refund", preview: { symbol: "❋", description: "Crimson petals celebrate a natural 20." } },
  ...SPECIAL_CRITICALS.map(effect => ({ id: effect.effect, name: effect.name, rarity: effect.rarity, weight: 1050, cosmeticType: "nat20-effect", unlockIds: [effect.id], duplicateBehavior: "refund" as const, preview: { symbol: "✦", description: effect.description } })),
  ...SPECIAL_TRAILS.map(trail => ({ id: trail.effect, name: trail.name, rarity: trail.rarity, weight: 315,
    cosmeticType: "dice-trail", unlockIds: [trail.id], duplicateBehavior: "refund" as const,
    preview: { symbol: "✦", description: trail.description } })),
  ...MYTHIC_CRITICALS.map(effect => ({ id: effect.effect, name: effect.name, rarity: effect.rarity, weight: 20,
    cosmeticType: "nat20-effect", unlockIds: [effect.id], duplicateBehavior: "refund" as const,
    preview: { symbol: "✦", description: effect.description } })),
  ...MYTHIC_DICE.filter(dice => dice.theme !== "first-flame").map(dice => ({
    id: dice.theme, name: dice.name, rarity: "mythic" as const, weight: 20,
    cosmeticType: "dice", diceTheme: dice.theme, unlockIds: [dice.unlockId], duplicateBehavior: "refund" as const,
    preview: { symbol: "?", description: dice.theme === "event-horizon" ? "A dark singularity wrapped in moving violet accretion rings."
      : dice.theme === "chronos-engine" ? "Brass clockwork, illuminated teeth and a sweeping mint dial."
      : "Crystal facets with shifting spectral light and iridescent edges." },
  })),
  { id: RELIC_ID, name: "Relic of the First Flame", rarity: "mythic", weight: 20, cosmeticType: "bundle", diceTheme: "first-flame", unlockIds: RELIC_UNLOCKS, duplicateBehavior: "refund", preview: { symbol: "◆", description: "Obsidian dice, molten trail, Nat 20 and Nat 1 effects, token border, gold chat name and Relic Owner title." } },
];

export function selectCacheReward(ticket = randomInt(CACHE_REWARDS.reduce((n, r) => n + r.weight, 0))) {
  const total = CACHE_REWARDS.reduce((n, r) => n + r.weight, 0);
  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= total) throw new Error("Invalid reward ticket");
  for (const reward of CACHE_REWARDS) {
    if (ticket < reward.weight) return reward;
    ticket -= reward.weight;
  }
  throw new Error("Invalid reward configuration");
}

export class CacheError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export interface CacheResult {
  requestId: string; reward: CacheReward; cost: number; refund: number;
  duplicate: boolean; balance: number; openedAt: string;
}

export function createVividCacheStore(db: DatabaseSync, startingBalance: number, choose = selectCacheReward, cost = CACHE_COST) {
  if (!Number.isSafeInteger(cost) || cost < 0) throw new Error("Invalid cache cost");
  db.exec(`CREATE TABLE IF NOT EXISTS vivid_cache_openings (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    reward_id TEXT NOT NULL, rarity TEXT NOT NULL, cost INTEGER NOT NULL,
    refund INTEGER NOT NULL, result_json TEXT NOT NULL,
    opened_at TEXT NOT NULL DEFAULT (datetime('now')), acknowledged_at TEXT,
    UNIQUE(user_id, request_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS vivid_cache_one_pending ON vivid_cache_openings(user_id) WHERE acknowledged_at IS NULL;`);
  const owned = (userId: number, id: string) => ownsCosmetic(db, userId, id);
  const pending = (userId: number): CacheResult | null => {
    const row = db.prepare("SELECT result_json FROM vivid_cache_openings WHERE user_id = ? AND acknowledged_at IS NULL").get(userId);
    return row ? JSON.parse(String(row.result_json)) : null;
  };
  return {
    owned, pending,
    acknowledge(userId: number, requestId: string) {
      db.prepare("UPDATE vivid_cache_openings SET acknowledged_at = datetime('now') WHERE user_id = ? AND request_id = ? AND acknowledged_at IS NULL").run(userId, requestId);
    },
    open(userId: number, requestId: string): CacheResult {
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) throw new CacheError("Invalid cache request ID.", 400);
      db.exec("BEGIN IMMEDIATE");
      try {
        const previous = db.prepare("SELECT result_json FROM vivid_cache_openings WHERE user_id = ? AND request_id = ?").get(userId, requestId);
        // Both same-key retries and concurrent different-key requests return the
        // committed opening until explicitly dismissed. This survives restarts.
        const existing = previous ? JSON.parse(String(previous.result_json)) as CacheResult : pending(userId);
        if (existing) { db.exec("COMMIT"); return existing; }
        db.prepare("INSERT OR IGNORE INTO user_wallets (user_id, balance) VALUES (?, ?)").run(userId, startingBalance);
        const debit = db.prepare("UPDATE user_wallets SET balance = balance - ? WHERE user_id = ? AND balance >= ?").run(cost, userId, cost);
        if (!debit.changes) throw new CacheError(`You need ${cost} VCoins to open a Vivid Cache.`);
        const reward = choose();
        const duplicate = reward.unlockIds.every(id => owned(userId, id));
        const refund = duplicate ? cacheRefunds(cost)[reward.rarity] : 0;
        for (const id of reward.unlockIds) db.prepare("INSERT OR IGNORE INTO cosmetic_unlocks (user_id, cosmetic_id) VALUES (?, ?)").run(userId, id);
        if (refund) db.prepare("UPDATE user_wallets SET balance = balance + ? WHERE user_id = ?").run(refund, userId);
        const reference = `vivid-cache:${requestId}`;
        // A free opening moves no VCoins, so it leaves no ledger row; the opening
        // itself is still recorded in vivid_cache_openings below.
        if (cost) db.prepare("INSERT INTO vcoin_transactions (user_id, amount, reason, reference) VALUES (?, ?, ?, ?)").run(userId, -cost, `Vivid Cache: ${reward.name}`, reference);
        if (refund) db.prepare("INSERT INTO vcoin_transactions (user_id, amount, reason, reference) VALUES (?, ?, ?, ?)").run(userId, refund, `Duplicate refund: ${reward.name}`, reference);
        const balance = Number(db.prepare("SELECT balance FROM user_wallets WHERE user_id = ?").get(userId)!.balance);
        const result: CacheResult = { requestId, reward, cost, refund, duplicate, balance, openedAt: new Date().toISOString() };
        db.prepare(`INSERT INTO vivid_cache_openings (user_id, request_id, reward_id, rarity, cost, refund, result_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(userId, requestId, reward.id, reward.rarity, cost, refund, JSON.stringify(result));
        db.exec("COMMIT");
        return result;
      } catch (error) {
        if (db.isTransaction) db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

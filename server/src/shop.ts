import { appearance } from "./appearance.js";
import { ownsCosmetic } from "./relicOwnership.js";
import { getIo } from "./realtime.js";
import type { AppearanceSlot } from "./appearanceStore.js";
import { Router } from "express";
import { db } from "./db.js";
import { getSessionUser } from "./auth.js";
import { achievements, notifyAchievementUnlocks } from "./achievements.js";
import { reconcileAccountAchievements } from "./achievementTracking.js";

import { CACHE_COST, CACHE_REWARDS, DUPLICATE_REFUNDS, CacheError, createVividCacheStore } from "./vividCacheStore.js";

import { COSMETICS, bundlesNewestFirst, type CriticalSlot, type CriticalEffectStyle, type TurnStartEffectStyle } from "./shopCatalog.js";
export { COSMETICS, BUNDLES, bundlesNewestFirst } from "./shopCatalog.js";
export type { CriticalSlot, CosmeticSlot, CriticalEffectStyle, TurnStartEffectStyle } from "./shopCatalog.js";

export const shopRouter = Router();

type Cosmetic = (typeof COSMETICS)[number];
type CriticalCosmetic = Extract<Cosmetic, { slot: CriticalSlot }>;
type TurnStartCosmetic = Extract<Cosmetic, { slot: "turnStart" }>;

const DEFAULT_CRITICAL_LOADOUT: Record<CriticalSlot, CriticalCosmetic["id"]> = {
  nat20: "crit20-golden",
  nat1: "crit1-fracture",
};
const DEFAULT_TURN_START_ID: TurnStartCosmetic["id"] = "turn-none";

db.exec(`
  CREATE TABLE IF NOT EXISTS cosmetic_loadout (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slot         TEXT NOT NULL CHECK (slot IN ('nat20','nat1')),
    cosmetic_id  TEXT NOT NULL,
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, slot)
  );

  CREATE TABLE IF NOT EXISTS turn_start_loadout (
    user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    cosmetic_id  TEXT NOT NULL,
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shop_migrations (
    id         TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// One-time amnesty for the period when the dev bypass made every cosmetic free.
// Anything a player had actually equipped becomes properly theirs, so nobody
// loses the effect they are wearing; everything else goes back to being earned.
// Deliberately once-only rather than every boot: after this, equipping already
// requires ownership, so re-running would only ever rubber-stamp the GM's own
// bypassed loadout.
/** What a wallet starts with, and what the economy reset below sets everyone to. */
export const STARTING_BALANCE = 100;

const AMNESTY_ID = "grandfather-equipped-cosmetics-v1";
if (!db.prepare("SELECT 1 FROM shop_migrations WHERE id = ?").get(AMNESTY_ID)) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const granted = [
      db.prepare(
        `INSERT OR IGNORE INTO cosmetic_unlocks (user_id, cosmetic_id)
         SELECT user_id, cosmetic_id FROM cosmetic_loadout`
      ).run(),
      db.prepare(
        `INSERT OR IGNORE INTO cosmetic_unlocks (user_id, cosmetic_id)
         SELECT user_id, cosmetic_id FROM turn_start_loadout`
      ).run(),
    ].reduce((total, result) => total + Number(result.changes), 0);

    db.prepare("INSERT INTO shop_migrations (id) VALUES (?)").run(AMNESTY_ID);
    db.exec("COMMIT");
    console.log(`kept ${granted} equipped cosmetic(s) for players after removing the free-cosmetics bypass`);
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

// A clean slate for the economy: every existing account is set to the starting
// balance so the group begins level against the new prices. Balances built up
// while cosmetics were free did not mean anything, so this replaces them rather
// than topping them up. Guarded, so it never wipes spending after the reset.
const WALLET_RESET_ID = "reset-wallets-to-starting-balance-v1";
if (!db.prepare("SELECT 1 FROM shop_migrations WHERE id = ?").get(WALLET_RESET_ID)) {
  db.exec("BEGIN IMMEDIATE");
  try {
    // The "WHERE true" is load-bearing: without a WHERE clause SQLite cannot
    // tell whether "ON" starts the upsert or a join, and refuses to parse it.
    const reset = db.prepare(
      `INSERT INTO user_wallets (user_id, balance)
       SELECT id, ? FROM users WHERE true
       ON CONFLICT(user_id) DO UPDATE SET balance = excluded.balance`
    ).run(STARTING_BALANCE);

    db.prepare(
      `INSERT INTO vcoin_transactions (user_id, amount, reason, reference)
       SELECT id, ?, 'Economy reset — balance set for the new shop prices', 'wallet-reset-v1'
       FROM users`
    ).run(STARTING_BALANCE);

    db.prepare("INSERT INTO shop_migrations (id) VALUES (?)").run(WALLET_RESET_ID);
    db.exec("COMMIT");
    console.log(`set ${Number(reset.changes)} wallet(s) to ${STARTING_BALANCE} VCoins`);
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

function ensureWallet(userId: number) {
  // New accounts start on the same balance the reset gave everyone else, so
  // someone joining later can actually buy something.
  db.prepare(
    `INSERT OR IGNORE INTO user_wallets (user_id, balance)
     VALUES (?, ?)`
  ).run(userId, STARTING_BALANCE);
}

function isGameMaster(userId: number): boolean {
  const row = db
    .prepare(
      `SELECT 1
       FROM campaign_members
       WHERE user_id = ? AND role IN ('dm','co-dm')
       LIMIT 1`
    )
    .get(userId);
  return !!row;
}

function hasUnlock(userId: number, cosmeticId: string): boolean {
  return ownsCosmetic(db, userId, cosmeticId);
}

function walletBalance(userId: number): number {
  ensureWallet(userId);
  const row = db.prepare("SELECT balance FROM user_wallets WHERE user_id = ?").get(userId) as
    | { balance: number }
    | undefined;
  return Number(row?.balance ?? 0);
}

function bypassFor(userId: number): { active: boolean; reason: "dev" | "gm" | null } {
  // This used to hand every cosmetic to everyone whenever NODE_ENV was not
  // "production" — but the table is normally hosted in dev mode so players can
  // sign in easily, so in practice the whole Emporium was free for the whole
  // group. Free cosmetics now have to be asked for deliberately.
  if (process.env.VIVID_FREE_COSMETICS === "1") return { active: true, reason: "dev" };
  if (isGameMaster(userId)) return { active: true, reason: "gm" };
  return { active: false, reason: null };
}

function presentItem(userId: number, item: Cosmetic, bypass: boolean) {
  const owned = item.rarity === "mythic" ? hasUnlock(userId, item.id) : item.price === 0 || bypass || hasUnlock(userId, item.id);
  return { ...item, owned };
}

function isCriticalCosmetic(item: Cosmetic): item is CriticalCosmetic {
  return item.type === "nat20-effect" || item.type === "nat1-effect";
}

function criticalCosmeticById(id: string): CriticalCosmetic | undefined {
  const item = COSMETICS.find((candidate) => candidate.id === id);
  return item && isCriticalCosmetic(item) ? item : undefined;
}

function isTurnStartCosmetic(item: Cosmetic): item is TurnStartCosmetic {
  return item.type === "turn-start-effect";
}

function turnStartCosmeticById(id: string): TurnStartCosmetic | undefined {
  const item = COSMETICS.find((candidate) => candidate.id === id);
  return item && isTurnStartCosmetic(item) ? item : undefined;
}

function equippedCriticalIds(userId: number): Record<CriticalSlot, string> {
  const equipped: Record<CriticalSlot, string> = { ...DEFAULT_CRITICAL_LOADOUT };
  const rows = db
    .prepare(
      `SELECT slot, cosmetic_id
       FROM cosmetic_loadout
       WHERE user_id = ?`
    )
    .all(userId) as { slot: string; cosmetic_id: string }[];

  for (const row of rows) {
    if (row.slot !== "nat20" && row.slot !== "nat1") continue;
    const item = criticalCosmeticById(row.cosmetic_id);
    if (item?.slot === row.slot) equipped[row.slot] = item.id;
  }

  return equipped;
}

export function criticalEffectsForUser(
  userId: number
): Record<CriticalSlot, CriticalEffectStyle> {
  const ids = equippedCriticalIds(userId);
  const nat20 = criticalCosmeticById(ids.nat20);
  const nat1 = criticalCosmeticById(ids.nat1);

  return {
    nat20: (nat20?.effect ?? "golden") as CriticalEffectStyle,
    nat1: (nat1?.effect ?? "fracture") as CriticalEffectStyle,
  };
}


function shopPreviewCharacter(
  userId: number
): { id: number; name: string; imageUrl: string; imageKind: "token" | "portrait" | null } | null {
  const row = db
    .prepare(
      `SELECT c.id, c.name, c.portrait_path,
              (
                SELECT t.image_path
                FROM tokens t
                WHERE t.character_id = c.id AND COALESCE(t.image_path, '') <> ''
                ORDER BY t.id DESC
                LIMIT 1
              ) AS token_image_path
       FROM characters c
       WHERE c.user_id = ? AND COALESCE(c.is_npc, 0) = 0
       ORDER BY
         CASE WHEN EXISTS (SELECT 1 FROM tokens tx WHERE tx.character_id = c.id) THEN 0 ELSE 1 END,
         (SELECT MAX(tx2.id) FROM tokens tx2 WHERE tx2.character_id = c.id) DESC,
         c.updated_at DESC,
         c.id DESC
       LIMIT 1`
    )
    .get(userId) as
    | {
        id: number;
        name: string;
        portrait_path: string | null;
        token_image_path: string | null;
      }
    | undefined;

  if (!row) return null;

  const imageKind = row.token_image_path ? "token" : row.portrait_path ? "portrait" : null;
  const imagePath = row.token_image_path || row.portrait_path || "";
  const fileName = imagePath ? imagePath.replace(/\\/g, "/").split("/").pop() ?? "" : "";

  return {
    id: row.id,
    name: row.name,
    imageUrl: fileName ? `/uploads/${encodeURIComponent(fileName)}` : "",
    imageKind,
  };
}

function equippedTurnStartId(userId: number): TurnStartCosmetic["id"] {
  const row = db
    .prepare(
      `SELECT cosmetic_id
       FROM turn_start_loadout
       WHERE user_id = ?`
    )
    .get(userId) as { cosmetic_id: string } | undefined;

  const item = row ? turnStartCosmeticById(row.cosmetic_id) : undefined;
  return item?.id ?? DEFAULT_TURN_START_ID;
}

export function turnStartEffectForUser(userId: number): TurnStartEffectStyle {
  const item = turnStartCosmeticById(equippedTurnStartId(userId));
  return (item?.effect ?? "none") as TurnStartEffectStyle;
}

shopRouter.get("/", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });

  ensureWallet(user.id);
  const bypass = bypassFor(user.id);

  res.json({
    wallet: {
      balance: walletBalance(user.id),
      bypass: bypass.active,
      bypassReason: bypass.reason,
    },
    equipped: {
      ...equippedCriticalIds(user.id),
      ...appearance.equipped(user.id),
      turnStart: equippedTurnStartId(user.id),
    },
    equippedEffects: {
      ...criticalEffectsForUser(user.id),
      turnStart: turnStartEffectForUser(user.id),
    },
    previewCharacter: shopPreviewCharacter(user.id),
    items: COSMETICS.map((item) => presentItem(user.id, item, bypass.active)),
    bundles: bundlesNewestFirst(),
  });
});

shopRouter.post("/equip", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });

  const cosmeticId = String(req.body?.cosmeticId ?? "");
  const item = COSMETICS.find((candidate) => candidate.id === cosmeticId);
  if (!item || (!isCriticalCosmetic(item) && !isTurnStartCosmetic(item) && item.type !== "token-border" && item.type !== "chat-flair")) {
    return res.status(404).json({ error: "That equippable cosmetic does not exist." });
  }

  const bypass = bypassFor(user.id);
  if (item.price > 0 && (item.rarity === "mythic" || !bypass.active) && !hasUnlock(user.id, item.id)) {
    return res.status(403).json({ error: "Unlock that effect before equipping it." });
  }

  if (item.type === "token-border" || item.type === "chat-flair") {
    if (!appearance.equip(user.id, item.slot, item.id)) return res.status(403).json({ error: "Unlock that appearance first." });
    notifyAppearanceChange(user.id);
  } else if (isTurnStartCosmetic(item)) {
    db.prepare(
      `INSERT INTO turn_start_loadout (user_id, cosmetic_id, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         cosmetic_id = excluded.cosmetic_id,
         updated_at = datetime('now')`
    ).run(user.id, item.id);
  } else {
    db.prepare(
      `INSERT INTO cosmetic_loadout (user_id, slot, cosmetic_id, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, slot) DO UPDATE SET
         cosmetic_id = excluded.cosmetic_id,
         updated_at = datetime('now')`
    ).run(user.id, item.slot, item.id);
  }

  reconcileAccountAchievements(user.id);
  res.json({
    ok: true,
    equipped: {
      ...equippedCriticalIds(user.id),
      ...appearance.equipped(user.id),
      turnStart: equippedTurnStartId(user.id),
    },
    equippedEffects: {
      ...criticalEffectsForUser(user.id),
      turnStart: turnStartEffectForUser(user.id),
    },
  });
});

function notifyAppearanceChange(userId: number) {
  const memberships = db.prepare("SELECT campaign_id FROM campaign_members WHERE user_id = ?").all(userId);
  for (const row of memberships) {
    getIo().to(`campaign:${row.campaign_id}`).emit("appearance:update", {
      campaignId: row.campaign_id, userId, ...appearance.equipped(userId),
    });
  }
}

shopRouter.post("/appearance/clear", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  const slot = req.body?.slot as AppearanceSlot;
  if (!appearance.equip(user.id, slot, "")) return res.status(400).json({ error: "Invalid appearance slot." });
  notifyAppearanceChange(user.id);
  res.json({ ok: true });
});

// CriticalRollOverlay already receives the roller's display name from the live
// synchronized roll. Resolve that roller to their server-owned equipped effect
// so every viewer sees the roller's chosen celebration/failure cosmetic.
shopRouter.get("/critical-effect", (req, res) => {
  const viewer = getSessionUser(req);
  if (!viewer) return res.status(401).json({ error: "Not logged in" });

  const campaignId = Number(req.query.campaignId);
  const userName = String(req.query.userName ?? "").trim();
  const kind = String(req.query.kind ?? "");

  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return res.status(400).json({ error: "Invalid campaign." });
  }
  if (!userName || (kind !== "nat20" && kind !== "nat1")) {
    return res.status(400).json({ error: "Invalid critical-effect request." });
  }

  const member = db
    .prepare(
      `SELECT 1 FROM campaign_members
       WHERE campaign_id = ? AND user_id = ?
       LIMIT 1`
    )
    .get(campaignId, viewer.id);
  if (!member) return res.status(404).json({ error: "Campaign not found." });

  const roller = db
    .prepare(
      `SELECT r.user_id
       FROM rolls r
       JOIN users u ON u.id = r.user_id
       WHERE r.campaign_id = ? AND u.display_name = ?
       ORDER BY r.id DESC
       LIMIT 1`
    )
    .get(campaignId, userName) as { user_id: number } | undefined;

  if (!roller) {
    return res.json({ effect: kind === "nat20" ? "golden" : "fracture", equipped: false });
  }

  const effects = criticalEffectsForUser(roller.user_id);
  res.json({ effect: effects[kind], equipped: Boolean(equippedCriticalIds(roller.user_id)[kind]) });
});

// Resolve a player's equipped turn-start cosmetic for a viewer in the same campaign.
shopRouter.get("/turn-start-effect", (req, res) => {
  const viewer = getSessionUser(req);
  if (!viewer) return res.status(401).json({ error: "Not logged in" });

  const campaignId = Number(req.query.campaignId);
  const targetUserId = Number(req.query.userId);
  if (
    !Number.isInteger(campaignId) ||
    campaignId <= 0 ||
    !Number.isInteger(targetUserId) ||
    targetUserId <= 0
  ) {
    return res.status(400).json({ error: "Invalid turn-start effect request." });
  }

  const viewerMember = db
    .prepare(
      `SELECT 1 FROM campaign_members
       WHERE campaign_id = ? AND user_id = ?
       LIMIT 1`
    )
    .get(campaignId, viewer.id);
  if (!viewerMember) return res.status(404).json({ error: "Campaign not found." });

  const targetMember = db
    .prepare(
      `SELECT 1 FROM campaign_members
       WHERE campaign_id = ? AND user_id = ?
       LIMIT 1`
    )
    .get(campaignId, targetUserId);
  if (!targetMember) return res.json({ effect: "none" });

  res.json({ effect: turnStartEffectForUser(targetUserId) });
});

shopRouter.post("/purchase", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });

  const cosmeticId = String(req.body?.cosmeticId ?? "");
  const item = COSMETICS.find((candidate) => candidate.id === cosmeticId);
  if (!item) return res.status(404).json({ error: "That cosmetic does not exist." });
  if (item.rarity === "mythic") return res.status(403).json({ error: "This cosmetic is exclusive to Vivid Cache." });

  ensureWallet(user.id);
  const bypass = bypassFor(user.id);

  if (item.price === 0 || bypass.active || hasUnlock(user.id, item.id)) {
    if (!bypass.active && item.price > 0) {
      db.prepare(
        `INSERT OR IGNORE INTO cosmetic_unlocks (user_id, cosmetic_id)
         VALUES (?, ?)`
      ).run(user.id, item.id);
    }
    return res.json({
      ok: true,
      alreadyOwned: true,
      balance: walletBalance(user.id),
      item: presentItem(user.id, item, bypass.active),
    });
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const balance = walletBalance(user.id);
    if (balance < item.price) {
      db.exec("ROLLBACK");
      return res.status(409).json({
        error: `You need ${item.price - balance} more VCoins for ${item.name}.`,
        balance,
      });
    }

    const unlock = db.prepare(
      `INSERT OR IGNORE INTO cosmetic_unlocks (user_id, cosmetic_id)
       VALUES (?, ?)`
    ).run(user.id, item.id);

    if (Number(unlock.changes) === 0) {
      db.exec("COMMIT");
      return res.json({
        ok: true,
        alreadyOwned: true,
        balance,
        item: presentItem(user.id, item, false),
      });
    }

    db.prepare(
      `UPDATE user_wallets
       SET balance = balance - ?
       WHERE user_id = ?`
    ).run(item.price, user.id);

    db.prepare(
      `INSERT INTO vcoin_transactions (user_id, amount, reason, reference)
       VALUES (?, ?, ?, ?)`
    ).run(user.id, -item.price, `Purchased ${item.name}`, item.id);

    const achievementUnlocks = achievements.recordPurchase(user.id);
    db.exec("COMMIT");
    notifyAchievementUnlocks(achievementUnlocks);

    return res.json({
      ok: true,
      balance: balance - item.price,
      alreadyOwned: false,
      item: presentItem(user.id, item, false),
    });
  } catch (error) {
    if (db.isTransaction) {
      db.exec("ROLLBACK");
    }
    throw error;
  }
});

// Development-only helper so the economy can be tested without waiting for
// the play-session reward system. This route does not exist in production.
// The "+500 VCoins" development grant used to live here. It was gated on
// NODE_ENV !== "production" — the same check that made every cosmetic free —
// so while the table is hosted in dev mode any logged-in player could call it
// and mint themselves up to 5,000 VCoins, which defeats the shop entirely.
// Removed rather than re-gated: the GM already has a real tool for this in the
// VCoin Rewards dashboard panel, which is audited and can target one player or
// the whole party.

const vividCache = createVividCacheStore(db, STARTING_BALANCE);
shopRouter.get("/cache", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  res.json({ cost: CACHE_COST, balance: walletBalance(user.id), refunds: DUPLICATE_REFUNDS,
    rewards: CACHE_REWARDS.map(reward => ({ ...reward, owned: reward.unlockIds.every(id => vividCache.owned(user.id, id)) })),
    pending: vividCache.pending(user.id) });
});
shopRouter.post("/cache/open", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  try { res.json(vividCache.open(user.id, String(req.body?.requestId ?? ""))); }
  catch (error) {
    if (error instanceof CacheError) return res.status(error.status).json({ error: error.message });
    throw error;
  }
});
shopRouter.post("/cache/acknowledge", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  vividCache.acknowledge(user.id, String(req.body?.requestId ?? ""));
  res.json({ ok: true });
});

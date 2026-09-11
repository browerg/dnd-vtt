import { Router } from "express";
import { db } from "./db.js";
import { getSessionUser } from "./auth.js";
import { achievements, notifyAchievementUnlocks } from "./achievements.js";

export const shopRouter = Router();

export type CriticalSlot = "nat20" | "nat1";
export type CosmeticSlot = CriticalSlot | "turnStart";
export type CriticalEffectStyle =
  | "golden"
  | "rose"
  | "lightning"
  | "fracture"
  | "smoke"
  | "debris";

export type TurnStartEffectStyle =
  | "none"
  | "aura"
  | "ember"
  | "frost"
  | "shadow"
  | "lightning"
  | "rose";

export const COSMETICS = [
  {
    id: "trail-aura",
    type: "dice-trail",
    effect: "aura",
    name: "Aura Glow",
    description: "A clean ribbon of Huntsman-blue Aura energy.",
    price: 0,
    rarity: "starter",
  },
  {
    id: "trail-ember",
    type: "dice-trail",
    effect: "ember",
    name: "Ember Trail",
    description: "Fire sprites and sparks peel away from every throw.",
    price: 250,
    rarity: "uncommon",
  },
  {
    id: "trail-frost",
    type: "dice-trail",
    effect: "frost",
    name: "Frost Trail",
    description: "Cold motes and icy stars linger behind the dice.",
    price: 250,
    rarity: "uncommon",
  },
  {
    id: "trail-shadow",
    type: "dice-trail",
    effect: "shadow",
    name: "Shadow Trail",
    description: "Dark violet smoke blooms in the wake of the roll.",
    price: 350,
    rarity: "rare",
  },
  {
    id: "trail-lightning",
    type: "dice-trail",
    effect: "lightning",
    name: "Lightning Trail",
    description: "Fast electric arcs snap around the moving dice.",
    price: 400,
    rarity: "rare",
  },
  {
    id: "trail-petals",
    type: "dice-trail",
    effect: "petals",
    name: "Rose Petals",
    description: "Crimson petals scatter behind the dice as they tumble.",
    price: 500,
    rarity: "legendary",
  },

  // Natural 20 celebration effects.
  {
    id: "crit20-golden",
    type: "nat20-effect",
    slot: "nat20",
    effect: "golden",
    name: "Golden Critical",
    description: "The classic radiant critical-success fanfare.",
    price: 0,
    rarity: "starter",
  },
  {
    id: "crit20-lightning",
    type: "nat20-effect",
    slot: "nat20",
    effect: "lightning",
    name: "Lightning Strike",
    description: "A white-blue electrical surge detonates around your natural 20.",
    price: 400,
    rarity: "rare",
  },
  {
    id: "crit20-rose",
    type: "nat20-effect",
    slot: "nat20",
    effect: "rose",
    name: "Rose Burst",
    description: "A dramatic crimson-pink bloom of petals celebrates the perfect roll.",
    price: 500,
    rarity: "legendary",
  },

  // Natural 1 failure effects.
  {
    id: "crit1-fracture",
    type: "nat1-effect",
    slot: "nat1",
    effect: "fracture",
    name: "Critical Failure",
    description: "The classic red fracture-and-glitch failure screen.",
    price: 0,
    rarity: "starter",
  },
  {
    id: "crit1-smoke",
    type: "nat1-effect",
    slot: "nat1",
    effect: "smoke",
    name: "Skull & Smoke",
    description: "The table darkens under a rolling cloud of ominous violet smoke.",
    price: 350,
    rarity: "rare",
  },
  {
    id: "crit1-debris",
    type: "nat1-effect",
    slot: "nat1",
    effect: "debris",
    name: "Falling Debris",
    description: "The critical failure hits hard enough to bring the ceiling down.",
    price: 500,
    rarity: "legendary",
  },

  // Turn-start effects. These play briefly around a player-owned token when
  // initiative advances to that combatant.
  {
    id: "turn-none",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "none",
    name: "No Turn Effect",
    description: "Keep initiative transitions clean and unadorned.",
    price: 0,
    rarity: "starter",
  },
  {
    id: "turn-aura",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "aura",
    name: "Aura Pulse",
    description: "A bright Aura wave expands from your token as your turn begins.",
    price: 200,
    rarity: "uncommon",
  },
  {
    id: "turn-ember",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "ember",
    name: "Dust Ignition",
    description: "A quick burst of ember-bright Dust ignites beneath your token.",
    price: 300,
    rarity: "uncommon",
  },
  {
    id: "turn-frost",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "frost",
    name: "Frost Ring",
    description: "A crystalline frost ring flashes outward before cracking away.",
    price: 300,
    rarity: "uncommon",
  },
  {
    id: "turn-lightning",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "lightning",
    name: "Voltage Surge",
    description: "Electric arcs snap around your token the instant initiative reaches you.",
    price: 400,
    rarity: "rare",
  },
  {
    id: "turn-shadow",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "shadow",
    name: "Shadow Bloom",
    description: "Dark violet smoke blooms outward and collapses back into your token.",
    price: 450,
    rarity: "rare",
  },
  {
    id: "turn-rose",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "rose",
    name: "Rose Entrance",
    description: "A sweeping ring of crimson petals marks the beginning of your turn.",
    price: 500,
    rarity: "legendary",
  },

] as const;

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
`);

function ensureWallet(userId: number) {
  db.prepare(
    `INSERT OR IGNORE INTO user_wallets (user_id, balance)
     VALUES (?, 0)`
  ).run(userId);
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
  const row = db
    .prepare(
      `SELECT 1 FROM cosmetic_unlocks
       WHERE user_id = ? AND cosmetic_id = ?
       LIMIT 1`
    )
    .get(userId, cosmeticId);
  return !!row;
}

function walletBalance(userId: number): number {
  ensureWallet(userId);
  const row = db.prepare("SELECT balance FROM user_wallets WHERE user_id = ?").get(userId) as
    | { balance: number }
    | undefined;
  return Number(row?.balance ?? 0);
}

function bypassFor(userId: number): { active: boolean; reason: "dev" | "gm" | null } {
  if (process.env.NODE_ENV !== "production") return { active: true, reason: "dev" };
  if (isGameMaster(userId)) return { active: true, reason: "gm" };
  return { active: false, reason: null };
}

function presentItem(userId: number, item: Cosmetic, bypass: boolean) {
  const owned = item.price === 0 || bypass || hasUnlock(userId, item.id);
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
      turnStart: equippedTurnStartId(user.id),
    },
    equippedEffects: {
      ...criticalEffectsForUser(user.id),
      turnStart: turnStartEffectForUser(user.id),
    },
    previewCharacter: shopPreviewCharacter(user.id),
    items: COSMETICS.map((item) => presentItem(user.id, item, bypass.active)),
  });
});

shopRouter.post("/equip", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });

  const cosmeticId = String(req.body?.cosmeticId ?? "");
  const item = COSMETICS.find((candidate) => candidate.id === cosmeticId);
  if (!item || (!isCriticalCosmetic(item) && !isTurnStartCosmetic(item))) {
    return res.status(404).json({ error: "That equippable cosmetic does not exist." });
  }

  const bypass = bypassFor(user.id);
  if (item.price > 0 && !bypass.active && !hasUnlock(user.id, item.id)) {
    return res.status(403).json({ error: "Unlock that effect before equipping it." });
  }

  if (isTurnStartCosmetic(item)) {
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

  res.json({
    ok: true,
    equipped: {
      ...equippedCriticalIds(user.id),
      turnStart: equippedTurnStartId(user.id),
    },
    equippedEffects: {
      ...criticalEffectsForUser(user.id),
      turnStart: turnStartEffectForUser(user.id),
    },
  });
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
    return res.json({ effect: kind === "nat20" ? "golden" : "fracture" });
  }

  const effects = criticalEffectsForUser(roller.user_id);
  res.json({ effect: effects[kind] });
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
shopRouter.post("/dev/grant", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  if (process.env.NODE_ENV === "production") return res.status(404).json({ error: "Not found" });

  const requested = Number(req.body?.amount ?? 500);
  const amount = Math.max(1, Math.min(5000, Math.floor(requested)));

  ensureWallet(user.id);
  db.prepare("UPDATE user_wallets SET balance = balance + ? WHERE user_id = ?").run(amount, user.id);
  db.prepare(
    `INSERT INTO vcoin_transactions (user_id, amount, reason, reference)
     VALUES (?, ?, 'Development test grant', 'dev-grant')`
  ).run(user.id, amount);

  res.json({ ok: true, balance: walletBalance(user.id) });
});

import { Router } from "express";
import { db } from "./db.js";
import { getSessionUser } from "./auth.js";

export const shopRouter = Router();

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
] as const;

type Cosmetic = (typeof COSMETICS)[number];

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
    items: COSMETICS.map((item) => presentItem(user.id, item, bypass.active)),
  });
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

  const purchase = db.transaction(() => {
    const balance = walletBalance(user.id);
    if (balance < item.price) {
      return { ok: false as const, balance };
    }

    const unlock = db.prepare(
      `INSERT OR IGNORE INTO cosmetic_unlocks (user_id, cosmetic_id)
       VALUES (?, ?)`
    ).run(user.id, item.id);

    if (Number(unlock.changes) === 0) {
      return { ok: true as const, balance, alreadyOwned: true };
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

    return {
      ok: true as const,
      balance: balance - item.price,
      alreadyOwned: false,
    };
  });

  const result = purchase();
  if (!result.ok) {
    return res.status(409).json({
      error: `You need ${item.price - result.balance} more VCoins for ${item.name}.`,
      balance: result.balance,
    });
  }

  res.json({
    ok: true,
    balance: result.balance,
    alreadyOwned: result.alreadyOwned,
    item: presentItem(user.id, item, false),
  });
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


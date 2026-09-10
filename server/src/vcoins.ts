import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { getIo } from "./realtime.js";
import { achievements } from "./achievements.js";

const user = (req: Request) => (req as any).user as SessionUser;
const isDMRole = (role: string | null) => role === "dm" || role === "co-dm";

export const DEFAULT_QUEST_VCOINS = 25;
export const MAX_QUEST_VCOINS = 500;
const MAX_MANUAL_AWARD = 500;

// Older installs already have the quests table, so add the configurable reward
// column in place without replacing or rebuilding campaign data.
const questColumns = db.prepare("PRAGMA table_info(quests)").all() as { name: string }[];
if (!questColumns.some((column) => column.name === "vcoin_reward")) {
  db.exec(`ALTER TABLE quests ADD COLUMN vcoin_reward INTEGER NOT NULL DEFAULT ${DEFAULT_QUEST_VCOINS}`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS quest_vcoin_rewards (
    quest_id      INTEGER PRIMARY KEY REFERENCES quests(id) ON DELETE CASCADE,
    campaign_id   INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    awarded_by    INTEGER NOT NULL REFERENCES users(id),
    amount        INTEGER NOT NULL DEFAULT 25,
    awarded_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vcoin_reward_events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id    INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    awarded_by     INTEGER NOT NULL REFERENCES users(id),
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    amount          INTEGER NOT NULL CHECK (amount > 0),
    reason          TEXT NOT NULL,
    source          TEXT NOT NULL CHECK (source IN ('dm','quest')),
    reference       TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_vcoin_reward_events_campaign
    ON vcoin_reward_events (campaign_id, id);
`);

function ensureWallet(userId: number) {
  db.prepare(
    `INSERT OR IGNORE INTO user_wallets (user_id, balance)
     VALUES (?, 0)`
  ).run(userId);
}

function eligibleMembers(campaignId: number): { user_id: number; display_name: string; role: string }[] {
  return db
    .prepare(
      `SELECT m.user_id, u.display_name, m.role
       FROM campaign_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.campaign_id = ? AND m.role <> 'spectator'
       ORDER BY u.display_name`
    )
    .all(campaignId) as { user_id: number; display_name: string; role: string }[];
}

function credit(userId: number, amount: number, reason: string, reference: string) {
  ensureWallet(userId);
  db.prepare(
    `UPDATE user_wallets
     SET balance = balance + ?
     WHERE user_id = ?`
  ).run(amount, userId);
  db.prepare(
    `INSERT INTO vcoin_transactions (user_id, amount, reason, reference)
     VALUES (?, ?, ?, ?)`
  ).run(userId, amount, reason, reference);
}

function broadcast(campaignId: number, source: "dm" | "quest") {
  getIo().to(`campaign:${campaignId}`).emit("vcoin:reward", {
    campaignId,
    source,
    at: Date.now(),
  });
}

export function awardQuestCompletion(
  campaignId: number,
  questId: number,
  questTitle: string,
  requestedAmount: number,
  awardedBy: number
): { awarded: boolean; amount: number; recipientCount: number } {
  const amount = Math.max(0, Math.min(MAX_QUEST_VCOINS, Math.floor(requestedAmount)));
  const reason = `Quest completed: ${questTitle}`;
  const recipients = eligibleMembers(campaignId);

  db.exec("BEGIN IMMEDIATE");
  try {
    const claim = db.prepare(
      `INSERT OR IGNORE INTO quest_vcoin_rewards
         (quest_id, campaign_id, awarded_by, amount)
       VALUES (?, ?, ?, ?)`
    ).run(questId, campaignId, awardedBy, amount);

    if (Number(claim.changes) === 0) {
      const existing = db
        .prepare("SELECT amount FROM quest_vcoin_rewards WHERE quest_id = ?")
        .get(questId) as { amount: number } | undefined;
      db.exec("COMMIT");
      return { awarded: false, amount: Number(existing?.amount ?? amount), recipientCount: 0 };
    }

    achievements.recordQuest(recipients.map((recipient) => recipient.user_id));

    if (amount > 0) {
      for (const recipient of recipients) {
        credit(recipient.user_id, amount, reason, `quest:${questId}`);
      }

      db.prepare(
        `INSERT INTO vcoin_reward_events
           (campaign_id, awarded_by, target_user_id, amount, reason, source, reference)
         VALUES (?, ?, NULL, ?, ?, 'quest', ?)`
      ).run(campaignId, awardedBy, amount, reason, `quest:${questId}`);
    }

    db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }

  if (amount > 0) broadcast(campaignId, "quest");
  return { awarded: true, amount, recipientCount: amount > 0 ? recipients.length : 0 };
}

export const vcoinRewardsRouter = Router();
vcoinRewardsRouter.use(requireAuth);

vcoinRewardsRouter.get("/:id/vcoins/rewards", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) {
    return res.status(403).json({ error: "Only the DM can view VCoin rewards." });
  }

  const rows = db
    .prepare(
      `SELECT e.id, e.amount, e.reason, e.source, e.created_at,
              giver.display_name AS awarded_by_name,
              target.display_name AS target_name
       FROM vcoin_reward_events e
       JOIN users giver ON giver.id = e.awarded_by
       LEFT JOIN users target ON target.id = e.target_user_id
       WHERE e.campaign_id = ?
       ORDER BY e.id DESC
       LIMIT 12`
    )
    .all(campaignId) as any[];

  res.json({
    rewards: rows.map((row) => ({
      id: Number(row.id),
      amount: Number(row.amount),
      reason: String(row.reason),
      source: row.source === "quest" ? "quest" : "dm",
      createdAt: String(row.created_at),
      awardedByName: String(row.awarded_by_name),
      targetName: row.target_name ? String(row.target_name) : null,
    })),
  });
});

vcoinRewardsRouter.post("/:id/vcoins/award", (req, res) => {
  const campaignId = Number(req.params.id);
  const gm = user(req);
  const role = memberRole(campaignId, gm.id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) {
    return res.status(403).json({ error: "Only the DM can award VCoins." });
  }

  const amount = Number(req.body?.amount);
  const reason = String(req.body?.reason ?? "").trim();
  const targetRaw = req.body?.targetUserId;

  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_MANUAL_AWARD) {
    return res.status(400).json({
      error: `Choose a VCoin amount from 1 to ${MAX_MANUAL_AWARD}.`,
    });
  }
  if (!reason) return res.status(400).json({ error: "Add a reason for the reward." });
  if (reason.length > 120) {
    return res.status(400).json({ error: "Reward reasons can be up to 120 characters." });
  }

  const all = eligibleMembers(campaignId);
  let recipients = all;
  let targetUserId: number | null = null;

  if (targetRaw !== null && targetRaw !== undefined && targetRaw !== "" && targetRaw !== "everyone") {
    targetUserId = Number(targetRaw);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "Choose a valid campaign member." });
    }
    recipients = all.filter((member) => member.user_id === targetUserId);
    if (recipients.length === 0) {
      return res.status(404).json({ error: "That member cannot receive campaign VCoins." });
    }
  }

  if (recipients.length === 0) {
    return res.status(409).json({ error: "There are no eligible campaign members to reward." });
  }

  db.exec("BEGIN IMMEDIATE");
  let eventId = 0;
  try {
    const event = db.prepare(
      `INSERT INTO vcoin_reward_events
         (campaign_id, awarded_by, target_user_id, amount, reason, source, reference)
       VALUES (?, ?, ?, ?, ?, 'dm', '')`
    ).run(campaignId, gm.id, targetUserId, amount, reason);
    eventId = Number(event.lastInsertRowid);

    const transactionReason = `DM reward: ${reason}`;
    for (const recipient of recipients) {
      credit(recipient.user_id, amount, transactionReason, `reward:${eventId}`);
    }

    db.prepare(
      `UPDATE vcoin_reward_events
       SET reference = ?
       WHERE id = ?`
    ).run(`reward:${eventId}`, eventId);

    db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }

  broadcast(campaignId, "dm");
  res.json({
    ok: true,
    eventId,
    amount,
    recipientCount: recipients.length,
    targetName: targetUserId ? recipients[0]?.display_name ?? null : null,
  });
});

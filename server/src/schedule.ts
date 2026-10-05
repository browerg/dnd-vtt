import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { getIo } from "./realtime.js";
import { discordWebhook, postToDiscord } from "./discord.js";

// Next-session scheduler: everyone marks the days they can play, the GM
// sees where they overlap, locks one in, and it goes out on Discord.
// Days are plain calendar dates ("2026-10-11") in each player's own local
// calendar; the locked-in time is an absolute instant, which Discord then
// shows in every reader's own time zone.

const user = (req: Request) => (req as any).user as SessionUser;
const isDMRole = (role: string | null) => role === "dm" || role === "co-dm";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(["yes", "maybe", "no"]);
const GOLD = 0xcfa64f;

function touch(campaignId: number) {
  getIo().to(`campaign:${campaignId}`).emit("schedule:update", { campaignId });
}

function namesFor(campaignId: number, day: string, status: string): string[] {
  return (
    db
      .prepare(
        `SELECT u.display_name AS name FROM session_availability a JOIN users u ON u.id = a.user_id
         WHERE a.campaign_id = ? AND a.day = ? AND a.status = ? ORDER BY u.display_name`
      )
      .all(campaignId, day, status) as { name: string }[]
  ).map((r) => r.name);
}

export const scheduleRouter = Router();
scheduleRouter.use(requireAuth);

scheduleRouter.get("/:id/schedule", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const from = DAY.test(String(req.query.from)) ? String(req.query.from) : new Date().toISOString().slice(0, 10);
  // Old marks are useless; prune anything a month stale while we're here.
  db.prepare("DELETE FROM session_availability WHERE campaign_id = ? AND day < date(?, '-30 days')").run(campaignId, from);
  const members = db
    .prepare(
      `SELECT m.user_id AS userId, m.role, u.display_name AS name FROM campaign_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.campaign_id = ? AND m.role != 'spectator'
       ORDER BY CASE WHEN m.role IN ('dm','co-dm') THEN 0 ELSE 1 END, u.display_name`
    )
    .all(campaignId);
  const availability = db
    .prepare("SELECT user_id AS userId, day, status FROM session_availability WHERE campaign_id = ? AND day >= ?")
    .all(campaignId, from);
  const campaign = db.prepare("SELECT next_session_at FROM campaigns WHERE id = ?").get(campaignId) as any;
  res.json({
    members,
    availability,
    nextSessionAt: campaign?.next_session_at || null,
    discord: isDMRole(role) ? discordWebhook().status : undefined,
  });
});

scheduleRouter.put("/:id/schedule/availability", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (role === "spectator") return res.status(403).json({ error: "Spectators don't mark availability." });
  const day = String(req.body?.day ?? "");
  if (!DAY.test(day)) return res.status(400).json({ error: "Pick a day." });
  const status = req.body?.status;
  if (status == null || status === "") {
    db.prepare("DELETE FROM session_availability WHERE campaign_id = ? AND user_id = ? AND day = ?").run(
      campaignId,
      user(req).id,
      day
    );
  } else {
    if (!STATUSES.has(status)) return res.status(400).json({ error: "Status must be yes, maybe or no." });
    db.prepare(
      `INSERT INTO session_availability (campaign_id, user_id, day, status) VALUES (?, ?, ?, ?)
       ON CONFLICT (campaign_id, user_id, day) DO UPDATE SET status = excluded.status`
    ).run(campaignId, user(req).id, day, status);
  }
  touch(campaignId);
  res.json({ ok: true });
});

scheduleRouter.post("/:id/schedule/lock", async (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the GM locks in the session." });
  const at = new Date(String(req.body?.at ?? ""));
  const day = String(req.body?.day ?? "");
  if (Number.isNaN(at.getTime())) return res.status(400).json({ error: "Pick a date and time." });
  db.prepare("UPDATE campaigns SET next_session_at = ? WHERE id = ?").run(at.toISOString(), campaignId);
  touch(campaignId);

  const campaign = db.prepare("SELECT name, session_number FROM campaigns WHERE id = ?").get(campaignId) as any;
  const unix = Math.floor(at.getTime() / 1000);
  const fields: { name: string; value: string; inline?: boolean }[] = [];
  if (DAY.test(day)) {
    const yes = namesFor(campaignId, day, "yes");
    const maybe = namesFor(campaignId, day, "maybe");
    if (yes.length) fields.push({ name: "Who's in", value: yes.join(", ").slice(0, 1000), inline: true });
    if (maybe.length) fields.push({ name: "Maybe", value: maybe.join(", ").slice(0, 1000), inline: true });
  }
  const discord = await postToDiscord({
    title: "📅 Next session locked in",
    description: `**${campaign?.name ?? "Your campaign"}**\n<t:${unix}:F> · <t:${unix}:R>`,
    color: GOLD,
    fields,
    footer: { text: "Vivid Realms · times show in your own time zone" },
  });
  res.json({ ok: true, nextSessionAt: at.toISOString(), discord });
});

scheduleRouter.delete("/:id/schedule/lock", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the GM manages the schedule." });
  db.prepare("UPDATE campaigns SET next_session_at = '' WHERE id = ?").run(campaignId);
  touch(campaignId);
  res.json({ ok: true });
});

// Nudge the group on Discord to fill in the grid.
scheduleRouter.post("/:id/schedule/ask", async (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the GM can ask." });
  const campaign = db.prepare("SELECT name FROM campaigns WHERE id = ?").get(campaignId) as any;
  const discord = await postToDiscord({
    title: "🗓️ When can you play?",
    description: `Mark the days you're free for **${campaign?.name ?? "the campaign"}**: open the campaign in Vivid Realms and go to **Schedule**.`,
    color: GOLD,
    footer: { text: "Vivid Realms" },
  });
  res.json({ ok: true, discord });
});

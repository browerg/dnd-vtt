import { Router, type Request } from "express";
import { randomBytes } from "node:crypto";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { getIo } from "./realtime.js";

const user = (req: Request) => (req as any).user as SessionUser;

export function memberRole(campaignId: number, userId: number): string | null {
  const row = db
    .prepare("SELECT role FROM campaign_members WHERE campaign_id = ? AND user_id = ?")
    .get(campaignId, userId) as { role: string } | undefined;
  return row?.role ?? null;
}

export const campaignsRouter = Router();
campaignsRouter.use(requireAuth);

campaignsRouter.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.description, c.system, m.role,
              (SELECT COUNT(*) FROM campaign_members WHERE campaign_id = c.id) AS member_count
       FROM campaigns c JOIN campaign_members m ON m.campaign_id = c.id
       WHERE m.user_id = ? ORDER BY c.created_at DESC`
    )
    .all(user(req).id);
  res.json({ campaigns: rows });
});

campaignsRouter.post("/", (req, res) => {
  const { name, description } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: "Campaign needs a name." });
  // Remnant is the house system; dnd5e is the tucked-away alternative.
  const system = req.body?.system === "dnd5e" ? "dnd5e" : "remnant";
  const info = db
    .prepare("INSERT INTO campaigns (name, description, system, created_by) VALUES (?, ?, ?, ?)")
    .run(name.trim(), (description ?? "").trim(), system, user(req).id);
  const id = Number(info.lastInsertRowid);
  db.prepare("INSERT INTO campaign_members (campaign_id, user_id, role) VALUES (?, ?, 'dm')").run(
    id,
    user(req).id
  );
  res.json({ id });
});

campaignsRouter.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const role = memberRole(id, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const campaign = db
    .prepare(
      `SELECT id, name, description, system, chapter, session_number, house_rules, announcement, created_at
       FROM campaigns WHERE id = ?`
    )
    .get(id);
  const members = db
    .prepare(
      `SELECT u.id, u.display_name, m.role FROM campaign_members m
       JOIN users u ON u.id = m.user_id WHERE m.campaign_id = ?
       ORDER BY CASE m.role WHEN 'dm' THEN 0 WHEN 'co-dm' THEN 1 WHEN 'player' THEN 2 ELSE 3 END,
                u.display_name`
    )
    .all(id);
  res.json({ campaign, members, yourRole: role });
});

campaignsRouter.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const role = memberRole(id, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (role !== "dm" && role !== "co-dm") {
    return res.status(403).json({ error: "Only the DM can edit the campaign hub." });
  }
  const b = req.body ?? {};
  const current = db
    .prepare(
      "SELECT name, description, chapter, session_number, house_rules, announcement FROM campaigns WHERE id = ?"
    )
    .get(id) as any;
  const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
  db.prepare(
    `UPDATE campaigns SET name = ?, description = ?, chapter = ?, session_number = ?,
     house_rules = ?, announcement = ? WHERE id = ?`
  ).run(
    str(b.name, current.name).trim() || current.name,
    str(b.description, current.description),
    str(b.chapter, current.chapter),
    Number.isInteger(b.sessionNumber) ? b.sessionNumber : current.session_number,
    str(b.houseRules, current.house_rules),
    str(b.announcement, current.announcement),
    id
  );
  getIo().to(`campaign:${id}`).emit("campaign:update", { campaignId: id });
  res.json({ ok: true });
});

campaignsRouter.post("/:id/invites", (req, res) => {
  const id = Number(req.params.id);
  const role = memberRole(id, user(req).id);
  if (role !== "dm" && role !== "co-dm") {
    return res.status(403).json({ error: "Only the DM can create invites." });
  }
  const inviteRole = ["co-dm", "player", "spectator"].includes(req.body?.role)
    ? req.body.role
    : "player";
  const code = randomBytes(6).toString("base64url");
  db.prepare("INSERT INTO invites (code, campaign_id, role, created_by) VALUES (?, ?, ?, ?)").run(
    code,
    id,
    inviteRole,
    user(req).id
  );
  res.json({ code, role: inviteRole });
});

export const invitesRouter = Router();
invitesRouter.use(requireAuth);

invitesRouter.get("/:code", (req, res) => {
  const invite = db
    .prepare(
      `SELECT i.code, i.role, c.id AS campaign_id, c.name, c.description
       FROM invites i JOIN campaigns c ON c.id = i.campaign_id WHERE i.code = ?`
    )
    .get(req.params.code);
  if (!invite) return res.status(404).json({ error: "This invite link is not valid." });
  res.json({ invite });
});

invitesRouter.post("/:code/join", (req, res) => {
  const invite = db
    .prepare("SELECT campaign_id, role FROM invites WHERE code = ?")
    .get(req.params.code) as { campaign_id: number; role: string } | undefined;
  if (!invite) return res.status(404).json({ error: "This invite link is not valid." });
  db.prepare(
    "INSERT OR IGNORE INTO campaign_members (campaign_id, user_id, role) VALUES (?, ?, ?)"
  ).run(invite.campaign_id, user(req).id, invite.role);
  res.json({ campaignId: invite.campaign_id });
});

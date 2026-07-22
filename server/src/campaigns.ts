import { Router, type Request } from "express";
import { randomBytes } from "node:crypto";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { getIo } from "./realtime.js";
import { seedGrimm } from "./grimm.js";

const user = (req: Request) => (req as any).user as SessionUser;

const REMNANT_THEMES = new Set([
  "huntsman-network",
  "beacon-academy",
  "atlas-command",
  "shade-academy",
  "haven-academy",
]);
const DND_THEMES = new Set([
  "academy-after-dark",
  "ancient-parchment",
  "arcane-observatory",
  "dungeon-stone",
  "minimal-dark",
]);
const defaultTheme = (system: string) =>
  system === "dnd5e" ? "academy-after-dark" : "huntsman-network";
const validTheme = (theme: unknown, system: string) =>
  typeof theme === "string" && (system === "dnd5e" ? DND_THEMES : REMNANT_THEMES).has(theme);

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
      `SELECT c.id, c.name, c.description, c.system, c.theme, m.role,
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
  const theme = defaultTheme(system);
  const info = db
    .prepare("INSERT INTO campaigns (name, description, system, theme, created_by) VALUES (?, ?, ?, ?, ?)")
    .run(name.trim(), (description ?? "").trim(), system, theme, user(req).id);
  const id = Number(info.lastInsertRowid);
  db.prepare("INSERT INTO campaign_members (campaign_id, user_id, role) VALUES (?, ?, 'dm')").run(
    id,
    user(req).id
  );
  if (system === "remnant") {
    try {
      seedGrimm(id);
    } catch (e) {
      console.warn("Grimm seed skipped:", (e as Error).message);
    }
  }
  res.json({ id });
});

campaignsRouter.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const role = memberRole(id, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const campaign = db
    .prepare(
      `SELECT id, name, description, system, theme, chapter, session_number, house_rules, announcement, notes_url, created_at
       FROM campaigns WHERE id = ?`
    )
    .get(id);
  const members = db
    .prepare(
      `SELECT u.id, u.display_name, u.avatar_path, m.role FROM campaign_members m
       JOIN users u ON u.id = m.user_id WHERE m.campaign_id = ?
       ORDER BY CASE m.role WHEN 'dm' THEN 0 WHEN 'co-dm' THEN 1 WHEN 'player' THEN 2 ELSE 3 END,
                u.display_name`
    )
    .all(id);
  res.json({ campaign, members, yourRole: role });
});

// Manual DM broadcast — pops a transient toast for everyone in the campaign.
// Not persisted; purely a live notification over the campaign socket room.
campaignsRouter.post("/:id/announce", (req, res) => {
  const id = Number(req.params.id);
  const role = memberRole(id, user(req).id);
  if (role !== "dm" && role !== "co-dm") {
    return res.status(403).json({ error: "Only the DM can send announcements." });
  }
  const message = String(req.body?.message ?? "").trim();
  const kind = ["info", "combat", "quest", "alert"].includes(req.body?.kind)
    ? req.body.kind
    : "info";
  if (!message) return res.status(400).json({ error: "Announcement can't be empty." });
  if (message.length > 200) {
    return res.status(400).json({ error: "Announcement is too long (200 characters max)." });
  }
  getIo().to(`campaign:${id}`).emit("announcement:push", {
    campaignId: id,
    message,
    kind,
    at: Date.now(),
    from: user(req).display_name,
  });
  res.json({ ok: true });
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
      "SELECT name, description, system, theme, chapter, session_number, house_rules, announcement, notes_url FROM campaigns WHERE id = ?"
    )
    .get(id) as any;
  const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
  const nextTheme = validTheme(b.theme, current.system) ? b.theme : current.theme || defaultTheme(current.system);
  db.prepare(
    `UPDATE campaigns SET name = ?, description = ?, chapter = ?, session_number = ?,
     house_rules = ?, announcement = ?, notes_url = ?, theme = ? WHERE id = ?`
  ).run(
    str(b.name, current.name).trim() || current.name,
    str(b.description, current.description),
    str(b.chapter, current.chapter),
    Number.isInteger(b.sessionNumber) ? b.sessionNumber : current.session_number,
    str(b.houseRules, current.house_rules),
    str(b.announcement, current.announcement),
    (() => {
      const candidate = str(b.notesUrl, current.notes_url).trim();
      if (!candidate) return "";
      try {
        const url = new URL(candidate);
        return url.protocol === "https:" ? url.toString() : current.notes_url;
      } catch {
        return current.notes_url;
      }
    })(),
    nextTheme,
    id
  );
  getIo().to(`campaign:${id}`).emit("campaign:update", { campaignId: id });
  res.json({ ok: true });
});

campaignsRouter.get("/:id/dashboard-layout", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });

  const row = db.prepare(
    "SELECT layout FROM dashboard_layouts WHERE campaign_id = ? AND user_id = ?"
  ).get(campaignId, user(req).id) as { layout: string } | undefined;

  if (!row) return res.json({ layout: null });

  try {
    const layout = JSON.parse(row.layout);
    res.json({ layout: Array.isArray(layout) ? layout : null });
  } catch {
    res.json({ layout: null });
  }
});

campaignsRouter.put("/:id/dashboard-layout", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });

  const layout = req.body?.layout;
  if (!Array.isArray(layout) || layout.length > 30) {
    return res.status(400).json({ error: "Invalid dashboard layout." });
  }

  const clean = layout
    .map((item: any) => ({
      i: String(item?.i ?? "").slice(0, 40),
      x: Number(item?.x) || 0,
      y: Number(item?.y) || 0,
      w: Math.max(1, Number(item?.w) || 1),
      h: Math.max(1, Number(item?.h) || 1),
      ...(Number.isFinite(Number(item?.minW)) ? { minW: Math.max(1, Number(item.minW)) } : {}),
      ...(Number.isFinite(Number(item?.minH)) ? { minH: Math.max(1, Number(item.minH)) } : {}),
    }))
    .filter((item: any) => item.i);

  db.prepare(`
    INSERT INTO dashboard_layouts (campaign_id, user_id, layout, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(campaign_id, user_id)
    DO UPDATE SET layout = excluded.layout, updated_at = datetime('now')
  `).run(campaignId, user(req).id, JSON.stringify(clean));

  res.json({ ok: true });
});

campaignsRouter.delete("/:id/dashboard-layout", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });

  db.prepare(
    "DELETE FROM dashboard_layouts WHERE campaign_id = ? AND user_id = ?"
  ).run(campaignId, user(req).id);

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

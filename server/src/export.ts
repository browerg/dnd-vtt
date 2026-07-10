import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";

// Full-campaign JSON backup. Uploaded media files aren't embedded — the
// export references their /uploads paths; back the uploads folder up
// separately (it lives at server/data/uploads).

const user = (req: Request) => (req as any).user as SessionUser;

export const exportRouter = Router();
exportRouter.use(requireAuth);

exportRouter.get("/:id/export", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (role !== "dm" && role !== "co-dm") {
    return res.status(403).json({ error: "Only the DM can export the campaign." });
  }

  const one = (sql: string) => db.prepare(sql).get(campaignId);
  const many = (sql: string) => db.prepare(sql).all(campaignId);

  const campaign = one("SELECT * FROM campaigns WHERE id = ?") as any;
  const data = {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    campaign,
    members: many(
      `SELECT m.user_id, u.display_name, u.email, m.role, m.joined_at
       FROM campaign_members m JOIN users u ON u.id = m.user_id WHERE m.campaign_id = ?`
    ),
    characters: (many("SELECT * FROM characters WHERE campaign_id = ?") as any[]).map((c) => ({
      ...c,
      data: JSON.parse(c.data),
    })),
    maps: (many("SELECT * FROM maps WHERE campaign_id = ?") as any[]).map((m) => ({
      ...m,
      fog_data: JSON.parse(m.fog_data ?? "[]"),
    })),
    tokens: many(
      "SELECT t.* FROM tokens t JOIN maps m ON m.id = t.map_id WHERE m.campaign_id = ?"
    ),
    quests: many("SELECT * FROM quests WHERE campaign_id = ?"),
    npcs: many("SELECT * FROM npcs WHERE campaign_id = ?"),
    journal: many(
      `SELECT j.*, u.display_name AS author FROM journal_entries j
       JOIN users u ON u.id = j.user_id WHERE j.campaign_id = ?`
    ),
    handouts: many("SELECT * FROM handouts WHERE campaign_id = ?"),
    messages: many(
      `SELECT m.*, u.display_name AS author FROM messages m
       JOIN users u ON u.id = m.user_id WHERE m.campaign_id = ? ORDER BY m.id`
    ),
    rolls: (many(
      `SELECT r.*, u.display_name AS roller FROM rolls r
       JOIN users u ON u.id = r.user_id WHERE r.campaign_id = ? ORDER BY r.id`
    ) as any[]).map((r) => ({ ...r, detail: JSON.parse(r.detail) })),
    combatants: many("SELECT * FROM combatants WHERE campaign_id = ?"),
  };

  const slug = String(campaign.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${slug || "campaign"}-${stamp}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

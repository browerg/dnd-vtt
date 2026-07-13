import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";

const user = (req: Request) => (req as any).user as SessionUser;
const MAX_NOTES_BYTES = 100_000;

// Per-player session notepad, one private doc per campaign. Never shared — not
// even the DM sees a player's notes.
export const notesRouter = Router();
notesRouter.use(requireAuth);

notesRouter.get("/:id/notes", (req, res) => {
  const campaignId = Number(req.params.id);
  if (!memberRole(campaignId, user(req).id)) return res.status(404).json({ error: "Campaign not found." });
  const row = db
    .prepare("SELECT body, updated_at FROM session_notes WHERE campaign_id = ? AND user_id = ?")
    .get(campaignId, user(req).id) as { body: string; updated_at: string } | undefined;
  res.json({ body: row?.body ?? "", updatedAt: row?.updated_at ?? null });
});

notesRouter.put("/:id/notes", (req, res) => {
  const campaignId = Number(req.params.id);
  if (!memberRole(campaignId, user(req).id)) return res.status(404).json({ error: "Campaign not found." });
  const body = String(req.body?.body ?? "");
  if (body.length > MAX_NOTES_BYTES) return res.status(400).json({ error: "These notes are too long." });
  db.prepare(
    `INSERT INTO session_notes (campaign_id, user_id, body, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(campaign_id, user_id) DO UPDATE SET body = excluded.body, updated_at = datetime('now')`
  ).run(campaignId, user(req).id, body);
  res.json({ ok: true });
});

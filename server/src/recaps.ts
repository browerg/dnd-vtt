import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { getIo } from "./realtime.js";

// "Previously on…": the GM publishes a short recap at the end of (or before)
// a session, and players see it the next time they open the campaign. The
// GM's draft is pre-filled with what happened since the last recap.

const user = (req: Request) => (req as any).user as SessionUser;
const isDMRole = (role: string | null) => role === "dm" || role === "co-dm";

export type HighlightKind = "quest" | "handout" | "roll" | "journal" | "note";
export interface Highlight {
  kind: HighlightKind;
  text: string;
}

const KINDS = new Set<HighlightKind>(["quest", "handout", "roll", "journal", "note"]);
const MAX_HIGHLIGHTS = 20;

function cleanHighlights(value: unknown): Highlight[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((h: any) => ({
      kind: KINDS.has(h?.kind) ? (h.kind as HighlightKind) : "note",
      text: String(h?.text ?? "").trim().slice(0, 200),
    }))
    .filter((h) => h.text)
    .slice(0, MAX_HIGHLIGHTS);
}

function recapJson(r: any) {
  return {
    id: r.id,
    sessionNumber: r.session_number,
    title: r.title,
    body: r.body,
    highlights: cleanHighlights(JSON.parse(r.highlights || "[]")),
    authorId: r.created_by ?? null,
    authorName: r.author_name ?? "",
    createdAt: r.created_at,
  };
}

const RECAP_SELECT = `SELECT r.*, u.display_name AS author_name FROM session_recaps r
  LEFT JOIN users u ON u.id = r.created_by`;

/** Everything worth mentioning since `since` (a SQLite datetime string). */
export function recapSuggestions(campaignId: number, since: string): Highlight[] {
  const out: Highlight[] = [];

  const quests = db
    .prepare(
      `SELECT title, status, created_at, status_changed_at FROM quests
       WHERE campaign_id = ? AND hidden = 0
         AND (created_at >= ? OR status_changed_at >= ?)
       ORDER BY COALESCE(status_changed_at, created_at)`
    )
    .all(campaignId, since, since) as any[];
  for (const q of quests) {
    if (q.status_changed_at && q.status_changed_at >= since && q.status !== "active") {
      out.push({ kind: "quest", text: `Quest ${q.status}: ${q.title}` });
    } else if (q.created_at >= since) {
      out.push({ kind: "quest", text: `New quest: ${q.title}` });
    }
  }

  const handouts = db
    .prepare(
      `SELECT name FROM handouts WHERE campaign_id = ? AND revealed = 1 AND revealed_at >= ? ORDER BY revealed_at`
    )
    .all(campaignId, since) as any[];
  for (const h of handouts) out.push({ kind: "handout", text: `Discovered: ${h.name}` });

  // Public critical rolls — the moments people retell. The server stamps
  // each roll with its critical (see criticalOf); older rolls predate that
  // and fall back to a single d20 showing 1 or 20.
  const crits = db
    .prepare(
      `SELECT u.display_name AS who, r.label,
              COALESCE(json_extract(r.detail, '$.critical'),
                CASE json_extract(r.detail, '$.kept.groups[0].results[0]') WHEN 20 THEN 'nat20' ELSE 'nat1' END) AS kind
       FROM rolls r JOIN users u ON u.id = r.user_id
       WHERE r.campaign_id = ? AND r.visibility = 'public' AND r.created_at >= ?
         AND (
           json_extract(r.detail, '$.critical') IN ('nat20', 'nat1')
           OR (json_type(r.detail, '$.critical') IS NULL
               AND json_array_length(r.detail, '$.kept.groups') = 1
               AND json_extract(r.detail, '$.kept.groups[0].sides') = 20
               AND json_extract(r.detail, '$.kept.groups[0].count') = 1
               AND json_extract(r.detail, '$.kept.groups[0].results[0]') IN (1, 20))
         )
       ORDER BY r.id LIMIT 6`
    )
    .all(campaignId, since) as any[];
  const system = (db.prepare("SELECT system FROM campaigns WHERE id = ?").get(campaignId) as any)?.system;
  for (const c of crits) {
    const what = c.label ? ` on ${c.label}` : "";
    const moment =
      system === "remnant"
        ? c.kind === "nat20" ? "rolled double 10s" : "rolled double 1s"
        : c.kind === "nat20" ? "rolled a natural 20" : "rolled a natural 1";
    out.push({ kind: "roll", text: `${c.who} ${moment}${what}` });
  }

  const journal = db
    .prepare(
      `SELECT j.title, u.display_name AS who FROM journal_entries j JOIN users u ON u.id = j.user_id
       WHERE j.campaign_id = ? AND j.created_at >= ? ORDER BY j.id LIMIT 6`
    )
    .all(campaignId, since) as any[];
  for (const j of journal) out.push({ kind: "journal", text: `${j.who}'s journal: ${j.title}` });

  return out.slice(0, MAX_HIGHLIGHTS);
}

export const recapsRouter = Router();
recapsRouter.use(requireAuth);

recapsRouter.get("/:id/recaps", (req, res) => {
  const campaignId = Number(req.params.id);
  if (!memberRole(campaignId, user(req).id)) return res.status(404).json({ error: "Campaign not found." });
  const rows = db
    .prepare(`${RECAP_SELECT} WHERE r.campaign_id = ? ORDER BY r.id DESC LIMIT 20`)
    .all(campaignId) as any[];
  res.json({ recaps: rows.map(recapJson) });
});

recapsRouter.get("/:id/recaps/draft", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the GM writes recaps." });
  const last = db
    .prepare("SELECT created_at FROM session_recaps WHERE campaign_id = ? ORDER BY id DESC LIMIT 1")
    .get(campaignId) as { created_at: string } | undefined;
  const since =
    last?.created_at ??
    (db.prepare("SELECT datetime('now', '-14 days') AS t").get() as { t: string }).t;
  const campaign = db.prepare("SELECT session_number FROM campaigns WHERE id = ?").get(campaignId) as any;
  res.json({
    since,
    sessionNumber: campaign?.session_number ?? 0,
    highlights: recapSuggestions(campaignId, since),
  });
});

recapsRouter.post("/:id/recaps", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the GM writes recaps." });
  const title = String(req.body?.title ?? "").trim().slice(0, 120);
  const body = String(req.body?.body ?? "").trim().slice(0, 4000);
  const highlights = cleanHighlights(req.body?.highlights);
  if (!title) return res.status(400).json({ error: "Give the recap a title." });
  if (!body && highlights.length === 0) return res.status(400).json({ error: "Write a summary or keep at least one highlight." });
  const campaign = db.prepare("SELECT session_number FROM campaigns WHERE id = ?").get(campaignId) as any;
  const result = db
    .prepare(
      "INSERT INTO session_recaps (campaign_id, session_number, title, body, highlights, created_by) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(campaignId, campaign?.session_number ?? 0, title, body, JSON.stringify(highlights), user(req).id);
  const row = db.prepare(`${RECAP_SELECT} WHERE r.id = ?`).get(Number(result.lastInsertRowid));
  getIo().to(`campaign:${campaignId}`).emit("recap:published", { campaignId, recap: recapJson(row) });
  res.json({ recap: recapJson(row) });
});

recapsRouter.delete("/:id/recaps/:rid", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the GM manages recaps." });
  db.prepare("DELETE FROM session_recaps WHERE id = ? AND campaign_id = ?").run(Number(req.params.rid), campaignId);
  res.json({ ok: true });
});

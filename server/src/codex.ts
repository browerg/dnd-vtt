import { Router, type Request } from "express";
import multer from "multer";
import { randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { db, uploadsDir } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { getIo } from "./realtime.js";

// Campaign codex: quests, NPCs, journal, handouts. Quests/NPCs/handouts are
// DM-authored with per-item hiding; the journal belongs to everyone.

const user = (req: Request) => (req as any).user as SessionUser;
const isDMRole = (role: string | null) => role === "dm" || role === "co-dm";

function touch(campaignId: number, kind: string) {
  getIo().to(`campaign:${campaignId}`).emit("codex:update", { campaignId, kind });
}

function roleOr404(req: Request, res: any): string | null {
  const role = memberRole(Number(req.params.id), user(req).id);
  if (!role) res.status(404).json({ error: "Campaign not found." });
  return role;
}

const HANDOUT_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const handoutUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) =>
      cb(null, `${randomBytes(12).toString("hex")}${HANDOUT_TYPES[file.mimetype] ?? ".png"}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in HANDOUT_TYPES),
});

export const codexRouter = Router();
codexRouter.use(requireAuth);

// ---- quests ----

codexRouter.get("/:id/quests", (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  const campaignId = Number(req.params.id);
  const rows = db
    .prepare(
      `SELECT id, title, description, status, hidden, created_at FROM quests
       WHERE campaign_id = ? ${isDMRole(role) ? "" : "AND hidden = 0"} ORDER BY id DESC`
    )
    .all(campaignId) as any[];
  res.json({ quests: rows.map((r) => ({ ...r, hidden: !!r.hidden })) });
});

codexRouter.post("/:id/quests", (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM manages quests." });
  const title = String(req.body?.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "The quest needs a title." });
  const campaignId = Number(req.params.id);
  db.prepare("INSERT INTO quests (campaign_id, title, description, hidden) VALUES (?, ?, ?, ?)").run(
    campaignId,
    title,
    String(req.body?.description ?? "").trim(),
    req.body?.hidden ? 1 : 0
  );
  touch(campaignId, "quests");
  res.json({ ok: true });
});

codexRouter.put("/:id/quests/:qid", (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM manages quests." });
  const campaignId = Number(req.params.id);
  const q = db
    .prepare("SELECT * FROM quests WHERE id = ? AND campaign_id = ?")
    .get(Number(req.params.qid), campaignId) as any;
  if (!q) return res.status(404).json({ error: "Quest not found." });
  const b = req.body ?? {};
  db.prepare("UPDATE quests SET title = ?, description = ?, status = ?, hidden = ? WHERE id = ?").run(
    typeof b.title === "string" && b.title.trim() ? b.title.trim() : q.title,
    typeof b.description === "string" ? b.description : q.description,
    ["active", "completed", "failed"].includes(b.status) ? b.status : q.status,
    typeof b.hidden === "boolean" ? (b.hidden ? 1 : 0) : q.hidden,
    q.id
  );
  touch(campaignId, "quests");
  res.json({ ok: true });
});

codexRouter.delete("/:id/quests/:qid", (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM manages quests." });
  const campaignId = Number(req.params.id);
  db.prepare("DELETE FROM quests WHERE id = ? AND campaign_id = ?").run(Number(req.params.qid), campaignId);
  touch(campaignId, "quests");
  res.json({ ok: true });
});

// ---- NPCs ----

codexRouter.get("/:id/npcs", (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  const campaignId = Number(req.params.id);
  const dm = isDMRole(role);
  const rows = db
    .prepare(
      `SELECT id, name, description, location, alive, hidden, secret_notes FROM npcs
       WHERE campaign_id = ? ${dm ? "" : "AND hidden = 0"} ORDER BY name`
    )
    .all(campaignId) as any[];
  res.json({
    npcs: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      location: r.location,
      alive: !!r.alive,
      hidden: !!r.hidden,
      secretNotes: dm ? r.secret_notes : undefined,
    })),
  });
});

codexRouter.post("/:id/npcs", (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM manages NPCs." });
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "The NPC needs a name." });
  const campaignId = Number(req.params.id);
  db.prepare(
    "INSERT INTO npcs (campaign_id, name, description, location, hidden, secret_notes) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    campaignId,
    name,
    String(req.body?.description ?? "").trim(),
    String(req.body?.location ?? "").trim(),
    req.body?.hidden ? 1 : 0,
    String(req.body?.secretNotes ?? "").trim()
  );
  touch(campaignId, "npcs");
  res.json({ ok: true });
});

codexRouter.put("/:id/npcs/:nid", (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM manages NPCs." });
  const campaignId = Number(req.params.id);
  const n = db
    .prepare("SELECT * FROM npcs WHERE id = ? AND campaign_id = ?")
    .get(Number(req.params.nid), campaignId) as any;
  if (!n) return res.status(404).json({ error: "NPC not found." });
  const b = req.body ?? {};
  db.prepare(
    `UPDATE npcs SET name = ?, description = ?, location = ?, alive = ?, hidden = ?, secret_notes = ?
     WHERE id = ?`
  ).run(
    typeof b.name === "string" && b.name.trim() ? b.name.trim() : n.name,
    typeof b.description === "string" ? b.description : n.description,
    typeof b.location === "string" ? b.location : n.location,
    typeof b.alive === "boolean" ? (b.alive ? 1 : 0) : n.alive,
    typeof b.hidden === "boolean" ? (b.hidden ? 1 : 0) : n.hidden,
    typeof b.secretNotes === "string" ? b.secretNotes : n.secret_notes,
    n.id
  );
  touch(campaignId, "npcs");
  res.json({ ok: true });
});

codexRouter.delete("/:id/npcs/:nid", (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM manages NPCs." });
  const campaignId = Number(req.params.id);
  db.prepare("DELETE FROM npcs WHERE id = ? AND campaign_id = ?").run(Number(req.params.nid), campaignId);
  touch(campaignId, "npcs");
  res.json({ ok: true });
});

// ---- journal ----

codexRouter.get("/:id/journal", (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  const campaignId = Number(req.params.id);
  const rows = db
    .prepare(
      `SELECT j.id, j.user_id, u.display_name, j.title, j.body, j.created_at
       FROM journal_entries j JOIN users u ON u.id = j.user_id
       WHERE j.campaign_id = ? ORDER BY j.id DESC`
    )
    .all(campaignId) as any[];
  res.json({
    entries: rows.map((r) => ({
      id: r.id,
      authorId: r.user_id,
      authorName: r.display_name,
      title: r.title,
      body: r.body,
      createdAt: r.created_at,
    })),
  });
});

codexRouter.post("/:id/journal", (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  if (role === "spectator") return res.status(403).json({ error: "Spectators can't write journal entries." });
  const title = String(req.body?.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "The entry needs a title." });
  const campaignId = Number(req.params.id);
  db.prepare("INSERT INTO journal_entries (campaign_id, user_id, title, body) VALUES (?, ?, ?, ?)").run(
    campaignId,
    user(req).id,
    title,
    String(req.body?.body ?? "").trim()
  );
  touch(campaignId, "journal");
  res.json({ ok: true });
});

codexRouter.delete("/:id/journal/:jid", (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  const campaignId = Number(req.params.id);
  const entry = db
    .prepare("SELECT user_id FROM journal_entries WHERE id = ? AND campaign_id = ?")
    .get(Number(req.params.jid), campaignId) as any;
  if (!entry) return res.status(404).json({ error: "Entry not found." });
  if (entry.user_id !== user(req).id && !isDMRole(role)) {
    return res.status(403).json({ error: "Only the author or the DM can delete this." });
  }
  db.prepare("DELETE FROM journal_entries WHERE id = ?").run(Number(req.params.jid));
  touch(campaignId, "journal");
  res.json({ ok: true });
});

// ---- handouts ----

codexRouter.get("/:id/handouts", (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  const campaignId = Number(req.params.id);
  const rows = db
    .prepare(
      `SELECT id, name, file_path, revealed FROM handouts
       WHERE campaign_id = ? ${isDMRole(role) ? "" : "AND revealed = 1"} ORDER BY id DESC`
    )
    .all(campaignId) as any[];
  res.json({
    handouts: rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: `/uploads/${path.basename(r.file_path)}`,
      isPdf: r.file_path.endsWith(".pdf"),
      revealed: !!r.revealed,
    })),
  });
});

codexRouter.post("/:id/handouts", handoutUpload.single("file"), (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM uploads handouts." });
  if (!req.file) return res.status(400).json({ error: "Attach an image or PDF." });
  const campaignId = Number(req.params.id);
  const name =
    String(req.body?.name ?? "").trim() || req.file.originalname.replace(/\.[^.]+$/, "") || "Handout";
  db.prepare("INSERT INTO handouts (campaign_id, name, file_path) VALUES (?, ?, ?)").run(
    campaignId,
    name,
    req.file.path
  );
  touch(campaignId, "handouts");
  res.json({ ok: true });
});

codexRouter.put("/:id/handouts/:hid", (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM manages handouts." });
  const campaignId = Number(req.params.id);
  const h = db
    .prepare("SELECT * FROM handouts WHERE id = ? AND campaign_id = ?")
    .get(Number(req.params.hid), campaignId) as any;
  if (!h) return res.status(404).json({ error: "Handout not found." });
  const revealed = typeof req.body?.revealed === "boolean" ? (req.body.revealed ? 1 : 0) : h.revealed;
  db.prepare("UPDATE handouts SET revealed = ? WHERE id = ?").run(revealed, h.id);
  touch(campaignId, "handouts");
  res.json({ ok: true });
});

codexRouter.delete("/:id/handouts/:hid", async (req, res) => {
  const role = roleOr404(req, res);
  if (!role) return;
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM manages handouts." });
  const campaignId = Number(req.params.id);
  const h = db
    .prepare("SELECT * FROM handouts WHERE id = ? AND campaign_id = ?")
    .get(Number(req.params.hid), campaignId) as any;
  if (!h) return res.status(404).json({ error: "Handout not found." });
  db.prepare("DELETE FROM handouts WHERE id = ?").run(h.id);
  await unlink(h.file_path).catch(() => {});
  touch(campaignId, "handouts");
  res.json({ ok: true });
});

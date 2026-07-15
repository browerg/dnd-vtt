import { Router, type Request } from "express";
import multer from "multer";
import { randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { db, uploadsDir } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { getIo } from "./realtime.js";

const user = (req: Request) => (req as any).user as SessionUser;
const isDMRole = (role: string | null) => role === "dm" || role === "co-dm";
const room = (campaignId: number) => `campaign:${campaignId}`;

const OBJECT_IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const objectUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) =>
      cb(null, `map-object-${randomBytes(12).toString("hex")}${OBJECT_IMAGE_TYPES[file.mimetype] ?? ".png"}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in OBJECT_IMAGE_TYPES),
});

const TYPES = new Set(["chest", "door", "trap", "switch", "clue", "terminal", "dust", "custom"]);
const STATES = new Set(["closed", "open", "locked", "unlocked", "armed", "disarmed", "active", "inactive"]);

const mapObject = (row: any, isDM: boolean) => ({
  id: row.id,
  mapId: row.map_id,
  type: row.type,
  name: row.name,
  description: row.description,
  dmNotes: isDM ? row.dm_notes : "",
  loot: row.loot,
  state: row.state,
  hidden: !!row.hidden,
  x: row.x,
  y: row.y,
  size: row.size,
  imageUrl: row.image_path ? `/uploads/${path.basename(row.image_path)}` : "",
  createdAt: row.created_at,
});

function emitChange(campaignId: number, mapId: number) {
  getIo().to(room(campaignId)).emit("map-object:update", { campaignId, mapId });
}

export const mapObjectsRouter = Router();
mapObjectsRouter.use(requireAuth);

mapObjectsRouter.get("/:id/maps/:mapId/objects", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });

  const map = db
    .prepare("SELECT id FROM maps WHERE id = ? AND campaign_id = ?")
    .get(Number(req.params.mapId), campaignId);
  if (!map) return res.status(404).json({ error: "Map not found." });

  const dm = isDMRole(role);
  const rows = db
    .prepare(`SELECT * FROM map_objects WHERE map_id = ? ${dm ? "" : "AND hidden = 0"} ORDER BY id`)
    .all(Number(req.params.mapId)) as any[];
  res.json({ objects: rows.map((row) => mapObject(row, dm)) });
});

mapObjectsRouter.post("/:id/maps/:mapId/objects", objectUpload.single("image"), async (req, res) => {
  const discard = () => req.file?.path && unlink(req.file.path).catch(() => {});
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) {
    await discard();
    return res.status(404).json({ error: "Campaign not found." });
  }
  if (!isDMRole(role)) {
    await discard();
    return res.status(403).json({ error: "Only the DM can add map objects." });
  }

  const mapId = Number(req.params.mapId);
  const map = db.prepare("SELECT id FROM maps WHERE id = ? AND campaign_id = ?").get(mapId, campaignId);
  if (!map) {
    await discard();
    return res.status(404).json({ error: "Map not found." });
  }

  const type = TYPES.has(String(req.body.type)) ? String(req.body.type) : "custom";
  const name = String(req.body.name ?? "").trim() || "Map object";
  const description = String(req.body.description ?? "").trim();
  const dmNotes = String(req.body.dmNotes ?? "").trim();
  const loot = String(req.body.loot ?? "").trim();
  const state = STATES.has(String(req.body.state)) ? String(req.body.state) : "closed";
  const hidden = String(req.body.hidden) === "true" ? 1 : 0;
  const x = Number.isFinite(Number(req.body.x)) ? Number(req.body.x) : 400;
  const y = Number.isFinite(Number(req.body.y)) ? Number(req.body.y) : 300;
  const size = Math.min(4, Math.max(0.5, Number(req.body.size) || 1));

  const result = db.prepare(`
    INSERT INTO map_objects
      (map_id, type, name, description, dm_notes, loot, state, hidden, x, y, size, image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(mapId, type, name, description, dmNotes, loot, state, hidden, x, y, size, req.file?.path ?? "");

  const row = db.prepare("SELECT * FROM map_objects WHERE id = ?").get(Number(result.lastInsertRowid)) as any;
  emitChange(campaignId, mapId);
  res.json({ object: mapObject(row, true) });
});

mapObjectsRouter.put("/:id/maps/:mapId/objects/:objectId", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can edit map objects." });

  const mapId = Number(req.params.mapId);
  const current = db.prepare(`
    SELECT o.* FROM map_objects o
    JOIN maps m ON m.id = o.map_id
    WHERE o.id = ? AND o.map_id = ? AND m.campaign_id = ?
  `).get(Number(req.params.objectId), mapId, campaignId) as any;
  if (!current) return res.status(404).json({ error: "Map object not found." });

  const body = req.body ?? {};
  const type = typeof body.type === "string" && TYPES.has(body.type) ? body.type : current.type;
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : current.name;
  const description = typeof body.description === "string" ? body.description : current.description;
  const dmNotes = typeof body.dmNotes === "string" ? body.dmNotes : current.dm_notes;
  const loot = typeof body.loot === "string" ? body.loot : current.loot;
  const state = typeof body.state === "string" && STATES.has(body.state) ? body.state : current.state;
  const hidden = typeof body.hidden === "boolean" ? (body.hidden ? 1 : 0) : current.hidden;
  const x = Number.isFinite(body.x) ? body.x : current.x;
  const y = Number.isFinite(body.y) ? body.y : current.y;
  const size = Number.isFinite(body.size) ? Math.min(4, Math.max(0.5, body.size)) : current.size;

  db.prepare(`
    UPDATE map_objects
    SET type = ?, name = ?, description = ?, dm_notes = ?, loot = ?, state = ?,
        hidden = ?, x = ?, y = ?, size = ?
    WHERE id = ?
  `).run(type, name, description, dmNotes, loot, state, hidden, x, y, size, current.id);

  const row = db.prepare("SELECT * FROM map_objects WHERE id = ?").get(current.id) as any;
  emitChange(campaignId, mapId);
  res.json({ object: mapObject(row, true) });
});

mapObjectsRouter.post("/:id/maps/:mapId/objects/:objectId/image", objectUpload.single("image"), async (req, res) => {
  const discard = () => req.file?.path && unlink(req.file.path).catch(() => {});
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role || !isDMRole(role)) {
    await discard();
    return res.status(role ? 403 : 404).json({ error: role ? "Only the DM can edit map objects." : "Campaign not found." });
  }
  if (!req.file) return res.status(400).json({ error: "Choose a PNG, JPG, or WebP image under 10 MB." });

  const mapId = Number(req.params.mapId);
  const current = db.prepare(`
    SELECT o.* FROM map_objects o JOIN maps m ON m.id = o.map_id
    WHERE o.id = ? AND o.map_id = ? AND m.campaign_id = ?
  `).get(Number(req.params.objectId), mapId, campaignId) as any;
  if (!current) {
    await discard();
    return res.status(404).json({ error: "Map object not found." });
  }

  db.prepare("UPDATE map_objects SET image_path = ? WHERE id = ?").run(req.file.path, current.id);
  if (current.image_path) await unlink(current.image_path).catch(() => {});
  emitChange(campaignId, mapId);
  const row = db.prepare("SELECT * FROM map_objects WHERE id = ?").get(current.id) as any;
  res.json({ object: mapObject(row, true) });
});

mapObjectsRouter.post("/:id/maps/:mapId/objects/:objectId/duplicate", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can duplicate map objects." });

  const mapId = Number(req.params.mapId);
  const current = db.prepare(`
    SELECT o.* FROM map_objects o JOIN maps m ON m.id = o.map_id
    WHERE o.id = ? AND o.map_id = ? AND m.campaign_id = ?
  `).get(Number(req.params.objectId), mapId, campaignId) as any;
  if (!current) return res.status(404).json({ error: "Map object not found." });

  const result = db.prepare(`
    INSERT INTO map_objects
      (map_id, type, name, description, dm_notes, loot, state, hidden, x, y, size, image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')
  `).run(mapId, current.type, `${current.name} copy`, current.description, current.dm_notes, current.loot,
    current.state, current.hidden, current.x + 40, current.y + 40, current.size);

  emitChange(campaignId, mapId);
  const row = db.prepare("SELECT * FROM map_objects WHERE id = ?").get(Number(result.lastInsertRowid)) as any;
  res.json({ object: mapObject(row, true) });
});

mapObjectsRouter.delete("/:id/maps/:mapId/objects/:objectId", async (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can delete map objects." });

  const mapId = Number(req.params.mapId);
  const current = db.prepare(`
    SELECT o.* FROM map_objects o JOIN maps m ON m.id = o.map_id
    WHERE o.id = ? AND o.map_id = ? AND m.campaign_id = ?
  `).get(Number(req.params.objectId), mapId, campaignId) as any;
  if (!current) return res.status(404).json({ error: "Map object not found." });

  db.prepare("DELETE FROM map_objects WHERE id = ?").run(current.id);
  if (current.image_path) await unlink(current.image_path).catch(() => {});
  emitChange(campaignId, mapId);
  res.json({ ok: true });
});

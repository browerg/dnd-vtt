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

// Static images plus looping video maps (animated water, torchlight, the
// TV-table stuff) — the client renders .mp4/.webm with a <video> element.
const MEDIA_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) =>
      cb(null, `${randomBytes(12).toString("hex")}${MEDIA_TYPES[file.mimetype] ?? ".png"}`),
  }),
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in MEDIA_TYPES),
});

export interface TokenPayload {
  id: number;
  mapId: number;
  characterId: number | null;
  ownerId: number | null;
  name: string;
  color: string;
  x: number;
  y: number;
  size: number;
  hp: number | null;
  maxHp: number | null;
}

const TOKEN_COLS = `
  t.id, t.map_id, t.character_id, t.name, t.color, t.x, t.y, t.size,
  c.user_id AS owner_id,
  json_extract(c.data, '$.hp') AS hp,
  json_extract(c.data, '$.maxHp') AS max_hp`;
const TOKEN_SELECT = `SELECT ${TOKEN_COLS}
  FROM tokens t LEFT JOIN characters c ON c.id = t.character_id`;

const toToken = (r: any): TokenPayload => ({
  id: r.id,
  mapId: r.map_id,
  characterId: r.character_id,
  ownerId: r.owner_id,
  name: r.name,
  color: r.color,
  x: r.x,
  y: r.y,
  size: r.size,
  hp: r.hp,
  maxHp: r.max_hp,
});

export const getToken = (tokenId: number): (TokenPayload & { campaignId: number }) | null => {
  const r = db
    .prepare(
      `SELECT ${TOKEN_COLS}, m.campaign_id
       FROM tokens t
       LEFT JOIN characters c ON c.id = t.character_id
       JOIN maps m ON m.id = t.map_id
       WHERE t.id = ?`
    )
    .get(tokenId) as any;
  if (!r) return null;
  return { ...toToken(r), campaignId: r.campaign_id };
};

const mapRow = (r: any) => ({
  id: r.id,
  campaignId: r.campaign_id,
  name: r.name,
  imageUrl: r.image_path ? `/uploads/${path.basename(r.image_path)}` : "",
  isVideo: /\.(mp4|webm)$/i.test(r.image_path ?? ""),
  youtubeId: r.youtube_id ?? "",
  gridSize: r.grid_size,
  gridOn: !!r.grid_on,
  active: !!r.active,
  fogOn: !!r.fog_on,
  fogCells: JSON.parse(r.fog_data ?? "[]") as string[],
});

// Accepts watch?v=, youtu.be/, shorts/, embed/ and live/ URL shapes.
export function parseYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m?.[1] ?? null;
}

export const mapsRouter = Router();
mapsRouter.use(requireAuth);

mapsRouter.get("/:id/maps", (req, res) => {
  const campaignId = Number(req.params.id);
  if (!memberRole(campaignId, user(req).id)) return res.status(404).json({ error: "Campaign not found." });
  const rows = db.prepare("SELECT * FROM maps WHERE campaign_id = ? ORDER BY id").all(campaignId);
  res.json({ maps: rows.map(mapRow) });
});

mapsRouter.get("/:id/maps/active", (req, res) => {
  const campaignId = Number(req.params.id);
  if (!memberRole(campaignId, user(req).id)) return res.status(404).json({ error: "Campaign not found." });
  const row = db
    .prepare("SELECT * FROM maps WHERE campaign_id = ? AND active = 1 LIMIT 1")
    .get(campaignId) as any;
  if (!row) return res.json({ map: null, tokens: [] });
  const tokens = (db.prepare(`${TOKEN_SELECT} WHERE t.map_id = ?`).all(row.id) as any[]).map(toToken);
  res.json({ map: mapRow(row), tokens });
});

mapsRouter.post("/:id/maps", upload.single("image"), (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can upload maps." });

  let youtubeId = "";
  if (!req.file) {
    const url = String(req.body?.youtubeUrl ?? "").trim();
    youtubeId = url ? parseYouTubeId(url) ?? "" : "";
    if (!youtubeId) {
      return res
        .status(400)
        .json({ error: "Attach an image/video file, or paste a valid YouTube link." });
    }
  }
  const name = String(req.body?.name ?? "").trim() || (youtubeId ? "YouTube map" : "New map");
  const hasActive = db
    .prepare("SELECT 1 FROM maps WHERE campaign_id = ? AND active = 1")
    .get(campaignId);
  const info = db
    .prepare("INSERT INTO maps (campaign_id, name, image_path, youtube_id, active) VALUES (?, ?, ?, ?, ?)")
    .run(campaignId, name, req.file?.path ?? "", youtubeId, hasActive ? 0 : 1);
  broadcastMapChange(campaignId);
  res.json({ id: Number(info.lastInsertRowid) });
});

mapsRouter.put("/:id/maps/:mapId", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can edit maps." });
  const map = db
    .prepare("SELECT * FROM maps WHERE id = ? AND campaign_id = ?")
    .get(Number(req.params.mapId), campaignId) as any;
  if (!map) return res.status(404).json({ error: "Map not found." });

  const b = req.body ?? {};
  const gridSize = Number.isInteger(b.gridSize) && b.gridSize >= 10 ? b.gridSize : map.grid_size;
  const gridOn = typeof b.gridOn === "boolean" ? (b.gridOn ? 1 : 0) : map.grid_on;
  const name = typeof b.name === "string" && b.name.trim() ? b.name.trim() : map.name;
  db.prepare("UPDATE maps SET name = ?, grid_size = ?, grid_on = ? WHERE id = ?").run(
    name,
    gridSize,
    gridOn,
    map.id
  );
  if (b.active === true) {
    db.prepare("UPDATE maps SET active = 0 WHERE campaign_id = ?").run(campaignId);
    db.prepare("UPDATE maps SET active = 1 WHERE id = ?").run(map.id);
  }
  broadcastMapChange(campaignId);
  res.json({ ok: true });
});

mapsRouter.put("/:id/maps/:mapId/fog", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM controls the fog." });
  const map = db
    .prepare("SELECT * FROM maps WHERE id = ? AND campaign_id = ?")
    .get(Number(req.params.mapId), campaignId) as any;
  if (!map) return res.status(404).json({ error: "Map not found." });

  const b = req.body ?? {};
  const fogOn = typeof b.fogOn === "boolean" ? (b.fogOn ? 1 : 0) : map.fog_on;
  let fogData = map.fog_data;
  if (Array.isArray(b.cells)) {
    const cells = b.cells.filter((c: unknown) => typeof c === "string" && /^-?\d+,-?\d+$/.test(c));
    if (cells.length > 100_000) return res.status(400).json({ error: "Too many fog cells." });
    fogData = JSON.stringify(cells);
  }
  db.prepare("UPDATE maps SET fog_on = ?, fog_data = ? WHERE id = ?").run(fogOn, fogData, map.id);
  getIo().to(`campaign:${campaignId}`).emit("fog:update", {
    campaignId,
    mapId: map.id,
    fogOn: !!fogOn,
    fogCells: JSON.parse(fogData),
  });
  res.json({ ok: true });
});

mapsRouter.delete("/:id/maps/:mapId", async (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can delete maps." });
  const map = db
    .prepare("SELECT * FROM maps WHERE id = ? AND campaign_id = ?")
    .get(Number(req.params.mapId), campaignId) as any;
  if (!map) return res.status(404).json({ error: "Map not found." });
  db.prepare("DELETE FROM maps WHERE id = ?").run(map.id);
  if (map.image_path) await unlink(map.image_path).catch(() => {});
  broadcastMapChange(campaignId);
  res.json({ ok: true });
});

mapsRouter.post("/:id/maps/:mapId/tokens", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const map = db
    .prepare("SELECT * FROM maps WHERE id = ? AND campaign_id = ?")
    .get(Number(req.params.mapId), campaignId) as any;
  if (!map) return res.status(404).json({ error: "Map not found." });

  const b = req.body ?? {};
  const characterId = b.characterId ? Number(b.characterId) : null;
  let name = String(b.name ?? "").trim();
  if (characterId) {
    const c = db
      .prepare("SELECT user_id, name FROM characters WHERE id = ? AND campaign_id = ?")
      .get(characterId, campaignId) as any;
    if (!c) return res.status(404).json({ error: "Character not found." });
    if (!isDMRole(role) && c.user_id !== user(req).id) {
      return res.status(403).json({ error: "You can only place your own character." });
    }
    name = name || c.name;
  } else if (!isDMRole(role)) {
    return res.status(403).json({ error: "Only the DM can place custom tokens." });
  }
  if (!name) return res.status(400).json({ error: "The token needs a name." });

  const size = [1, 2, 3, 4].includes(b.size) ? b.size : 1;
  const color = /^#[0-9a-fA-F]{6}$/.test(b.color ?? "") ? b.color : "#c9a24b";
  const x = Number.isFinite(b.x) ? b.x : map.grid_size * 1.5;
  const y = Number.isFinite(b.y) ? b.y : map.grid_size * 1.5;
  const info = db
    .prepare("INSERT INTO tokens (map_id, character_id, name, color, x, y, size) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(map.id, characterId, name, color, x, y, size);
  const token = getToken(Number(info.lastInsertRowid))!;
  getIo().to(`campaign:${campaignId}`).emit("token:create", { campaignId, token });
  res.json({ token });
});

mapsRouter.delete("/:id/maps/:mapId/tokens/:tokenId", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const token = getToken(Number(req.params.tokenId));
  if (!token || token.campaignId !== campaignId) return res.status(404).json({ error: "Token not found." });
  if (!isDMRole(role) && token.ownerId !== user(req).id) {
    return res.status(403).json({ error: "Only the DM or the token's player can remove it." });
  }
  db.prepare("DELETE FROM tokens WHERE id = ?").run(token.id);
  getIo().to(`campaign:${campaignId}`).emit("token:delete", { campaignId, tokenId: token.id });
  res.json({ ok: true });
});

function broadcastMapChange(campaignId: number) {
  getIo().to(`campaign:${campaignId}`).emit("map:update", { campaignId });
}

// Called from the socket layer: live token drags.
export function moveToken(
  mover: SessionUser,
  campaignId: number,
  tokenId: number,
  x: number,
  y: number
): TokenPayload | null {
  const role = memberRole(campaignId, mover.id);
  if (!role || role === "spectator") return null;
  const token = getToken(tokenId);
  if (!token || token.campaignId !== campaignId) return null;
  if (!isDMRole(role) && token.ownerId !== mover.id) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  db.prepare("UPDATE tokens SET x = ?, y = ? WHERE id = ?").run(x, y, tokenId);
  return { ...token, x, y };
}

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

// Animated battle maps commonly run 100-300MB, so be generous.
export const MAX_UPLOAD_MB = 500;

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) =>
      cb(null, `${randomBytes(12).toString("hex")}${MEDIA_TYPES[file.mimetype] ?? ".png"}`),
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in MEDIA_TYPES),
});


const TOKEN_IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const tokenImageUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) =>
      cb(null, `token-${randomBytes(12).toString("hex")}${TOKEN_IMAGE_TYPES[file.mimetype] ?? ".png"}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in TOKEN_IMAGE_TYPES),
});

const MAP_AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/webm": ".webm",
  "audio/mp4": ".m4a",
};

const mapAudioUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) =>
      cb(null, `map-audio-${randomBytes(12).toString("hex")}${MAP_AUDIO_TYPES[file.mimetype] ?? ".mp3"}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in MAP_AUDIO_TYPES),
});

export interface TokenPayload {
  id: number;
  mapId: number;
  characterId: number | null;
  monsterId: number | null;
  ownerId: number | null;
  name: string;
  color: string;
  x: number;
  y: number;
  size: number;
  hp: number | null;
  maxHp: number | null;
  aura: number | null;
  auraMax: number | null;
  auraColor: string;
  portraitUrl: string;
  imageUrl: string;
  imageScale: number;
  conditions: string[];
}

// Character tokens read HP from the sheet; monster/custom tokens carry their own.
// Aura only exists on Remnant character sheets — null everywhere else.
const TOKEN_COLS = `
  t.id, t.map_id, t.character_id, t.monster_id, t.name, t.color, t.x, t.y, t.size,
  t.image_path, t.image_scale,
  c.user_id AS owner_id,
  COALESCE(json_extract(c.data, '$.hp'), t.hp) AS hp,
  COALESCE(json_extract(c.data, '$.maxHp'), t.max_hp) AS max_hp,
  COALESCE(json_extract(c.data, '$.aura'), t.aura) AS aura,
  COALESCE(json_extract(c.data, '$.auraMax'), t.aura_max) AS aura_max,
  COALESCE(json_extract(c.data, '$.auraColor'), t.aura_color, t.color, '#78e1ff') AS aura_color,
  c.portrait_path AS portrait_path,
  COALESCE(json_extract(c.data, '$.conditions'), t.conditions) AS conditions`;
const TOKEN_SELECT = `SELECT ${TOKEN_COLS}
  FROM tokens t LEFT JOIN characters c ON c.id = t.character_id`;

const toToken = (r: any): TokenPayload => ({
  id: r.id,
  mapId: r.map_id,
  characterId: r.character_id,
  monsterId: r.monster_id,
  ownerId: r.owner_id,
  name: r.name,
  color: r.color,
  x: r.x,
  y: r.y,
  size: r.size,
  hp: r.hp,
  maxHp: r.max_hp,
  aura: r.aura ?? null,
  auraMax: r.aura_max ?? null,
  auraColor: /^#[0-9a-fA-F]{6}$/.test(r.aura_color ?? "") ? r.aura_color : "#78e1ff",
  portraitUrl: r.portrait_path ? `/uploads/${path.basename(r.portrait_path)}` : "",
  imageUrl: r.image_path ? `/uploads/${path.basename(r.image_path)}` : "",
  imageScale: Number.isFinite(r.image_scale) ? r.image_scale : 1,
  conditions: parseConditions(r.conditions),
});

function parseConditions(raw: unknown): string[] {
  try {
    const arr = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(arr) ? arr.filter((c) => typeof c === "string") : [];
  } catch {
    return [];
  }
}

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
  audioUrl: r.music_path ? `/uploads/${path.basename(r.music_path)}` : "",
  youtubeAudio: !!r.youtube_audio,
  gridSize: r.grid_size,
  gridOn: !!r.grid_on,
  active: !!r.active,
  fogOn: !!r.fog_on,
  fogCells: JSON.parse(r.fog_data ?? "[]") as string[],
  strokes: JSON.parse(r.draw_data ?? "[]"),
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
  const youtubeAudio =
    typeof b.youtubeAudio === "boolean" ? (b.youtubeAudio ? 1 : 0) : map.youtube_audio;
  const name = typeof b.name === "string" && b.name.trim() ? b.name.trim() : map.name;
  db.prepare(
    "UPDATE maps SET name = ?, grid_size = ?, grid_on = ?, youtube_audio = ? WHERE id = ?"
  ).run(name, gridSize, gridOn, youtubeAudio, map.id);
  if (b.active === true) {
    db.prepare("UPDATE maps SET active = 0 WHERE campaign_id = ?").run(campaignId);
    db.prepare("UPDATE maps SET active = 1 WHERE id = ?").run(map.id);
  }
  broadcastMapChange(campaignId);
  res.json({ ok: true });
});

mapsRouter.post(
  "/:id/maps/:mapId/music",
  mapAudioUpload.single("audio"),
  async (req, res) => {
    const discard = () => req.file?.path && unlink(req.file.path).catch(() => {});
    const campaignId = Number(req.params.id);
    const role = memberRole(campaignId, user(req).id);
    if (!role) {
      await discard();
      return res.status(404).json({ error: "Campaign not found." });
    }
    if (!isDMRole(role)) {
      await discard();
      return res.status(403).json({ error: "Only the DM can change map music." });
    }
    const map = db
      .prepare("SELECT * FROM maps WHERE id = ? AND campaign_id = ?")
      .get(Number(req.params.mapId), campaignId) as any;
    if (!map) {
      await discard();
      return res.status(404).json({ error: "Map not found." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Choose an audio file under 50 MB." });
    }
    db.prepare("UPDATE maps SET music_path = ? WHERE id = ?").run(req.file.path, map.id);
    if (map.music_path && map.music_path !== req.file.path) {
      await unlink(map.music_path).catch(() => {});
    }
    broadcastMapChange(campaignId);
    const updated = db.prepare("SELECT * FROM maps WHERE id = ?").get(map.id) as any;
    res.json({ map: mapRow(updated) });
  }
);

mapsRouter.delete("/:id/maps/:mapId/music", async (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) {
    return res.status(403).json({ error: "Only the DM can change map music." });
  }
  const map = db
    .prepare("SELECT * FROM maps WHERE id = ? AND campaign_id = ?")
    .get(Number(req.params.mapId), campaignId) as any;
  if (!map) return res.status(404).json({ error: "Map not found." });
  db.prepare("UPDATE maps SET music_path = '' WHERE id = ?").run(map.id);
  if (map.music_path) await unlink(map.music_path).catch(() => {});
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

// Freehand drawings: any non-spectator can sketch; the whole stroke list is
// saved at once (same simple model as fog) and broadcast live.
mapsRouter.put("/:id/maps/:mapId/draw", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (role === "spectator") return res.status(403).json({ error: "Spectators can't draw." });
  const map = db
    .prepare("SELECT id FROM maps WHERE id = ? AND campaign_id = ?")
    .get(Number(req.params.mapId), campaignId) as any;
  if (!map) return res.status(404).json({ error: "Map not found." });

  const strokes = req.body?.strokes;
  if (!Array.isArray(strokes) || strokes.length > 500) {
    return res.status(400).json({ error: "Too much ink — clear some drawings first." });
  }
  const clean = strokes
    .map((s: any) => ({
      id: String(s?.id ?? "").slice(0, 40),
      color: /^#[0-9a-fA-F]{6}$/.test(s?.color ?? "") ? s.color : "#cfa64f",
      size: Math.min(20, Math.max(1, Number(s?.size) || 4)),
      points: Array.isArray(s?.points)
        ? s.points.slice(0, 4000).map(Number).filter(Number.isFinite)
        : [],
    }))
    .filter((s: any) => s.id && s.points.length >= 4);
  db.prepare("UPDATE maps SET draw_data = ? WHERE id = ?").run(JSON.stringify(clean), map.id);
  getIo().to(`campaign:${campaignId}`).emit("draw:update", { campaignId, mapId: map.id, strokes: clean });
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
  const tokenImages = db
    .prepare("SELECT image_path FROM tokens WHERE map_id = ? AND image_path <> ''")
    .all(map.id) as any[];
  db.prepare("DELETE FROM maps WHERE id = ?").run(map.id);
  if (map.image_path) await unlink(map.image_path).catch(() => {});
  await Promise.all(
    tokenImages.map((row) => row.image_path && unlink(row.image_path).catch(() => {}))
  );
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
  const monsterId = b.monsterId ? Number(b.monsterId) : null;
  let name = String(b.name ?? "").trim();
  let size = [1, 2, 3, 4].includes(b.size) ? b.size : 1;
  let color = /^#[0-9a-fA-F]{6}$/.test(b.color ?? "") ? b.color : "#c9a24b";
  let hp: number | null = null;
  let maxHp: number | null = null;

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
  } else if (monsterId) {
    const m = db
      .prepare("SELECT name, data FROM monsters WHERE id = ? AND (campaign_id IS NULL OR campaign_id = ?)")
      .get(monsterId, campaignId) as any;
    if (!m) return res.status(404).json({ error: "Monster not found." });
    const d = JSON.parse(m.data);
    if (!name) {
      const twins = (
        db
          .prepare("SELECT COUNT(*) AS n FROM tokens WHERE map_id = ? AND monster_id = ?")
          .get(map.id, monsterId) as any
      ).n;
      name = twins > 0 ? `${m.name} ${twins + 1}` : m.name;
    }
    hp = maxHp = d.hit_points ?? 10;
    size = { tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 }[
      String(d.size ?? "medium").toLowerCase()
    ] ?? 1;
    color = /^#[0-9a-fA-F]{6}$/.test(b.color ?? "") ? b.color : "#a03636";
  }
  if (!name) return res.status(400).json({ error: "The token needs a name." });

  const x = Number.isFinite(b.x) ? b.x : map.grid_size * 1.5;
  const y = Number.isFinite(b.y) ? b.y : map.grid_size * 1.5;
  const info = db
    .prepare(
      `INSERT INTO tokens (map_id, character_id, monster_id, name, color, x, y, size, hp, max_hp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(map.id, characterId, monsterId, name, color, x, y, size, hp, maxHp);
  const token = getToken(Number(info.lastInsertRowid))!;
  getIo().to(`campaign:${campaignId}`).emit("token:create", { campaignId, token });
  res.json({ token });
});


mapsRouter.put("/:id/maps/:mapId/tokens/:tokenId/appearance", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });

  const token = getToken(Number(req.params.tokenId));
  if (!token || token.campaignId !== campaignId || token.mapId !== Number(req.params.mapId)) {
    return res.status(404).json({ error: "Token not found." });
  }
  if (!isDMRole(role) && token.ownerId !== user(req).id) {
    return res.status(403).json({ error: "Only the DM or token owner can edit its appearance." });
  }

  const body = req.body ?? {};
  const requestedSize = Number(body.size);
  const size = [1, 2, 3, 4].includes(requestedSize) ? requestedSize : token.size;
  const requestedScale = Number(body.imageScale);
  const imageScale = Number.isFinite(requestedScale)
    ? Math.min(2.5, Math.max(0.5, requestedScale))
    : token.imageScale;
  const color = /^#[0-9a-fA-F]{6}$/.test(body.color ?? "") ? body.color : token.color;

  db.prepare("UPDATE tokens SET size = ?, image_scale = ?, color = ? WHERE id = ?").run(
    size,
    imageScale,
    color,
    token.id
  );
  const updated = getToken(token.id)!;
  getIo().to(`campaign:${campaignId}`).emit("token:update", { campaignId, token: updated });
  res.json({ token: updated });
});

mapsRouter.post(
  "/:id/maps/:mapId/tokens/:tokenId/image",
  tokenImageUpload.single("image"),
  async (req, res) => {
    const discardUpload = () => req.file?.path && unlink(req.file.path).catch(() => {});
    const campaignId = Number(req.params.id);
    const role = memberRole(campaignId, user(req).id);
    if (!role) {
      await discardUpload();
      return res.status(404).json({ error: "Campaign not found." });
    }

    const token = getToken(Number(req.params.tokenId));
    if (!token || token.campaignId !== campaignId || token.mapId !== Number(req.params.mapId)) {
      await discardUpload();
      return res.status(404).json({ error: "Token not found." });
    }
    if (!isDMRole(role) && token.ownerId !== user(req).id) {
      await discardUpload();
      return res.status(403).json({ error: "Only the DM or token owner can edit its appearance." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Choose a PNG, JPG, or WebP image under 10 MB." });
    }

    const previous = db.prepare("SELECT image_path FROM tokens WHERE id = ?").get(token.id) as any;
    db.prepare("UPDATE tokens SET image_path = ? WHERE id = ?").run(req.file.path, token.id);
    if (previous?.image_path && previous.image_path !== req.file.path) {
      await unlink(previous.image_path).catch(() => {});
    }

    const updated = getToken(token.id)!;
    getIo().to(`campaign:${campaignId}`).emit("token:update", { campaignId, token: updated });
    res.json({ token: updated });
  }
);

mapsRouter.delete("/:id/maps/:mapId/tokens/:tokenId/image", async (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });

  const token = getToken(Number(req.params.tokenId));
  if (!token || token.campaignId !== campaignId || token.mapId !== Number(req.params.mapId)) {
    return res.status(404).json({ error: "Token not found." });
  }
  if (!isDMRole(role) && token.ownerId !== user(req).id) {
    return res.status(403).json({ error: "Only the DM or token owner can edit its appearance." });
  }

  const previous = db.prepare("SELECT image_path FROM tokens WHERE id = ?").get(token.id) as any;
  db.prepare("UPDATE tokens SET image_path = '' WHERE id = ?").run(token.id);
  if (previous?.image_path) await unlink(previous.image_path).catch(() => {});

  const updated = getToken(token.id)!;
  getIo().to(`campaign:${campaignId}`).emit("token:update", { campaignId, token: updated });
  res.json({ token: updated });
});

mapsRouter.put("/:id/maps/:mapId/tokens/:tokenId/hp", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM edits token HP." });
  const token = getToken(Number(req.params.tokenId));
  if (!token || token.campaignId !== campaignId) return res.status(404).json({ error: "Token not found." });
  if (token.characterId) {
    return res.status(400).json({ error: "Character HP lives on the character sheet." });
  }
  const hp = Number(req.body?.hp);
  const maxHp = req.body?.maxHp !== undefined ? Number(req.body.maxHp) : token.maxHp;
  if (!Number.isFinite(hp)) return res.status(400).json({ error: "HP must be a number." });
  db.prepare("UPDATE tokens SET hp = ?, max_hp = ? WHERE id = ?").run(
    Math.max(0, Math.round(hp)),
    Number.isFinite(maxHp as number) ? Math.max(1, Math.round(maxHp as number)) : null,
    token.id
  );
  const updated = getToken(token.id)!;
  getIo().to(`campaign:${campaignId}`).emit("token:update", { campaignId, token: updated });
  res.json({ token: updated });
});


/* vivid-aura-color-system: enemy and custom token Aura */
mapsRouter.put("/:id/maps/:mapId/tokens/:tokenId/aura", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM edits enemy Aura." });

  const token = getToken(Number(req.params.tokenId));
  if (!token || token.campaignId !== campaignId) {
    return res.status(404).json({ error: "Token not found." });
  }
  if (token.characterId) {
    return res.status(400).json({ error: "Character Aura lives on the character sheet." });
  }

  const aura = Number(req.body?.aura);
  const auraMax = Number(req.body?.auraMax);
  const auraColor = /^#[0-9a-fA-F]{6}$/.test(req.body?.auraColor ?? "")
    ? req.body.auraColor
    : token.auraColor;

  if (!Number.isFinite(aura) || !Number.isFinite(auraMax)) {
    return res.status(400).json({ error: "Aura and maximum Aura must be numbers." });
  }

  const cleanMax = Math.max(0, Math.round(auraMax));
  const cleanAura = Math.max(0, Math.min(cleanMax, Math.round(aura)));

  db.prepare("UPDATE tokens SET aura = ?, aura_max = ?, aura_color = ? WHERE id = ?").run(
    cleanAura,
    cleanMax,
    auraColor,
    token.id
  );

  const updated = getToken(token.id)!;
  getIo().to(`campaign:${campaignId}`).emit("token:update", { campaignId, token: updated });
  res.json({ token: updated });
});

// Conditions on monster/custom tokens (character tokens read their sheet).
mapsRouter.put("/:id/maps/:mapId/tokens/:tokenId/conditions", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM edits token conditions." });
  const token = getToken(Number(req.params.tokenId));
  if (!token || token.campaignId !== campaignId) return res.status(404).json({ error: "Token not found." });
  if (token.characterId) {
    return res.status(400).json({ error: "Character conditions live on the character sheet." });
  }
  const conditions = req.body?.conditions;
  if (!Array.isArray(conditions) || conditions.length > 20) {
    return res.status(400).json({ error: "Conditions must be a short list." });
  }
  const clean = conditions.map((c) => String(c).slice(0, 30)).filter(Boolean);
  db.prepare("UPDATE tokens SET conditions = ? WHERE id = ?").run(JSON.stringify(clean), token.id);
  const updated = getToken(token.id)!;
  getIo().to(`campaign:${campaignId}`).emit("token:update", { campaignId, token: updated });
  res.json({ token: updated });
});

mapsRouter.delete("/:id/maps/:mapId/tokens/:tokenId", async (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const token = getToken(Number(req.params.tokenId));
  if (!token || token.campaignId !== campaignId) return res.status(404).json({ error: "Token not found." });
  if (!isDMRole(role) && token.ownerId !== user(req).id) {
    return res.status(403).json({ error: "Only the DM or the token's player can remove it." });
  }
  const imageRow = db.prepare("SELECT image_path FROM tokens WHERE id = ?").get(token.id) as any;
  db.prepare("DELETE FROM tokens WHERE id = ?").run(token.id);
  if (imageRow?.image_path) {
    const stillPrepared = db
      .prepare("SELECT 1 FROM prepared_tokens WHERE image_path = ? LIMIT 1")
      .get(imageRow.image_path);
    const stillUsedByToken = db
      .prepare("SELECT 1 FROM tokens WHERE image_path = ? LIMIT 1")
      .get(imageRow.image_path);
    if (!stillPrepared && !stillUsedByToken) await unlink(imageRow.image_path).catch(() => {});
  }
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

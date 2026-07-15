import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { getIo } from "./realtime.js";

const user = (req: Request) => (req as any).user as SessionUser;
const isDMRole = (role: string | null) => role === "dm" || role === "co-dm";
const room = (campaignId: number) => `campaign:${campaignId}`;

type SceneToken = {
  id: number;
  characterId: number | null;
  monsterId: number | null;
  name: string;
  color: string;
  x: number;
  y: number;
  size: number;
  hp: number | null;
  maxHp: number | null;
  imagePath: string;
  imageScale: number;
  conditions: string;
};

type SceneData = {
  tokens: SceneToken[];
  fogOn: number;
  fogData: string;
  drawData: string;
};

const sceneRow = (row: any) => ({
  id: row.id,
  mapId: row.map_id,
  name: row.name,
  announcement: row.announcement,
  enemyCount: Number(row.enemy_count ?? 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function ownedMap(campaignId: number, mapId: number) {
  return db.prepare("SELECT * FROM maps WHERE id = ? AND campaign_id = ?").get(mapId, campaignId) as any;
}

function captureScene(mapId: number): SceneData {
  const map = db.prepare("SELECT * FROM maps WHERE id = ?").get(mapId) as any;
  const tokens = db.prepare(`
    SELECT id, character_id, monster_id, name, color, x, y, size, hp, max_hp,
           image_path, image_scale, conditions
    FROM tokens
    WHERE map_id = ?
      AND (monster_id IS NOT NULL OR character_id IS NULL)
    ORDER BY id
  `).all(mapId) as any[];

  return {
    tokens: tokens.map((token) => ({
      id: token.id,
      characterId: token.character_id ?? null,
      monsterId: token.monster_id ?? null,
      name: token.name,
      color: token.color,
      x: token.x,
      y: token.y,
      size: token.size,
      hp: token.hp,
      maxHp: token.max_hp,
      imagePath: String(token.image_path ?? ""),
      imageScale: Number(token.image_scale ?? 1),
      conditions: String(token.conditions ?? "[]"),
    })),
    fogOn: Number(map?.fog_on ?? 0),
    fogData: String(map?.fog_data ?? "[]"),
    drawData: String(map?.draw_data ?? "[]"),
  };
}

export const scenesRouter = Router();
scenesRouter.use(requireAuth);

scenesRouter.get("/:id/maps/:mapId/scenes", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });

  const mapId = Number(req.params.mapId);
  if (!ownedMap(campaignId, mapId)) return res.status(404).json({ error: "Map not found." });

  const rows = db.prepare(`
    SELECT id, map_id, name, announcement, enemy_count, created_at, updated_at
    FROM map_scenes
    WHERE map_id = ?
    ORDER BY updated_at DESC, id DESC
  `).all(mapId) as any[];

  res.json({ scenes: rows.map(sceneRow) });
});

scenesRouter.post("/:id/maps/:mapId/scenes", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can save scenes." });

  const mapId = Number(req.params.mapId);
  if (!ownedMap(campaignId, mapId)) return res.status(404).json({ error: "Map not found." });

  const name = String(req.body?.name ?? "").trim() || "New scene";
  const announcement = String(req.body?.announcement ?? "").trim();
  const data = captureScene(mapId);

  const result = db.prepare(`
    INSERT INTO map_scenes (map_id, name, announcement, enemy_count, scene_data)
    VALUES (?, ?, ?, ?, ?)
  `).run(mapId, name, announcement, data.tokens.length, JSON.stringify(data));

  const row = db.prepare("SELECT * FROM map_scenes WHERE id = ?").get(Number(result.lastInsertRowid));
  res.json({ scene: sceneRow(row) });
});

scenesRouter.put("/:id/maps/:mapId/scenes/:sceneId", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can edit scenes." });

  const mapId = Number(req.params.mapId);
  const scene = db.prepare(`
    SELECT s.* FROM map_scenes s
    JOIN maps m ON m.id = s.map_id
    WHERE s.id = ? AND s.map_id = ? AND m.campaign_id = ?
  `).get(Number(req.params.sceneId), mapId, campaignId) as any;
  if (!scene) return res.status(404).json({ error: "Scene not found." });

  const name = typeof req.body?.name === "string" && req.body.name.trim()
    ? req.body.name.trim()
    : scene.name;
  const announcement = typeof req.body?.announcement === "string"
    ? req.body.announcement
    : scene.announcement;

  db.prepare(`
    UPDATE map_scenes
    SET name = ?, announcement = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(name, announcement, scene.id);

  const updated = db.prepare("SELECT * FROM map_scenes WHERE id = ?").get(scene.id);
  res.json({ scene: sceneRow(updated) });
});

scenesRouter.post("/:id/maps/:mapId/scenes/:sceneId/recapture", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can update scenes." });

  const mapId = Number(req.params.mapId);
  const scene = db.prepare(`
    SELECT s.* FROM map_scenes s
    JOIN maps m ON m.id = s.map_id
    WHERE s.id = ? AND s.map_id = ? AND m.campaign_id = ?
  `).get(Number(req.params.sceneId), mapId, campaignId) as any;
  if (!scene) return res.status(404).json({ error: "Scene not found." });

  const data = captureScene(mapId);
  db.prepare(`
    UPDATE map_scenes
    SET enemy_count = ?, scene_data = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(data.tokens.length, JSON.stringify(data), scene.id);

  const updated = db.prepare("SELECT * FROM map_scenes WHERE id = ?").get(scene.id);
  res.json({ scene: sceneRow(updated) });
});

scenesRouter.post("/:id/maps/:mapId/scenes/:sceneId/duplicate", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can duplicate scenes." });

  const mapId = Number(req.params.mapId);
  const scene = db.prepare(`
    SELECT s.* FROM map_scenes s
    JOIN maps m ON m.id = s.map_id
    WHERE s.id = ? AND s.map_id = ? AND m.campaign_id = ?
  `).get(Number(req.params.sceneId), mapId, campaignId) as any;
  if (!scene) return res.status(404).json({ error: "Scene not found." });

  const result = db.prepare(`
    INSERT INTO map_scenes (map_id, name, announcement, enemy_count, scene_data)
    VALUES (?, ?, ?, ?, ?)
  `).run(mapId, `${scene.name} copy`, scene.announcement, scene.enemy_count, scene.scene_data);

  const row = db.prepare("SELECT * FROM map_scenes WHERE id = ?").get(Number(result.lastInsertRowid));
  res.json({ scene: sceneRow(row) });
});

scenesRouter.post("/:id/maps/:mapId/scenes/:sceneId/activate", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can activate scenes." });

  const mapId = Number(req.params.mapId);
  const scene = db.prepare(`
    SELECT s.* FROM map_scenes s
    JOIN maps m ON m.id = s.map_id
    WHERE s.id = ? AND s.map_id = ? AND m.campaign_id = ?
  `).get(Number(req.params.sceneId), mapId, campaignId) as any;
  if (!scene) return res.status(404).json({ error: "Scene not found." });

  let data: SceneData;
  try {
    data = JSON.parse(scene.scene_data);
  } catch {
    return res.status(400).json({ error: "This scene snapshot is damaged." });
  }

  const updateToken = db.prepare(`
    UPDATE tokens
    SET x = ?, y = ?, hp = ?, max_hp = ?, conditions = ?
    WHERE id = ? AND map_id = ?
      AND (monster_id IS NOT NULL OR character_id IS NULL)
  `);
  const insertToken = db.prepare(`
    INSERT INTO tokens
      (map_id, character_id, monster_id, name, color, x, y, size, hp, max_hp,
       image_path, image_scale, conditions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    for (const token of data.tokens ?? []) {
      const result = updateToken.run(
        token.x, token.y, token.hp, token.maxHp ?? null, token.conditions, token.id, mapId
      );
      if (!result.changes && token.name) {
        insertToken.run(
          mapId,
          token.characterId ?? null,
          token.monsterId ?? null,
          token.name,
          token.color ?? "#b04545",
          token.x,
          token.y,
          token.size ?? 1,
          token.hp ?? null,
          token.maxHp ?? null,
          token.imagePath ?? "",
          token.imageScale ?? 1,
          token.conditions ?? "[]"
        );
      }
    }
    db.prepare("UPDATE maps SET fog_on = ?, fog_data = ?, draw_data = ? WHERE id = ?")
      .run(data.fogOn ? 1 : 0, data.fogData ?? "[]", data.drawData ?? "[]", mapId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const io = getIo();
  io.to(room(campaignId)).emit("map:update", { campaignId });
  if (scene.announcement) {
    io.to(room(campaignId)).emit("scene:announcement", {
      campaignId,
      mapId,
      sceneName: scene.name,
      message: scene.announcement,
    });
  }

  res.json({ ok: true });
});

scenesRouter.delete("/:id/maps/:mapId/scenes/:sceneId", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can delete scenes." });

  const mapId = Number(req.params.mapId);
  const result = db.prepare(`
    DELETE FROM map_scenes
    WHERE id = ? AND map_id = ?
      AND EXISTS (SELECT 1 FROM maps WHERE maps.id = map_scenes.map_id AND maps.campaign_id = ?)
  `).run(Number(req.params.sceneId), mapId, campaignId);

  if (!result.changes) return res.status(404).json({ error: "Scene not found." });
  res.json({ ok: true });
});

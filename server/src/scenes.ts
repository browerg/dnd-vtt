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

const sceneRow = (row: any) => {
  const link = db.prepare(`
    SELECT l.group_id, l.anchor_x, l.anchor_y, g.name AS group_name
    FROM scene_prepared_encounters l
    JOIN prepared_encounter_groups g ON g.id = l.group_id
    WHERE l.scene_id = ?
  `).get(row.id) as any;
  return {
    id: row.id,
    mapId: row.map_id,
    name: row.name,
    announcement: row.announcement,
    enemyCount: Number(row.enemy_count ?? 0),
    encounterGroupId: link?.group_id ?? null,
    encounterGroupName: link?.group_name ?? "",
    encounterAnchorX: Number(link?.anchor_x ?? 4),
    encounterAnchorY: Number(link?.anchor_y ?? 4),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

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

type SceneEncounterMember = {
  preparedTokenId: number;
  monsterId: number | null;
  name: string;
  color: string;
  size: number;
  hp: number | null;
  maxHp: number | null;
  imagePath: string;
  imageScale: number;
  conditions: string;
  offsetX: number;
  offsetY: number;
};

function sceneEncounterMembers(groupId: number): SceneEncounterMember[] {
  return db.prepare(`
    SELECT p.id AS prepared_token_id, p.monster_id, p.name, p.color, p.size, p.hp, p.max_hp,
           p.image_path, p.image_scale, p.conditions, i.offset_x, i.offset_y
    FROM prepared_encounter_group_items i
    JOIN prepared_tokens p ON p.id = i.prepared_token_id
    WHERE i.group_id = ?
    ORDER BY i.sort_order, i.id
  `).all(groupId).map((row: any) => ({
    preparedTokenId: row.prepared_token_id,
    monsterId: row.monster_id ?? null,
    name: row.name,
    color: row.color,
    size: row.size,
    hp: row.hp,
    maxHp: row.max_hp,
    imagePath: String(row.image_path ?? ""),
    imageScale: Number(row.image_scale ?? 1),
    conditions: String(row.conditions ?? "[]"),
    offsetX: Number(row.offset_x ?? 0),
    offsetY: Number(row.offset_y ?? 0),
  })) as SceneEncounterMember[];
}

function saveSceneEncounterLink(
  sceneId: number,
  campaignId: number,
  groupIdInput: unknown,
  anchorXInput: unknown,
  anchorYInput: unknown
) {
  if (groupIdInput === undefined) return;

  const groupId = Number(groupIdInput);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    db.prepare("DELETE FROM scene_prepared_encounters WHERE scene_id = ?").run(sceneId);
    return;
  }

  const group = db.prepare(
    "SELECT id FROM prepared_encounter_groups WHERE id = ? AND campaign_id = ?"
  ).get(groupId, campaignId) as any;
  if (!group) throw new Error("Prepared encounter group not found.");

  const anchorX = Number.isFinite(Number(anchorXInput)) ? Number(anchorXInput) : 4;
  const anchorY = Number.isFinite(Number(anchorYInput)) ? Number(anchorYInput) : 4;
  db.prepare(`
    INSERT INTO scene_prepared_encounters (scene_id, group_id, anchor_x, anchor_y)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(scene_id) DO UPDATE SET
      group_id = excluded.group_id,
      anchor_x = excluded.anchor_x,
      anchor_y = excluded.anchor_y
  `).run(sceneId, groupId, anchorX, anchorY);
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

  saveSceneEncounterLink(
    Number(result.lastInsertRowid),
    campaignId,
    req.body?.encounterGroupId,
    req.body?.encounterAnchorX,
    req.body?.encounterAnchorY
  );
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

  saveSceneEncounterLink(
    scene.id,
    campaignId,
    req.body?.encounterGroupId,
    req.body?.encounterAnchorX,
    req.body?.encounterAnchorY
  );

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

  const copiedLink = db.prepare(
    "SELECT group_id, anchor_x, anchor_y FROM scene_prepared_encounters WHERE scene_id = ?"
  ).get(scene.id) as any;
  if (copiedLink) {
    db.prepare(`
      INSERT INTO scene_prepared_encounters (scene_id, group_id, anchor_x, anchor_y)
      VALUES (?, ?, ?, ?)
    `).run(Number(result.lastInsertRowid), copiedLink.group_id, copiedLink.anchor_x, copiedLink.anchor_y);
  }

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

const sceneEncounter = db.prepare(`
    SELECT l.group_id, l.anchor_x, l.anchor_y, g.name AS group_name
    FROM scene_prepared_encounters l
    JOIN prepared_encounter_groups g ON g.id = l.group_id
    WHERE l.scene_id = ? AND g.campaign_id = ?
  `).get(scene.id, campaignId) as any;

  const deployedSceneTokens: any[] = [];
  if (sceneEncounter) {
    const map = ownedMap(campaignId, mapId);
    const members = sceneEncounterMembers(sceneEncounter.group_id);
    const findDeployment = db.prepare(`
      SELECT d.token_id
      FROM scene_encounter_deployments d
      JOIN tokens t ON t.id = d.token_id
      WHERE d.scene_id = ? AND d.prepared_token_id = ? AND t.map_id = ?
    `);
    const insertDeployment = db.prepare(`
      INSERT INTO scene_encounter_deployments (scene_id, prepared_token_id, token_id)
      VALUES (?, ?, ?)
      ON CONFLICT(scene_id, prepared_token_id) DO UPDATE SET token_id = excluded.token_id
    `);
    const updateEncounterToken = db.prepare(`
      UPDATE tokens
      SET x = ?, y = ?, hp = ?, max_hp = ?, conditions = ?,
          name = ?, color = ?, size = ?, image_path = ?, image_scale = ?, monster_id = ?
      WHERE id = ? AND map_id = ?
    `);
    const insertEncounterToken = db.prepare(`
      INSERT INTO tokens
        (map_id, character_id, monster_id, name, color, x, y, size, hp, max_hp,
         image_path, image_scale, conditions)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN");
    try {
      for (const member of members) {
        const x = (Number(sceneEncounter.anchor_x) + member.offsetX) * map.grid_size;
        const y = (Number(sceneEncounter.anchor_y) + member.offsetY) * map.grid_size;
        const existing = findDeployment.get(scene.id, member.preparedTokenId, mapId) as any;
        let tokenId = Number(existing?.token_id ?? 0);

        if (tokenId) {
          updateEncounterToken.run(
            x, y, member.hp, member.maxHp, member.conditions,
            member.name, member.color, member.size, member.imagePath,
            member.imageScale, member.monsterId, tokenId, mapId
          );
        } else {
          const inserted = insertEncounterToken.run(
            mapId, member.monsterId, member.name, member.color, x, y, member.size,
            member.hp, member.maxHp, member.imagePath, member.imageScale, member.conditions
          );
          tokenId = Number(inserted.lastInsertRowid);
          insertDeployment.run(scene.id, member.preparedTokenId, tokenId);
        }

        const row = db.prepare("SELECT id FROM tokens WHERE id = ?").get(tokenId);
        if (row) deployedSceneTokens.push(row);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
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

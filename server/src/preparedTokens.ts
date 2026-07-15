import { Router, type Request } from "express";
import multer from "multer";
import { randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { db, uploadsDir } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { getIo } from "./realtime.js";
import { getToken } from "./maps.js";

const user = (req: Request) => (req as any).user as SessionUser;
const isDMRole = (role: string | null) => role === "dm" || role === "co-dm";

const IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) =>
      cb(null, `prepared-${randomBytes(12).toString("hex")}${IMAGE_TYPES[file.mimetype] ?? ".png"}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in IMAGE_TYPES),
});

const rowToPrepared = (row: any) => ({
  id: row.id,
  campaignId: row.campaign_id,
  monsterId: row.monster_id,
  name: row.name,
  color: row.color,
  size: row.size,
  hp: row.hp,
  maxHp: row.max_hp,
  imageUrl: row.image_path ? `/uploads/${path.basename(row.image_path)}` : "",
  imageScale: row.image_scale,
  conditions: JSON.parse(row.conditions ?? "[]"),
  createdAt: row.created_at,
});

function campaignRole(req: Request, campaignId: number) {
  return memberRole(campaignId, user(req).id);
}

function canRemoveImage(imagePath: string, excludePreparedId?: number) {
  if (!imagePath) return false;
  const tokenUse = db.prepare("SELECT 1 FROM tokens WHERE image_path = ? LIMIT 1").get(imagePath);
  const preparedUse = excludePreparedId
    ? db.prepare("SELECT 1 FROM prepared_tokens WHERE image_path = ? AND id <> ? LIMIT 1").get(imagePath, excludePreparedId)
    : db.prepare("SELECT 1 FROM prepared_tokens WHERE image_path = ? LIMIT 1").get(imagePath);
  return !tokenUse && !preparedUse;
}

export const preparedTokensRouter = Router();
preparedTokensRouter.use(requireAuth);

preparedTokensRouter.get("/:id/prepared-tokens", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = campaignRole(req, campaignId);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can view prepared tokens." });

  const rows = db.prepare(
    "SELECT * FROM prepared_tokens WHERE campaign_id = ? ORDER BY id DESC"
  ).all(campaignId) as any[];
  res.json({ preparedTokens: rows.map(rowToPrepared) });
});

preparedTokensRouter.post("/:id/prepared-tokens", upload.single("image"), async (req, res) => {
  const campaignId = Number(req.params.id);
  const role = campaignRole(req, campaignId);
  if (!role) {
    if (req.file?.path) await unlink(req.file.path).catch(() => {});
    return res.status(404).json({ error: "Campaign not found." });
  }
  if (!isDMRole(role)) {
    if (req.file?.path) await unlink(req.file.path).catch(() => {});
    return res.status(403).json({ error: "Only the DM can prepare tokens." });
  }

  const monsterId = req.body.monsterId ? Number(req.body.monsterId) : null;
  let monster: any = null;
  let monsterData: any = {};
  if (monsterId) {
    monster = db.prepare(
      "SELECT name, data FROM monsters WHERE id = ? AND (campaign_id IS NULL OR campaign_id = ?)"
    ).get(monsterId, campaignId) as any;
    if (!monster) {
      if (req.file?.path) await unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: "Monster not found." });
    }
    try { monsterData = JSON.parse(monster.data ?? "{}"); } catch {}
  }

  const name = String(req.body.name ?? monster?.name ?? "").trim();
  if (!name) {
    if (req.file?.path) await unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: "The prepared token needs a name." });
  }

  const sizeInput = Number(req.body.size);
  const defaultSize = ({ tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 } as any)[
    String(monsterData.size ?? "medium").toLowerCase()
  ] ?? 1;
  const size = [1, 2, 3, 4].includes(sizeInput) ? sizeInput : defaultSize;
  const defaultHp = Number(monsterData.hit_points ?? 10);
  const hpInput = Number(req.body.hp);
  const maxHpInput = Number(req.body.maxHp);
  const maxHp = Number.isFinite(maxHpInput) && maxHpInput > 0 ? Math.round(maxHpInput) : Math.max(1, defaultHp);
  const hp = Number.isFinite(hpInput) ? Math.max(0, Math.min(maxHp, Math.round(hpInput))) : maxHp;
  const color = /^#[0-9a-fA-F]{6}$/.test(req.body.color ?? "") ? req.body.color : "#a03636";
  const imageScaleInput = Number(req.body.imageScale);
  const imageScale = Number.isFinite(imageScaleInput)
    ? Math.min(2.5, Math.max(0.5, imageScaleInput))
    : 1;
  const quantity = Math.min(20, Math.max(1, Math.round(Number(req.body.quantity) || 1)));

  const insert = db.prepare(`
    INSERT INTO prepared_tokens
      (campaign_id, monster_id, name, color, size, hp, max_hp, image_path, image_scale, conditions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
  `);

  const ids: number[] = [];
  db.exec("BEGIN");
  try {
    for (let i = 0; i < quantity; i++) {
      const numberedName = quantity > 1 ? `${name} ${i + 1}` : name;
      const result = insert.run(
        campaignId, monsterId, numberedName, color, size, hp, maxHp,
        req.file?.path ?? "", imageScale
      );
      ids.push(Number(result.lastInsertRowid));
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    if (req.file?.path) await unlink(req.file.path).catch(() => {});
    throw error;
  }

  const rows = db.prepare(
    `SELECT * FROM prepared_tokens WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY id`
  ).all(...ids) as any[];
  res.json({ preparedTokens: rows.map(rowToPrepared) });
});

preparedTokensRouter.put("/:id/prepared-tokens/:preparedId", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = campaignRole(req, campaignId);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can edit prepared tokens." });

  const existing = db.prepare(
    "SELECT * FROM prepared_tokens WHERE id = ? AND campaign_id = ?"
  ).get(Number(req.params.preparedId), campaignId) as any;
  if (!existing) return res.status(404).json({ error: "Prepared token not found." });

  const body = req.body ?? {};
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name;
  const color = /^#[0-9a-fA-F]{6}$/.test(body.color ?? "") ? body.color : existing.color;
  const size = [1, 2, 3, 4].includes(Number(body.size)) ? Number(body.size) : existing.size;
  const imageScale = Number.isFinite(Number(body.imageScale))
    ? Math.min(2.5, Math.max(0.5, Number(body.imageScale)))
    : existing.image_scale;
  const maxHp = Number.isFinite(Number(body.maxHp))
    ? Math.max(1, Math.round(Number(body.maxHp)))
    : existing.max_hp;
  const hp = Number.isFinite(Number(body.hp))
    ? Math.max(0, Math.min(maxHp, Math.round(Number(body.hp))))
    : Math.min(existing.hp, maxHp);

  db.prepare(`
    UPDATE prepared_tokens
    SET name = ?, color = ?, size = ?, hp = ?, max_hp = ?, image_scale = ?
    WHERE id = ?
  `).run(name, color, size, hp, maxHp, imageScale, existing.id);

  const updated = db.prepare("SELECT * FROM prepared_tokens WHERE id = ?").get(existing.id);
  res.json({ preparedToken: rowToPrepared(updated) });
});

preparedTokensRouter.post("/:id/prepared-tokens/:preparedId/deploy", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = campaignRole(req, campaignId);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can deploy prepared tokens." });

  const prepared = db.prepare(
    "SELECT * FROM prepared_tokens WHERE id = ? AND campaign_id = ?"
  ).get(Number(req.params.preparedId), campaignId) as any;
  if (!prepared) return res.status(404).json({ error: "Prepared token not found." });

  const mapId = Number(req.body?.mapId);
  const map = db.prepare(
    "SELECT * FROM maps WHERE id = ? AND campaign_id = ?"
  ).get(mapId, campaignId) as any;
  if (!map) return res.status(404).json({ error: "Map not found." });

  const x = Number.isFinite(Number(req.body?.x)) ? Number(req.body.x) : map.grid_size * 1.5;
  const y = Number.isFinite(Number(req.body?.y)) ? Number(req.body.y) : map.grid_size * 1.5;

  const result = db.prepare(`
    INSERT INTO tokens
      (map_id, character_id, monster_id, name, color, x, y, size, hp, max_hp,
       image_path, image_scale, conditions)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    map.id, prepared.monster_id, prepared.name, prepared.color, x, y, prepared.size,
    prepared.hp, prepared.max_hp, prepared.image_path, prepared.image_scale, prepared.conditions
  );

  db.prepare("DELETE FROM prepared_tokens WHERE id = ?").run(prepared.id);
  const token = getToken(Number(result.lastInsertRowid))!;
  getIo().to(`campaign:${campaignId}`).emit("token:create", { campaignId, token });
  res.json({ token });
});

preparedTokensRouter.post("/:id/maps/:mapId/tokens/:tokenId/return-to-tray", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = campaignRole(req, campaignId);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can return tokens to the tray." });

  const token = getToken(Number(req.params.tokenId));
  if (!token || token.campaignId !== campaignId || token.mapId !== Number(req.params.mapId)) {
    return res.status(404).json({ error: "Token not found." });
  }
  if (token.characterId != null) {
    return res.status(400).json({ error: "Player and character tokens cannot enter the prepared tray." });
  }

  const row = db.prepare("SELECT * FROM tokens WHERE id = ?").get(token.id) as any;
  const result = db.prepare(`
    INSERT INTO prepared_tokens
      (campaign_id, monster_id, name, color, size, hp, max_hp, image_path, image_scale, conditions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    campaignId, row.monster_id, row.name, row.color, row.size, row.hp, row.max_hp,
    row.image_path, row.image_scale, row.conditions
  );

  db.prepare("DELETE FROM tokens WHERE id = ?").run(token.id);
  getIo().to(`campaign:${campaignId}`).emit("token:delete", { campaignId, tokenId: token.id });
  const prepared = db.prepare("SELECT * FROM prepared_tokens WHERE id = ?").get(Number(result.lastInsertRowid));
  res.json({ preparedToken: rowToPrepared(prepared) });
});

preparedTokensRouter.delete("/:id/prepared-tokens/:preparedId", async (req, res) => {
  const campaignId = Number(req.params.id);
  const role = campaignRole(req, campaignId);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can delete prepared tokens." });

  const prepared = db.prepare(
    "SELECT * FROM prepared_tokens WHERE id = ? AND campaign_id = ?"
  ).get(Number(req.params.preparedId), campaignId) as any;
  if (!prepared) return res.status(404).json({ error: "Prepared token not found." });

  db.prepare("DELETE FROM prepared_tokens WHERE id = ?").run(prepared.id);
  if (prepared.image_path && canRemoveImage(prepared.image_path, prepared.id)) {
    await unlink(prepared.image_path).catch(() => {});
  }
  res.json({ ok: true });
});

const encounterGroupPayload = (row: any) => {
  const members = db.prepare(`
    SELECT p.id, p.name, p.image_path, p.color, p.size, i.offset_x, i.offset_y
    FROM prepared_encounter_group_items i
    JOIN prepared_tokens p ON p.id = i.prepared_token_id
    WHERE i.group_id = ?
    ORDER BY i.sort_order, i.id
  `).all(row.id) as any[];

  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      imageUrl: member.image_path ? `/uploads/${path.basename(member.image_path)}` : "",
      color: member.color,
      size: member.size,
      offsetX: member.offset_x,
      offsetY: member.offset_y,
    })),
  };
};

preparedTokensRouter.get("/:id/prepared-encounters", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = campaignRole(req, campaignId);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can view prepared encounters." });

  const groups = db.prepare(
    "SELECT * FROM prepared_encounter_groups WHERE campaign_id = ? ORDER BY id DESC"
  ).all(campaignId) as any[];
  res.json({ groups: groups.map(encounterGroupPayload) });
});

preparedTokensRouter.post("/:id/prepared-encounters", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = campaignRole(req, campaignId);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can create prepared encounters." });

  const name = String(req.body?.name ?? "").trim().slice(0, 80);
  const tokenIds: number[] = Array.isArray(req.body?.tokenIds)
    ? [...new Set<number>(
        req.body.tokenIds
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isInteger(value))
      )].slice(0, 40)
    : [];
  if (!name) return res.status(400).json({ error: "The encounter needs a name." });
  if (tokenIds.length < 2) return res.status(400).json({ error: "Choose at least two prepared tokens." });

  const placeholders = tokenIds.map(() => "?").join(",");
  const valid = db.prepare(
    `SELECT id FROM prepared_tokens WHERE campaign_id = ? AND id IN (${placeholders})`
  ).all(campaignId, ...tokenIds) as any[];
  if (valid.length !== tokenIds.length) {
    return res.status(400).json({ error: "One or more prepared tokens are no longer available." });
  }

  db.exec("BEGIN");
  try {
    const result = db.prepare(
      "INSERT INTO prepared_encounter_groups (campaign_id, name) VALUES (?, ?)"
    ).run(campaignId, name);
    const groupId = Number(result.lastInsertRowid);
    const columns = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(tokenIds.length))));
    const insert = db.prepare(`
      INSERT INTO prepared_encounter_group_items
        (group_id, prepared_token_id, offset_x, offset_y, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    tokenIds.forEach((tokenId: number, index: number) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      insert.run(groupId, tokenId, column * 2, row * 2, index);
    });
    db.exec("COMMIT");
    const group = db.prepare("SELECT * FROM prepared_encounter_groups WHERE id = ?").get(groupId);
    res.json({ group: encounterGroupPayload(group) });
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
});

preparedTokensRouter.post("/:id/prepared-encounters/:groupId/deploy", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = campaignRole(req, campaignId);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can deploy prepared encounters." });

  const group = db.prepare(
    "SELECT * FROM prepared_encounter_groups WHERE id = ? AND campaign_id = ?"
  ).get(Number(req.params.groupId), campaignId) as any;
  if (!group) return res.status(404).json({ error: "Prepared encounter not found." });

  const mapId = Number(req.body?.mapId);
  const map = db.prepare(
    "SELECT * FROM maps WHERE id = ? AND campaign_id = ?"
  ).get(mapId, campaignId) as any;
  if (!map) return res.status(404).json({ error: "Map not found." });

  const members = db.prepare(`
    SELECT p.*, i.offset_x, i.offset_y
    FROM prepared_encounter_group_items i
    JOIN prepared_tokens p ON p.id = i.prepared_token_id
    WHERE i.group_id = ?
    ORDER BY i.sort_order, i.id
  `).all(group.id) as any[];
  if (members.length === 0) {
    return res.status(400).json({ error: "This encounter has no available prepared tokens." });
  }

  const anchorX = Number.isFinite(Number(req.body?.x))
    ? Number(req.body.x)
    : map.grid_size * 2;
  const anchorY = Number.isFinite(Number(req.body?.y))
    ? Number(req.body.y)
    : map.grid_size * 2;

  const insert = db.prepare(`
    INSERT INTO tokens
      (map_id, character_id, monster_id, name, color, x, y, size, hp, max_hp,
       image_path, image_scale, conditions)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tokenIds: number[] = [];

  db.exec("BEGIN");
  try {
    for (const member of members) {
      const x = anchorX + member.offset_x * map.grid_size;
      const y = anchorY + member.offset_y * map.grid_size;
      const result = insert.run(
        map.id, member.monster_id, member.name, member.color, x, y, member.size,
        member.hp, member.max_hp, member.image_path, member.image_scale, member.conditions
      );
      tokenIds.push(Number(result.lastInsertRowid));
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const tokens = tokenIds.map((id) => getToken(id)!).filter(Boolean);
  for (const token of tokens) {
    getIo().to(`campaign:${campaignId}`).emit("token:create", { campaignId, token });
  }
  res.json({ tokens });
});

preparedTokensRouter.delete("/:id/prepared-encounters/:groupId", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = campaignRole(req, campaignId);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (!isDMRole(role)) return res.status(403).json({ error: "Only the DM can delete prepared encounters." });

  const group = db.prepare(
    "SELECT id FROM prepared_encounter_groups WHERE id = ? AND campaign_id = ?"
  ).get(Number(req.params.groupId), campaignId) as any;
  if (!group) return res.status(404).json({ error: "Prepared encounter not found." });
  db.prepare("DELETE FROM prepared_encounter_groups WHERE id = ?").run(group.id);
  res.json({ ok: true });
});

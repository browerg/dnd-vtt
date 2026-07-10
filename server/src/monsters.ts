import { Router } from "express";
import { db } from "./db.js";
import { requireAuth } from "./auth.js";

// SRD monster lookups. Read-only for now — custom/homebrew monsters come
// with the Phase 4 homebrew editor.

export const monstersRouter = Router();
monstersRouter.use(requireAuth);

monstersRouter.get("/", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const cr = req.query.cr !== undefined ? Number(req.query.cr) : null;
  let sql = "SELECT id, name, cr, data FROM monsters";
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (q) {
    where.push("name LIKE ? COLLATE NOCASE");
    params.push(`%${q}%`);
  }
  if (cr !== null && Number.isFinite(cr)) {
    where.push("cr = ?");
    params.push(cr);
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += " ORDER BY name LIMIT 50";
  const rows = db.prepare(sql).all(...params) as any[];
  res.json({
    monsters: rows.map((r) => {
      const d = JSON.parse(r.data);
      return {
        id: r.id,
        name: r.name,
        cr: r.cr,
        type: d.type ?? "",
        size: d.size ?? "",
        hp: d.hit_points ?? 0,
        ac: d.armor_class ?? 10,
      };
    }),
  });
});

monstersRouter.get("/:id", (req, res) => {
  const row = db.prepare("SELECT id, name, cr, data FROM monsters WHERE id = ?").get(
    Number(req.params.id)
  ) as any;
  if (!row) return res.status(404).json({ error: "Monster not found." });
  res.json({ monster: { id: row.id, name: row.name, cr: row.cr, ...JSON.parse(row.data) } });
});

import { Router } from "express";
import { db } from "./db.js";
import { requireAuth } from "./auth.js";

export const spellsRouter = Router();
spellsRouter.use(requireAuth);

spellsRouter.get("/", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const level = req.query.level !== undefined ? Number(req.query.level) : null;
  let sql = "SELECT id, name, level, data FROM spells";
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (q) {
    where.push("name LIKE ? COLLATE NOCASE");
    params.push(`%${q}%`);
  }
  if (level !== null && Number.isFinite(level)) {
    where.push("level = ?");
    params.push(level);
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += " ORDER BY level, name LIMIT 40";
  const rows = db.prepare(sql).all(...params) as any[];
  res.json({
    spells: rows.map((r) => {
      const d = JSON.parse(r.data);
      return {
        id: r.id,
        name: r.name,
        level: r.level,
        school: d.school ?? "",
        castingTime: d.casting_time ?? "",
        range: d.range ?? "",
        duration: d.duration ?? "",
        components: d.components ?? "",
        concentration: d.concentration === "yes",
        desc: d.desc ?? "",
        higherLevel: d.higher_level ?? "",
      };
    }),
  });
});

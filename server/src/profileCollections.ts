import type { DatabaseSync } from "node:sqlite";

/** Public profile lists expose only campaigns both people still belong to. */
export function profileCollections(db: DatabaseSync, userId: number, viewerId: number) {
  const characters = (db.prepare(`SELECT c.id, c.name, c.campaign_id AS campaignId, camp.name AS campaignName, c.portrait_path AS portraitPath,
      CASE WHEN json_valid(c.data) THEN c.data ELSE '{}' END AS sheet
    FROM characters c JOIN campaigns camp ON camp.id = c.campaign_id
    JOIN campaign_members owner ON owner.campaign_id = c.campaign_id AND owner.user_id = c.user_id
    WHERE c.user_id = ? AND c.is_npc = 0
      AND (? = ? OR EXISTS(SELECT 1 FROM campaign_members viewer WHERE viewer.campaign_id = c.campaign_id AND viewer.user_id = ?))
    ORDER BY c.updated_at DESC`).all(userId, viewerId, userId, viewerId) as { id: number; name: string; campaignId: number; campaignName: string; portraitPath: string; sheet: string }[]).map(c => {
      const sheet = JSON.parse(c.sheet) ?? {};
      const label = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).slice(0, 80) : "";
      return { id: c.id, name: c.name, campaignId: c.campaignId, campaignName: c.campaignName,
        portraitUrl: c.portraitPath ? `/uploads/${c.portraitPath.split(/[\\/]/).pop()}` : "",
        summary: [label(sheet.archetype), label(sheet.rank)].filter(Boolean).join(" · ") || [label(sheet.race), label(sheet.class), sheet.level ? `level ${label(sheet.level)}` : ""].filter(Boolean).join(" "),
      };
    });
  const campaigns = db.prepare(`SELECT camp.id, camp.name, camp.system, m.role FROM campaign_members m JOIN campaigns camp ON camp.id = m.campaign_id
    WHERE m.user_id = ? AND (? = ? OR EXISTS(SELECT 1 FROM campaign_members viewer WHERE viewer.campaign_id = camp.id AND viewer.user_id = ?))
    ORDER BY camp.id DESC`).all(userId, viewerId, userId, viewerId);
  return { characters, campaigns };
}

import type { DatabaseSync } from "node:sqlite";
import type { AccountAchievementFacts } from "./achievementStore.js";

export function readAccountAchievementFacts(db: DatabaseSync, userId: number): AccountAchievementFacts {
  const profile = db.prepare("SELECT bio, profile_style FROM users WHERE id = ?").get(userId);
  const roles = db.prepare("SELECT role FROM campaign_members WHERE user_id = ?").all(userId);
  const characters = db.prepare(`SELECT COUNT(*) AS n FROM characters c
    JOIN campaign_members m ON m.campaign_id = c.campaign_id AND m.user_id = c.user_id
    WHERE c.user_id = ? AND c.is_npc = 0 AND m.role != 'spectator'`).get(userId);
  return {
    badge_equipped: Number(!!db.prepare(`SELECT 1 FROM profile_badges b JOIN achievement_unlocks u
      ON b.user_id = u.user_id AND b.achievement_id = u.achievement_id WHERE b.user_id = ? LIMIT 1`).get(userId)),
    campaign_member: Number(roles.some((r) => ["player", "dm", "co-dm"].includes(String(r.role)))),
    campaign_dm: Number(roles.some((r) => r.role === "dm")),
    characters_owned: Number(characters?.n ?? 0),
    profile_bio: Number(!!String(profile?.bio ?? "").trim()),
    profile_palette: Number(!!profile?.profile_style && profile.profile_style !== "astral"),
    // Only an explicitly saved, owned effect qualifies. Old amnesty records may
    // include defaults, so exclude them even when an unlock record exists.
    cosmetic_equipped: Number(!!db.prepare(`SELECT 1 FROM (
      SELECT user_id, cosmetic_id FROM cosmetic_loadout
      UNION ALL SELECT user_id, cosmetic_id FROM turn_start_loadout
    ) l JOIN cosmetic_unlocks u ON u.user_id = l.user_id AND u.cosmetic_id = l.cosmetic_id
    WHERE l.user_id = ? AND l.cosmetic_id NOT IN ('crit20-golden', 'crit1-fracture', 'turn-none', 'trail-aura') LIMIT 1`).get(userId)),
  };
}

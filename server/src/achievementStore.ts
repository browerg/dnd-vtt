import type { DatabaseSync } from "node:sqlite";
import type { RollDetail } from "./dice.js";

export const ACHIEVEMENTS = [
  { id: "first-max", name: "Beginner's Luck", description: "Roll your first maximum result.", metric: "maximum", target: 1 },
  { id: "first-min", name: "Well, That Happened", description: "Roll your first minimum result.", metric: "minimum", target: 1 },
  { id: "double-max", name: "You're on Fire!", description: "Roll maximum results twice in a row.", metric: "max_streak", target: 2 },
  { id: "double-min", name: "The Dice Have a Grudge", description: "Roll minimum results twice in a row.", metric: "min_streak", target: 2 },
  { id: "ten-max", name: "Favored by Fate", description: "Roll 10 maximum results.", metric: "maximum", target: 10 },
  { id: "ten-min", name: "Can't Keep Me Down", description: "Roll 10 minimum results.", metric: "minimum", target: 10 },
  { id: "first-quest", name: "The Adventure Begins", description: "Complete your first quest with your campaign.", metric: "quests", target: 1 },
] as const;

type AchievementId = typeof ACHIEVEMENTS[number]["id"];
export interface AchievementUnlock {
  userId: number;
  id: string;
  name: string;
  description: string;
  badgeImage: string;
  badgeThumbnail: string;
  badgeThumbnail2x: string;
}

function badgeArtwork(id: string) {
  return {
    badgeImage: `/assets/achievements/${id}-384.webp`,
    badgeThumbnail: `/assets/achievements/${id}-72.webp`,
    badgeThumbnail2x: `/assets/achievements/${id}-144.webp`,
  };
}
// Add real cosmetic catalog IDs here when the rewards are ready. Reading the
// achievement list also grants newly linked rewards to previous achievers.
export const ACHIEVEMENT_REWARDS: Partial<Record<AchievementId, string>> = {};

export function createAchievementStore(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS achievement_progress (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      maximum INTEGER NOT NULL DEFAULT 0,
      minimum INTEGER NOT NULL DEFAULT 0,
      max_streak INTEGER NOT NULL DEFAULT 0,
      min_streak INTEGER NOT NULL DEFAULT 0,
      quests INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS achievement_unlocks (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id TEXT NOT NULL,
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, achievement_id)
    );
    CREATE TABLE IF NOT EXISTS profile_badges (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 2),
      PRIMARY KEY (user_id, achievement_id),
      UNIQUE (user_id, position)
    );
  `);

  function list(userId: number) {
    const progress = db.prepare("SELECT * FROM achievement_progress WHERE user_id = ?").get(userId);
    const unlocked = db.prepare("SELECT achievement_id, unlocked_at FROM achievement_unlocks WHERE user_id = ?").all(userId);
    return ACHIEVEMENTS.map((definition) => {
      const unlockedAt = unlocked.find((row) => row.achievement_id === definition.id)?.unlocked_at ?? null;
      const rewardCosmeticId = ACHIEVEMENT_REWARDS[definition.id] ?? null;
      if (unlockedAt && rewardCosmeticId) {
        db.prepare("INSERT OR IGNORE INTO cosmetic_unlocks (user_id, cosmetic_id) VALUES (?, ?)").run(userId, rewardCosmeticId);
      }
      return {
        ...definition,
        ...badgeArtwork(definition.id),
        progress: unlockedAt ? definition.target : Math.min(definition.target, Number(progress?.[definition.metric] ?? 0)),
        unlockedAt,
        rewardCosmeticId,
      };
    });
  }

  function unlock(userId: number) {
    const newlyUnlocked: AchievementUnlock[] = [];
    const progress = db.prepare("SELECT * FROM achievement_progress WHERE user_id = ?").get(userId)!;
    for (const definition of ACHIEVEMENTS) {
      if (Number(progress[definition.metric]) >= definition.target) {
        const result = db.prepare("INSERT OR IGNORE INTO achievement_unlocks (user_id, achievement_id) VALUES (?, ?)").run(userId, definition.id);
        if (Number(result.changes) > 0) newlyUnlocked.push({ userId, id: definition.id, name: definition.name,
          description: definition.description, ...badgeArtwork(definition.id) });
      }
    }
    return newlyUnlocked;
  }

  function recordRoll(userId: number, detail: RollDetail, visibility: string) {
    // Blind results must not become visible through achievement progress.
    if (detail.manual || visibility === "blind") return [];
    const groups = detail.kept.groups;
    if (!groups.length || groups.some((g) => !g.results.length)) return [];
    // A whole roll earns at most one result. Modifiers and discarded dice do
    // not affect a natural maximum/minimum, including Remnant dice pools.
    const maximum = groups.every((g) => g.results.every((face) => face === g.sides));
    const minimum = groups.every((g) => g.results.every((face) => face === 1));
    db.exec("SAVEPOINT achievement_roll");
    try {
      db.prepare("INSERT OR IGNORE INTO achievement_progress (user_id) VALUES (?)").run(userId);
      db.prepare(`UPDATE achievement_progress SET
        maximum = MIN(10, maximum + ?), minimum = MIN(10, minimum + ?),
        max_streak = CASE WHEN ? THEN MIN(2, max_streak + 1) ELSE 0 END,
        min_streak = CASE WHEN ? THEN MIN(2, min_streak + 1) ELSE 0 END
        WHERE user_id = ?`).run(Number(maximum), Number(minimum), Number(maximum), Number(minimum), userId);
      const newlyUnlocked = unlock(userId);
      db.exec("RELEASE achievement_roll");
      return newlyUnlocked;
    } catch (error) {
      db.exec("ROLLBACK TO achievement_roll; RELEASE achievement_roll");
      throw error;
    }
  }

  // Called inside the existing one-time quest reward transaction, even at 0 VCoins.
  function recordQuest(userIds: number[]) {
    const newlyUnlocked: AchievementUnlock[] = [];
    for (const userId of new Set(userIds)) {
      db.prepare(`INSERT INTO achievement_progress (user_id, quests) VALUES (?, 1)
        ON CONFLICT(user_id) DO UPDATE SET quests = 1`).run(userId);
      newlyUnlocked.push(...unlock(userId));
    }
    return newlyUnlocked;
  }

  function showcase(userId: number) {
    const rows = db.prepare(`SELECT p.achievement_id FROM profile_badges p
      JOIN achievement_unlocks u ON u.user_id = p.user_id AND u.achievement_id = p.achievement_id
      WHERE p.user_id = ? ORDER BY p.position`).all(userId);
    return rows.flatMap((row) => {
      const definition = ACHIEVEMENTS.find((a) => a.id === row.achievement_id);
      return definition ? [{ id: definition.id, name: definition.name, description: definition.description,
        ...badgeArtwork(definition.id) }] : [];
    });
  }

  function setShowcase(userId: number, ids: unknown) {
    if (!Array.isArray(ids) || ids.length > 3 || ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) {
      throw new Error("Choose up to three different earned badges.");
    }
    const unlocked = db.prepare("SELECT achievement_id FROM achievement_unlocks WHERE user_id = ?").all(userId);
    if (ids.some((id) => !ACHIEVEMENTS.some((a) => a.id === id) || !unlocked.some((row) => row.achievement_id === id))) {
      throw new Error("You can only display badges you have earned.");
    }
    db.exec("SAVEPOINT profile_showcase");
    try {
      db.prepare("DELETE FROM profile_badges WHERE user_id = ?").run(userId);
      ids.forEach((id, position) => db.prepare("INSERT INTO profile_badges (user_id, achievement_id, position) VALUES (?, ?, ?)").run(userId, id, position));
      db.exec("RELEASE profile_showcase");
    } catch (error) {
      db.exec("ROLLBACK TO profile_showcase; RELEASE profile_showcase");
      throw error;
    }
    return showcase(userId);
  }

  return { list, recordRoll, recordQuest, showcase, setShowcase };
}

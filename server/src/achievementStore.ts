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
  { id: "first-roll", name: "Let Fate Decide", description: "Make your first eligible in-app dice roll.", metric: "rolls", target: 1 },
  { id: "hundred-rolls", name: "Dice Goblin", description: "Make 100 eligible in-app dice rolls.", metric: "rolls", target: 100 },
  { id: "thousand-rolls", name: "Certified Dice Gremlin", description: "Make 1,000 eligible in-app dice rolls.", metric: "rolls", target: 1000 },
  { id: "max-then-min", name: "Emotional Whiplash", description: "Roll a maximum, then a minimum on your next eligible roll.", metric: "max_then_min", target: 1 },
  { id: "min-then-max", name: "The Comeback", description: "Roll a minimum, then a maximum on your next eligible roll.", metric: "min_then_max", target: 1 },
  { id: "triple-max", name: "Third Time's the Charm", description: "Roll three maximum results consecutively.", metric: "max_streak", target: 3 },
  { id: "five-quests", name: "Side Quest Enthusiast", description: "Complete 5 distinct quests with your campaigns.", metric: "quests", target: 5 },
  { id: "twenty-five-quests", name: "The Plot Depends on Me", description: "Complete 25 distinct quests with your campaigns.", metric: "quests", target: 25 },
  { id: "first-purchase", name: "A Little Treat", description: "Purchase your first cosmetic with VCoins.", metric: "purchases", target: 1 },
  { id: "full-showcase", name: "A Whole New Persona", description: "Display three earned badges on your profile.", metric: "full_showcase", target: 1 },
  { id: "first-badge", name: "Wear It Proud", description: "Equip an earned badge on your profile.", metric: "badge_equipped", target: 1 },
  { id: "first-campaign", name: "Seat at the Table", description: "Be a player, DM, or co-DM in a campaign.", metric: "campaign_member", target: 1 },
  { id: "first-dm", name: "Behind the Screen", description: "Host a campaign as its DM.", metric: "campaign_dm", target: 1 },
  { id: "first-character", name: "A Hero Is Born", description: "Own your first player character in a campaign.", metric: "characters_owned", target: 1 },
  { id: "three-characters", name: "The Usual Suspects", description: "Have three player characters across your campaigns.", metric: "characters_owned", target: 3 },
  { id: "profile-bio", name: "In My Own Words", description: "Add a bio to your profile.", metric: "profile_bio", target: 1 },
  { id: "profile-palette", name: "True Colors", description: "Save a profile palette other than Astral violet.", metric: "profile_palette", target: 1 },
  { id: "first-cosmetic", name: "Dressed to Impress", description: "Equip an unlocked cosmetic effect other than a default effect.", metric: "cosmetic_equipped", target: 1 },
  { id: "triple-min", name: "Rock Bottom Has a Basement", description: "Roll three minimum results consecutively.", metric: "min_streak", target: 3 },
  { id: "ten-quests", name: "Quest Regular", description: "Complete 10 distinct quests with your campaigns.", metric: "quests", target: 10 },
] as const;

export const ACCOUNT_METRICS = ["badge_equipped", "campaign_member", "campaign_dm", "characters_owned", "profile_bio", "profile_palette", "cosmetic_equipped"] as const;
export type AccountAchievementFacts = Record<typeof ACCOUNT_METRICS[number], number>;

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
    CREATE TABLE IF NOT EXISTS achievement_quest_credits (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quest_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, quest_id)
    );
  `);
  // Older installs stored only the first quest and capped max streaks at two.
  // Preserve that known credit; do not invent totals from incomplete history.
  const columns = new Set(db.prepare("PRAGMA table_info(achievement_progress)").all().map((column) => column.name));
  for (const column of ["rolls", "max_then_min", "min_then_max", "purchases", "full_showcase", ...ACCOUNT_METRICS]) {
    if (!columns.has(column)) db.exec(`ALTER TABLE achievement_progress ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`);
  }

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
        rolls = MIN(1000, rolls + 1),
        max_then_min = MAX(max_then_min, CASE WHEN ? AND max_streak > 0 THEN 1 ELSE 0 END),
        min_then_max = MAX(min_then_max, CASE WHEN ? AND min_streak > 0 THEN 1 ELSE 0 END),
        maximum = MIN(10, maximum + ?), minimum = MIN(10, minimum + ?),
        max_streak = CASE WHEN ? THEN MIN(3, max_streak + 1) ELSE 0 END,
        min_streak = CASE WHEN ? THEN MIN(3, min_streak + 1) ELSE 0 END
        WHERE user_id = ?`).run(Number(minimum), Number(maximum), Number(maximum), Number(minimum), Number(maximum), Number(minimum), userId);
      const newlyUnlocked = unlock(userId);
      db.exec("RELEASE achievement_roll");
      return newlyUnlocked;
    } catch (error) {
      db.exec("ROLLBACK TO achievement_roll; RELEASE achievement_roll");
      throw error;
    }
  }

  // Called inside the existing one-time quest reward transaction, even at 0 VCoins.
  function recordQuest(userIds: number[], questId: number) {
    const newlyUnlocked: AchievementUnlock[] = [];
    db.exec("SAVEPOINT achievement_quest");
    try {
      for (const userId of new Set(userIds)) {
        const claim = db.prepare("INSERT OR IGNORE INTO achievement_quest_credits (user_id, quest_id) VALUES (?, ?)").run(userId, questId);
        if (!Number(claim.changes)) continue;
        db.prepare(`INSERT INTO achievement_progress (user_id, quests) VALUES (?, 1)
          ON CONFLICT(user_id) DO UPDATE SET quests = MIN(25, quests + 1)`).run(userId);
        newlyUnlocked.push(...unlock(userId));
      }
      db.exec("RELEASE achievement_quest");
    } catch (error) {
      db.exec("ROLLBACK TO achievement_quest; RELEASE achievement_quest");
      throw error;
    }
    return newlyUnlocked;
  }

  // Only called inside the successful paid-purchase transaction, after debit.
  function recordPurchase(userId: number) {
    db.prepare(`INSERT INTO achievement_progress (user_id, purchases) VALUES (?, 1)
      ON CONFLICT(user_id) DO UPDATE SET purchases = 1`).run(userId);
    return unlock(userId);
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

  // Server-owned snapshots also recognize qualifying data from before this update.
  // Keep earned progress when a profile is edited or a campaign is later deleted.
  function recordAccountFacts(userId: number, facts: AccountAchievementFacts) {
    db.exec("SAVEPOINT achievement_account");
    try {
      db.prepare("INSERT OR IGNORE INTO achievement_progress (user_id) VALUES (?)").run(userId);
      for (const metric of ACCOUNT_METRICS) {
        const limit = metric === "characters_owned" ? 3 : 1;
        const value = Math.min(limit, Math.max(0, Math.floor(facts[metric])));
        if (!Number.isFinite(value)) throw new Error("Invalid achievement fact.");
        db.prepare(`UPDATE achievement_progress SET ${metric} = MAX(${metric}, ?) WHERE user_id = ?`).run(value, userId);
      }
      const unlocks = unlock(userId);
      db.exec("RELEASE achievement_account");
      return unlocks;
    } catch (error) {
      db.exec("ROLLBACK TO achievement_account; RELEASE achievement_account");
      throw error;
    }
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
    let unlocks: AchievementUnlock[] = [];
    try {
      db.prepare("DELETE FROM profile_badges WHERE user_id = ?").run(userId);
      ids.forEach((id, position) => db.prepare("INSERT INTO profile_badges (user_id, achievement_id, position) VALUES (?, ?, ?)").run(userId, id, position));
      if (ids.length > 0) {
        db.prepare(`INSERT INTO achievement_progress (user_id, badge_equipped) VALUES (?, 1)
          ON CONFLICT(user_id) DO UPDATE SET badge_equipped = 1`).run(userId);
      }
      if (ids.length === 3) {
        db.prepare(`INSERT INTO achievement_progress (user_id, full_showcase) VALUES (?, 1)
          ON CONFLICT(user_id) DO UPDATE SET full_showcase = 1`).run(userId);
      }
      if (ids.length > 0) unlocks = unlock(userId);
      db.exec("RELEASE profile_showcase");
    } catch (error) {
      db.exec("ROLLBACK TO profile_showcase; RELEASE profile_showcase");
      throw error;
    }
    return { showcase: showcase(userId), unlocks };
  }

  return { list, recordRoll, recordQuest, recordPurchase, recordAccountFacts, showcase, setShowcase };
}

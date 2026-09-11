import { db } from "./db.js";
import { createAchievementStore, type AchievementUnlock } from "./achievementStore.js";
import { readAccountAchievementFacts } from "./accountAchievementFacts.js";
import { getIo } from "./realtime.js";

export const achievements = createAchievementStore(db);

// Call only after the action commits. Each account has a private socket room.
export function notifyAchievementUnlocks(unlocks: AchievementUnlock[]) {
  for (const { userId, ...achievement } of unlocks) {
    getIo().to(`user:${userId}`).emit("achievement:unlocked", achievement);
  }
}

export function reconcileAccountAchievements(userId: number) {
  notifyAchievementUnlocks(achievements.recordAccountFacts(userId, readAccountAchievementFacts(db, userId)));
}

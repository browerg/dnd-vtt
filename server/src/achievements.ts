import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { createAchievementStore, type AchievementUnlock } from "./achievementStore.js";
import { getIo } from "./realtime.js";

// Call only after the transaction commits. A private account room prevents
// other players from receiving unlocks from private rolls.
export function notifyAchievementUnlocks(unlocks: AchievementUnlock[]) {
  for (const { userId, ...achievement } of unlocks) {
    getIo().to(`user:${userId}`).emit("achievement:unlocked", achievement);
  }
}

export const achievements = createAchievementStore(db);
export const achievementsRouter = Router();
achievementsRouter.use(requireAuth);
achievementsRouter.get("/", (req: Request, res) => {
  const userId = (req as Request & { user: SessionUser }).user.id;
  res.json({ achievements: achievements.list(userId), showcase: achievements.showcase(userId) });
});

achievementsRouter.put("/showcase", (req: Request, res) => {
  const userId = (req as Request & { user: SessionUser }).user.id;
  try {
    res.json({ showcase: achievements.setShowcase(userId, req.body?.badgeIds) });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Only the badges a player chooses to display are shared, never roll history,
// locked achievement progress, email, or other account details.
achievementsRouter.get("/profiles/:userId", (req: Request, res) => {
  const viewerId = (req as Request & { user: SessionUser }).user.id;
  const userId = Number(req.params.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) return res.status(404).json({ error: "Profile not found." });
  const shared = db.prepare(`SELECT 1 FROM campaign_members viewer
    JOIN campaign_members member ON viewer.campaign_id = member.campaign_id
    WHERE viewer.user_id = ? AND member.user_id = ? LIMIT 1`).get(viewerId, userId);
  if (viewerId !== userId && !shared) return res.status(404).json({ error: "Profile not found." });
  const profile = db.prepare("SELECT id, display_name, avatar_path AS avatarPath FROM users WHERE id = ?").get(userId);
  if (!profile) return res.status(404).json({ error: "Profile not found." });
  res.json({ profile, showcase: achievements.showcase(userId) });
});

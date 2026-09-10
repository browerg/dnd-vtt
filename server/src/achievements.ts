import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { createAchievementStore } from "./achievementStore.js";

export const achievements = createAchievementStore(db);
export const achievementsRouter = Router();
achievementsRouter.use(requireAuth);
achievementsRouter.get("/", (req: Request, res) => {
  res.json({ achievements: achievements.list((req as Request & { user: SessionUser }).user.id) });
});

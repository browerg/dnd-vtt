import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { profileCollections } from "./profileCollections.js";
import { ownsMythicDice } from "./diceOwnership.js";
import { mythicDiceForTheme } from "../../shared/mythicDice.js";
import { readProfileGallery } from "../../shared/profileGallery.js";
import { achievements, notifyAchievementUnlocks, reconcileAccountAchievements } from "./achievementTracking.js";
export { achievements, notifyAchievementUnlocks } from "./achievementTracking.js";
export const achievementsRouter = Router();
achievementsRouter.use(requireAuth);
achievementsRouter.get("/", (req: Request, res) => {
  const userId = (req as Request & { user: SessionUser }).user.id;
  reconcileAccountAchievements(userId);
  res.json({ achievements: achievements.list(userId), showcase: achievements.showcase(userId) });
});

achievementsRouter.put("/showcase", (req: Request, res) => {
  const userId = (req as Request & { user: SessionUser }).user.id;
  try {
    const result = achievements.setShowcase(userId, req.body?.badgeIds);
    notifyAchievementUnlocks(result.unlocks);
    res.json({ showcase: result.showcase });
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
  const row = db.prepare("SELECT id, display_name, avatar_path AS avatarPath, pronouns, bio, profile_style AS profileStyle, dice_theme AS diceTheme, profile_gallery AS galleryJson, EXISTS(SELECT 1 FROM cosmetic_unlocks cu WHERE cu.user_id = users.id AND cu.cosmetic_id = 'title-relic-owner') AS relicOwner FROM users WHERE id = ?").get(userId) as (Record<string, unknown> & { galleryJson: string }) | undefined;
  if (!row) return res.status(404).json({ error: "Profile not found." });
  const { galleryJson, ...profile } = row;
  const gallery = readProfileGallery(galleryJson, true);
  for (const field of ["signatureDice"] as const) {
    if (mythicDiceForTheme(gallery[field]) && !ownsMythicDice(db, userId, gallery[field])) gallery[field] = "";
  }
  if (typeof profile.diceTheme === "string" && mythicDiceForTheme(profile.diceTheme) && !ownsMythicDice(db, userId, profile.diceTheme)) profile.diceTheme = "white";
  res.json({ profile: { ...profile, profileGallery: gallery }, showcase: achievements.showcase(userId), ...profileCollections(db, userId, viewerId) });
});

import type { DatabaseSync } from "node:sqlite";

export type DeleteCampaignResult = { ok: true } | { ok: false; status: 400 | 403 | 404; error: string };

/**
 * Permanently deletes a campaign. Only its DM may, and they must type the
 * campaign's name to confirm. Everything the campaign owns (maps, tokens,
 * characters, chat, quests, invites…) goes with it through ON DELETE CASCADE.
 */
export function deleteCampaign(db: DatabaseSync, campaignId: number, actorId: number, confirmName: unknown): DeleteCampaignResult {
  const campaign = db.prepare("SELECT name FROM campaigns WHERE id = ?").get(campaignId) as { name: string } | undefined;
  const role = (db.prepare("SELECT role FROM campaign_members WHERE campaign_id = ? AND user_id = ?")
    .get(campaignId, actorId) as { role: string } | undefined)?.role;
  if (!campaign || !role) return { ok: false, status: 404, error: "Campaign not found." };
  if (role !== "dm") return { ok: false, status: 403, error: "Only the campaign's DM can delete it." };
  if (String(confirmName ?? "").trim() !== campaign.name.trim()) {
    return { ok: false, status: 400, error: "Type the campaign's name exactly to confirm." };
  }
  db.prepare("DELETE FROM campaigns WHERE id = ?").run(campaignId);
  return { ok: true };
}

import type { DatabaseSync } from "node:sqlite";

export const MIN_PASSWORD_LENGTH = 8;

export type SetMemberPasswordResult =
  | { ok: true; displayName: string }
  | { ok: false; status: 400 | 403 | 404; error: string };

/**
 * A GM sets a new password for someone in their campaign, for a table of
 * friends with no email recovery. DMs and co-DMs may reset players; only the
 * DM may reset a co-DM; nobody resets the DM, and nobody uses this on
 * themselves (they have Change password). The member's other sessions end and
 * any pending recovery links are voided.
 */
export function setMemberPassword(
  db: DatabaseSync,
  campaignId: number,
  actorId: number,
  targetId: number,
  password: string,
  hash: (password: string) => string,
): SetMemberPasswordResult {
  const roleOf = (userId: number) => (db
    .prepare("SELECT role FROM campaign_members WHERE campaign_id = ? AND user_id = ?")
    .get(campaignId, userId) as { role: string } | undefined)?.role ?? null;
  const actorRole = roleOf(actorId);
  if (actorRole !== "dm" && actorRole !== "co-dm") {
    return { ok: false, status: 403, error: "Only the GM can set a player's password." };
  }
  if (actorId === targetId) {
    return { ok: false, status: 400, error: "Change your own password from your profile." };
  }
  const targetRole = roleOf(targetId);
  if (!targetRole) return { ok: false, status: 404, error: "That player isn't in this campaign." };
  if (targetRole === "dm" || (targetRole === "co-dm" && actorRole !== "dm")) {
    return { ok: false, status: 403, error: "You can't set another GM's password." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, status: 400, error: `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  const target = db.prepare("SELECT display_name FROM users WHERE id = ?").get(targetId) as { display_name: string } | undefined;
  if (!target) return { ok: false, status: 404, error: "That player isn't in this campaign." };

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash(password), targetId);
    db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(targetId);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(targetId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true, displayName: target.display_name };
}

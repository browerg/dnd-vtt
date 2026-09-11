import type { DatabaseSync } from "node:sqlite";

// Kept separate from chat.ts so tests can exercise these rules without
// importing the module graph that opens the real database.

/** The quoted snippet a reply carries, so the client needs no second lookup. */
export interface ChatReplyPreview {
  id: number;
  author: string; // the IC speaker where there is one, otherwise the account name
  body: string; // truncated — the full message is already in the log
}

export type ReplyResolution =
  | { ok: true; replyToId: number | null; replyTo: ChatReplyPreview | null }
  | { ok: false; status: number; error: string };

const REPLY_PREVIEW_CHARS = 140;

export const previewOf = (
  row: { id: number; speaker: string; user_name: string; body: string } | undefined
): ChatReplyPreview | null =>
  row
    ? {
        id: Number(row.id),
        author: row.speaker || row.user_name,
        body:
          row.body.length > REPLY_PREVIEW_CHARS
            ? `${row.body.slice(0, REPLY_PREVIEW_CHARS).trimEnd()}…`
            : row.body,
      }
    : null;

/**
 * Validates what a message is allowed to reply to: a reply must sit in the same
 * campaign *and* the same channel, and a whisper may only be quoted by the two
 * people in it. Takes the database as an argument so it stays testable.
 */
export function resolveReply(
  database: Pick<DatabaseSync, "prepare">,
  options: { requested: unknown; campaignId: number; channel: string; userId: number }
): ReplyResolution {
  const { requested, campaignId, channel, userId } = options;
  if (requested === undefined || requested === null || requested === "") {
    return { ok: true, replyToId: null, replyTo: null };
  }

  const candidate = Number(requested);
  if (!Number.isInteger(candidate) || candidate < 1) {
    return { ok: false, status: 400, error: "That message can't be replied to." };
  }

  const parent = database
    .prepare(
      `SELECT m.id, m.campaign_id, m.channel, m.user_id, m.target_user_id, m.speaker, m.body,
              u.display_name AS user_name
       FROM messages m JOIN users u ON u.id = m.user_id
       WHERE m.id = ?`
    )
    .get(candidate) as any;

  // Keeping replies in-channel is what stops a whisper being quoted into public
  // chat, and it means anyone who can see the reply can already see what it
  // quotes — so no extra visibility check is needed downstream.
  if (!parent || parent.campaign_id !== campaignId || parent.channel !== channel) {
    return { ok: false, status: 400, error: "You can only reply to a message in this channel." };
  }
  if (parent.channel === "whisper" && parent.user_id !== userId && parent.target_user_id !== userId) {
    return { ok: false, status: 403, error: "You can't reply to that whisper." };
  }

  return { ok: true, replyToId: Number(parent.id), replyTo: previewOf(parent) };
}

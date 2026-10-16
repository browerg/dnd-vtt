import type { DatabaseSync } from "node:sqlite";
import { cleanPersona, messageThreadKey, parseThreadKey, type ThreadMessage } from "../../shared/chatThreads.js";

// Kept apart from chat.ts so the rules can be tested against an in-memory DB.

export const WHISPER_THREADS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS whisper_threads_hidden (
    campaign_id     INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_key      TEXT NOT NULL,
    hidden_through  INTEGER NOT NULL,
    PRIMARY KEY (campaign_id, user_id, thread_key)
  );
`;

export type TargetSpeakerResult = { ok: true; targetSpeaker: string } | { ok: false; status: 400; error: string };

/**
 * Which persona of the recipient a private message is addressed to. You can
 * only write to a persona that person has actually texted you as; a reply to
 * one of their persona's messages is addressed to that persona automatically.
 */
export function resolveTargetSpeaker(db: DatabaseSync, options: {
  campaignId: number; senderId: number; targetUserId: number; requested: unknown; replyToId: number | null;
}): TargetSpeakerResult {
  const { campaignId, senderId, targetUserId, replyToId } = options;
  const requested = cleanPersona(options.requested);
  if (requested) {
    const known = db.prepare(
      `SELECT 1 FROM messages WHERE campaign_id = ? AND channel = 'whisper' AND user_id = ? AND target_user_id = ? AND speaker = ? LIMIT 1`
    ).get(campaignId, targetUserId, senderId, requested);
    if (!known) return { ok: false, status: 400, error: "That contact hasn't messaged you." };
    return { ok: true, targetSpeaker: requested };
  }
  if (replyToId) {
    const parent = db.prepare("SELECT user_id, speaker FROM messages WHERE id = ?").get(replyToId) as { user_id: number; speaker: string } | undefined;
    if (parent && parent.user_id === targetUserId && parent.speaker) return { ok: true, targetSpeaker: parent.speaker };
  }
  return { ok: true, targetSpeaker: "" };
}

/** Clears a conversation from one person's Scroll; the other person keeps theirs. New messages bring it back. */
export function hideThread(db: DatabaseSync, campaignId: number, userId: number, key: unknown): { ok: true } | { ok: false; status: 400; error: string } {
  const thread = parseThreadKey(key);
  if (!thread) return { ok: false, status: 400, error: "That conversation doesn't exist." };
  const { otherId, otherPersona, myPersona } = thread;
  const row = db.prepare(
    `SELECT MAX(id) AS last FROM messages WHERE campaign_id = ? AND channel = 'whisper' AND (
       (user_id = ? AND target_user_id = ? AND speaker = ? AND target_speaker = ?) OR
       (user_id = ? AND target_user_id = ? AND speaker = ? AND target_speaker = ?))`
  ).get(campaignId, userId, otherId, myPersona, otherPersona, otherId, userId, otherPersona, myPersona) as { last: number | null };
  if (row.last == null) return { ok: true };
  db.prepare(
    `INSERT INTO whisper_threads_hidden (campaign_id, user_id, thread_key, hidden_through) VALUES (?, ?, ?, ?)
     ON CONFLICT (campaign_id, user_id, thread_key) DO UPDATE SET hidden_through = MAX(hidden_through, excluded.hidden_through)`
  ).run(campaignId, userId, key as string, row.last);
  return { ok: true };
}

/** Drops whispers from conversations this person has deleted (up to when they deleted them). */
export function hiddenWhisperFilter(db: DatabaseSync, campaignId: number, userId: number) {
  const rows = db.prepare("SELECT thread_key, hidden_through FROM whisper_threads_hidden WHERE campaign_id = ? AND user_id = ?")
    .all(campaignId, userId) as { thread_key: string; hidden_through: number }[];
  const hidden = new Map(rows.map(row => [row.thread_key, Number(row.hidden_through)]));
  return (message: ThreadMessage & { id: number }) => {
    if (!hidden.size || message.channel !== "whisper") return true;
    const key = messageThreadKey(message, userId);
    const through = key ? hidden.get(key) : undefined;
    return through == null || message.id > through;
  };
}

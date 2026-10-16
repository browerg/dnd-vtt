/**
 * Private-message conversations, as each person sees them on their Scroll.
 * A conversation is the other person plus the two personas in play: who you
 * are talking *to* (a player, or an NPC/contact the GM writes as) and who you
 * are talking *as* (yourself, or for the GM an NPC/contact). So the GM texting
 * Ruby as "Ozpin" and as themselves are two separate conversations, and Ruby's
 * replies to Ozpin stay with Ozpin.
 */
export interface ThreadMessage {
  channel: string;
  userId: number;
  targetUserId: number | null;
  speaker: string;
  targetSpeaker: string;
}

export interface ThreadRef {
  /** The other person in the conversation (their account). */
  otherId: number;
  /** Who you are writing to: "" for the person themselves, or their persona. */
  otherPersona: string;
  /** Who you are writing as: "" for yourself, or your persona (GM only). */
  myPersona: string;
}

const PERSONA_LIMIT = 40;
export const cleanPersona = (value: unknown) => String(value ?? "").trim().slice(0, PERSONA_LIMIT);

export function threadOf(message: ThreadMessage, viewerId: number): ThreadRef | null {
  if (message.channel !== "whisper" || message.targetUserId == null) return null;
  if (message.userId === viewerId) {
    return { otherId: message.targetUserId, otherPersona: message.targetSpeaker || "", myPersona: message.speaker || "" };
  }
  if (message.targetUserId === viewerId) {
    return { otherId: message.userId, otherPersona: message.speaker || "", myPersona: message.targetSpeaker || "" };
  }
  return null;
}

// "|" never appears in an id and is escaped out of personas, so keys round-trip.
const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\|/g, "\\p");
const unescape = (value: string) => value.replace(/\\p/g, "|").replace(/\\\\/g, "\\");

export function threadKey(thread: ThreadRef): string {
  return `${thread.otherId}|${escape(thread.otherPersona)}|${escape(thread.myPersona)}`;
}

export function parseThreadKey(key: unknown): ThreadRef | null {
  if (typeof key !== "string" || key.length > 200) return null;
  const parts = key.split("|");
  if (parts.length !== 3) return null;
  const otherId = Number(parts[0]);
  if (!Number.isInteger(otherId) || otherId <= 0) return null;
  const otherPersona = unescape(parts[1]);
  const myPersona = unescape(parts[2]);
  if (otherPersona.length > PERSONA_LIMIT || myPersona.length > PERSONA_LIMIT) return null;
  return { otherId, otherPersona, myPersona };
}

export const messageThreadKey = (message: ThreadMessage, viewerId: number) => {
  const thread = threadOf(message, viewerId);
  return thread ? threadKey(thread) : null;
};

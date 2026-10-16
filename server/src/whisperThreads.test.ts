import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { messageThreadKey, parseThreadKey, threadKey, threadOf } from "../../shared/chatThreads.js";
import { hiddenWhisperFilter, hideThread, resolveTargetSpeaker, WHISPER_THREADS_SCHEMA } from "./whisperThreads.js";

const GM = 1, RUBY = 2, WEISS = 3;
const whisper = (id: number, userId: number, targetUserId: number, speaker = "", targetSpeaker = "") =>
  ({ id, channel: "whisper", userId, targetUserId, speaker, targetSpeaker });

test("each persona pairing is its own conversation, seen consistently from both sides", () => {
  const asOzpin = whisper(1, GM, RUBY, "Ozpin");
  const rubyReply = whisper(2, RUBY, GM, "", "Ozpin");
  const asSelf = whisper(3, GM, RUBY);
  // Ruby sees Ozpin and the GM as two contacts; her reply joins Ozpin's thread.
  assert.equal(messageThreadKey(asOzpin, RUBY), messageThreadKey(rubyReply, RUBY));
  assert.notEqual(messageThreadKey(asOzpin, RUBY), messageThreadKey(asSelf, RUBY));
  // The GM sees the same split, from their side.
  assert.deepEqual(threadOf(rubyReply, GM), { otherId: RUBY, otherPersona: "", myPersona: "Ozpin" });
  assert.equal(messageThreadKey(asOzpin, GM), messageThreadKey(rubyReply, GM));
  assert.equal(messageThreadKey(whisper(4, GM, WEISS, "Ozpin"), GM) === messageThreadKey(asOzpin, GM), false, "another player is another conversation");
  assert.equal(messageThreadKey({ ...asOzpin, channel: "ooc" }, RUBY), null);
  assert.equal(messageThreadKey(asOzpin, WEISS), null, "outsiders have no thread");
});

test("thread keys round-trip personas with separators in them", () => {
  const thread = { otherId: 7, otherPersona: "Unknown | number", myPersona: "back\\slash" };
  assert.deepEqual(parseThreadKey(threadKey(thread)), thread);
  for (const bad of ["", "x|y|z", "0||", "1|a", 42, "1|" + "a".repeat(60) + "|"]) assert.equal(parseThreadKey(bad), null);
});

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY);
    CREATE TABLE campaigns (id INTEGER PRIMARY KEY);
    CREATE TABLE messages (id INTEGER PRIMARY KEY, campaign_id INTEGER, user_id INTEGER, channel TEXT,
      target_user_id INTEGER, speaker TEXT NOT NULL DEFAULT '', target_speaker TEXT NOT NULL DEFAULT '', body TEXT, reply_to_id INTEGER);
    INSERT INTO users VALUES (1),(2),(3); INSERT INTO campaigns VALUES (1),(2);
    INSERT INTO messages (id, campaign_id, user_id, channel, target_user_id, speaker, target_speaker, body) VALUES
      (1, 1, 1, 'whisper', 2, 'Ozpin', '', 'Come to my office.'),
      (2, 1, 2, 'whisper', 1, '', 'Ozpin', 'On my way.'),
      (3, 1, 1, 'whisper', 2, '', '', 'GM here, out of character.'),
      (4, 2, 1, 'whisper', 2, 'Ozpin', '', 'Other campaign.');
  ${WHISPER_THREADS_SCHEMA}`);
  return db;
}

test("you can only write to a persona that has written to you; replies address it automatically", () => {
  const db = fixture();
  const resolve = (senderId: number, targetUserId: number, requested: unknown, replyToId: number | null = null) =>
    resolveTargetSpeaker(db, { campaignId: 1, senderId, targetUserId, requested, replyToId });
  assert.deepEqual(resolve(RUBY, GM, "Ozpin"), { ok: true, targetSpeaker: "Ozpin" });
  assert.equal(resolve(RUBY, GM, "Salem").ok, false, "no such contact");
  assert.equal(resolve(WEISS, GM, "Ozpin").ok, false, "Ozpin never texted Weiss");
  assert.deepEqual(resolve(RUBY, GM, "", 1), { ok: true, targetSpeaker: "Ozpin" }, "reply to Ozpin goes to Ozpin");
  assert.deepEqual(resolve(RUBY, GM, "", 3), { ok: true, targetSpeaker: "" });
  assert.deepEqual(resolve(GM, RUBY, undefined), { ok: true, targetSpeaker: "" });
});

test("deleting a conversation clears it from your Scroll only, until someone writes again", () => {
  const db = fixture();
  const rows = () => db.prepare("SELECT id, channel, user_id AS userId, target_user_id AS targetUserId, speaker, target_speaker AS targetSpeaker FROM messages WHERE campaign_id = 1").all() as any[];
  const ozpinWithRuby = threadKey({ otherId: GM, otherPersona: "Ozpin", myPersona: "" });
  assert.deepEqual(hideThread(db, 1, RUBY, ozpinWithRuby), { ok: true });
  assert.deepEqual(rows().filter(hiddenWhisperFilter(db, 1, RUBY)).map(m => m.id), [3], "Ozpin's thread is gone, the GM's stays");
  assert.deepEqual(rows().filter(hiddenWhisperFilter(db, 1, GM)).map(m => m.id), [1, 2, 3], "the GM still has it");
  db.exec("INSERT INTO messages (id, campaign_id, user_id, channel, target_user_id, speaker, body) VALUES (5, 1, 1, 'whisper', 2, 'Ozpin', 'One more thing.')");
  assert.deepEqual(rows().filter(hiddenWhisperFilter(db, 1, RUBY)).map(m => m.id), [3, 5], "a new message starts it fresh");
  assert.equal(hideThread(db, 1, RUBY, "nonsense").ok, false);
  assert.deepEqual(hideThread(db, 1, RUBY, threadKey({ otherId: WEISS, otherPersona: "", myPersona: "" })), { ok: true }, "empty conversation is a no-op");
});

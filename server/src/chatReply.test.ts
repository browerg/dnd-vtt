import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { resolveReply } from "./chatReply.js";

// Mirrors the shape resolveReply queries, without pulling in the real schema.
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE users (id INTEGER PRIMARY KEY, display_name TEXT NOT NULL);
    INSERT INTO users VALUES (1, 'Ruby'), (2, 'Weiss'), (3, 'Blake');
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      channel TEXT NOT NULL,
      target_user_id INTEGER REFERENCES users(id),
      speaker TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL
    );`);

  const add = (campaignId: number, userId: number, channel: string, body: string,
               targetUserId: number | null = null, speaker = "") =>
    Number(
      db.prepare(
        `INSERT INTO messages (campaign_id, user_id, channel, target_user_id, speaker, body)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(campaignId, userId, channel, targetUserId, speaker, body).lastInsertRowid
    );

  return { db, add };
}

test("a reply must stay in its own campaign and channel", () => {
  const { db, add } = fixture();
  try {
    const ic = add(1, 1, "ic", "I'm Ruby!", null, "Ruby Rose");
    const otherCampaign = add(2, 1, "ic", "Different table");

    // Same campaign and channel is fine, and carries the IC speaker name.
    const ok = resolveReply(db, { requested: ic, campaignId: 1, channel: "ic", userId: 2 });
    assert.equal(ok.ok, true);
    assert.equal(ok.ok && ok.replyToId, ic);
    assert.equal(ok.ok && ok.replyTo?.author, "Ruby Rose");

    // Quoting an IC line from the OOC tab is refused.
    const crossChannel = resolveReply(db, { requested: ic, campaignId: 1, channel: "ooc", userId: 2 });
    assert.equal(crossChannel.ok, false);
    assert.equal(!crossChannel.ok && crossChannel.status, 400);

    // So is reaching into another campaign.
    const crossCampaign = resolveReply(db, { requested: otherCampaign, campaignId: 1, channel: "ic", userId: 2 });
    assert.equal(crossCampaign.ok, false);

    // And a message that does not exist.
    assert.equal(resolveReply(db, { requested: 9999, campaignId: 1, channel: "ic", userId: 2 }).ok, false);
  } finally { db.close(); }
});

test("only the two people in a whisper may quote it", () => {
  const { db, add } = fixture();
  try {
    const whisper = add(1, 1, "whisper", "meet me at the docks", 2);

    // Sender and recipient may both reply.
    for (const userId of [1, 2]) {
      assert.equal(resolveReply(db, { requested: whisper, campaignId: 1, channel: "whisper", userId }).ok, true);
    }

    // A third player in the same campaign cannot, even on the whisper tab.
    const outsider = resolveReply(db, { requested: whisper, campaignId: 1, channel: "whisper", userId: 3 });
    assert.equal(outsider.ok, false);
    assert.equal(!outsider.ok && outsider.status, 403);
  } finally { db.close(); }
});

test("no reply target is not an error, and bad ids are rejected", () => {
  const { db } = fixture();
  try {
    for (const requested of [undefined, null, ""]) {
      const none = resolveReply(db, { requested, campaignId: 1, channel: "ooc", userId: 1 });
      assert.equal(none.ok, true);
      assert.equal(none.ok && none.replyToId, null);
      assert.equal(none.ok && none.replyTo, null);
    }
    for (const bad of [0, -3, 1.5, "abc", {}]) {
      assert.equal(resolveReply(db, { requested: bad, campaignId: 1, channel: "ooc", userId: 1 }).ok, false);
    }
  } finally { db.close(); }
});

test("long quotes are truncated so payloads stay small", () => {
  const { db, add } = fixture();
  try {
    const long = add(1, 1, "ooc", "x".repeat(500));
    const result = resolveReply(db, { requested: long, campaignId: 1, channel: "ooc", userId: 1 });
    assert.equal(result.ok, true);
    const body = result.ok ? result.replyTo!.body : "";
    assert.ok(body.length < 500, "preview should be shorter than the original");
    assert.ok(body.endsWith("…"), "truncated previews are marked with an ellipsis");

    // A short message is quoted verbatim, with no ellipsis.
    const short = add(1, 2, "ooc", "short one");
    const shortResult = resolveReply(db, { requested: short, campaignId: 1, channel: "ooc", userId: 1 });
    assert.equal(shortResult.ok && shortResult.replyTo?.body, "short one");
    // Falls back to the account name when there is no IC speaker.
    assert.equal(shortResult.ok && shortResult.replyTo?.author, "Weiss");
  } finally { db.close(); }
});

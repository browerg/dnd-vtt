import { test } from "node:test";
import assert from "node:assert/strict";
import { inviteCodeFrom } from "../../client/src/pendingInvite.js";

test("invite codes come out of links from any session, paths, or the bare code", () => {
  assert.equal(inviteCodeFrom("https://old-tunnel-words.trycloudflare.com/join/Ab3_x-9Q"), "Ab3_x-9Q", "a stale tunnel link still yields its code");
  assert.equal(inviteCodeFrom("http://localhost:5173/join/Ab3_x-9Q?ref=discord"), "Ab3_x-9Q");
  assert.equal(inviteCodeFrom("  /join/Ab3_x-9Q/  "), "Ab3_x-9Q");
  assert.equal(inviteCodeFrom("Ab3_x-9Q"), "Ab3_x-9Q");
  for (const bad of ["", "hello there", "https://example.com/campaigns/7", "/join/ab", "ab<script>"]) assert.equal(inviteCodeFrom(bad), null, bad);
});

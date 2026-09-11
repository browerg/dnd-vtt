import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PROFILE_STYLE_IDS, DEFAULT_PROFILE_STYLE, isProfileStyle } from "./profileStyles.js";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

/** Palette ids as the client actually declares them. */
function clientPaletteIds(): string[] {
  const source = read("../../client/src/components/ProfileIdentity.tsx");
  const block = source.slice(
    source.indexOf("export const PROFILE_PALETTES"),
    source.indexOf("export interface ProfileIdentityData")
  );
  return [...block.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);
}

test("the client's palettes and the server's allowlist stay in step", () => {
  // A palette the client offers but the server rejects fails on save with
  // "Choose a valid profile palette", which is easy to miss until someone
  // picks that exact colour.
  assert.deepEqual(
    clientPaletteIds(),
    [...PROFILE_STYLE_IDS],
    "PROFILE_PALETTES and PROFILE_STYLE_IDS have drifted apart"
  );
});

test("every palette has a stylesheet block, and the default is real", () => {
  const css = read("../../client/src/pages/ProfilePage.css");
  for (const id of PROFILE_STYLE_IDS) {
    // "astral" is the base .personal-profile rule rather than an attribute one.
    if (id === DEFAULT_PROFILE_STYLE) continue;
    assert.ok(
      css.includes(`[data-profile-style="${id}"]`),
      `${id} has no palette block in ProfilePage.css, so it would fall back to the default`
    );
  }
  assert.ok(isProfileStyle(DEFAULT_PROFILE_STYLE), "the default palette must itself be valid");
});

test("palette ids are unique and url-safe", () => {
  assert.equal(new Set(PROFILE_STYLE_IDS).size, PROFILE_STYLE_IDS.length, "duplicate palette id");
  for (const id of PROFILE_STYLE_IDS) {
    assert.match(id, /^[a-z][a-z0-9-]*$/, `${id} is not a safe palette id`);
  }
});

test("unknown palettes are rejected", () => {
  for (const bad of ["", "nope", "ASTRAL", null, undefined, 7, {}]) {
    assert.equal(isProfileStyle(bad), false, `${String(bad)} should not be accepted`);
  }
});

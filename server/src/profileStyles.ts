// The profile cover palettes the server will accept.
//
// These ids are duplicated in the client's PROFILE_PALETTES
// (client/src/components/ProfileIdentity.tsx) because the two workspaces share
// no package. Adding a palette there without adding it here makes saving fail
// with "Choose a valid profile palette", so profileStyles.test.ts compares the
// two lists and fails if they drift apart.
//
// Kept free of imports so tests can read it without pulling in db.ts, which
// opens the real database on import.
export const PROFILE_STYLE_IDS = [
  "astral",
  "ember",
  "verdant",
  "tide",
  "gilded",
  "crimson",
  "atlas",
  "obsidian",
  "sakura",
  "dust",
] as const;

export type ProfileStyleId = (typeof PROFILE_STYLE_IDS)[number];

export const DEFAULT_PROFILE_STYLE: ProfileStyleId = "astral";

export const isProfileStyle = (value: unknown): value is ProfileStyleId =>
  typeof value === "string" && (PROFILE_STYLE_IDS as readonly string[]).includes(value);

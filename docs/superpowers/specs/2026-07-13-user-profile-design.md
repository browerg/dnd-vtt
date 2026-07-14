# User Profile — design

**Date:** 2026-07-13
**Status:** Approved (pending spec review)

## Problem

A user account today holds only `email`, `display_name`, `password_hash`, and
`dice_theme`. Two gaps:

1. **Display name is permanent** — it can only be set at registration; there is
   no way to change it afterward.
2. **There is no personal avatar anywhere.** The only images tied to identity are
   per-*character* portraits (`characters.portrait_path`), which represent the
   character (Skylar), not the person (Melinda).

We want a dedicated place where a person edits *who they are on the account* —
name, avatar, pronouns, a short bio.

## Core principle: two identity layers

The app already separates two identities, and this feature must respect that
boundary:

- **Account / person** (e.g. "Melinda") — out-of-character, account-space.
- **Character** (e.g. "Skylar") — in-character, play-space.

Evidence already in the code:
- Chat distinguishes IC from OOC: an in-character message renders
  `Skylar (Melinda)` (character leads, person muted); OOC shows just `Melinda`.
- The roll feed labels rolls with the **person** (`Melinda · Malice attack`).
- Characters carry their own `portrait_path`, shown on tokens and sheets.

**The profile avatar is the account/person layer.** It appears only in
account/OOC-space surfaces and never invades in-character/immersive surfaces.
Putting a real face in the roll feed next to "Skylar attacks" is an immersion
break and is explicitly out of scope.

## Scope

In v1 a user can edit:
- **Display name** (now editable)
- **Avatar / PFP** (uploaded image)
- **Pronouns**
- **Short bio** (a one-line "about me" the table can see)

Out of scope (v1): password change, character portraits in the roll feed,
per-campaign profile overrides.

## Data model

One migration on `users` (append to the migrations array in
`server/src/db.ts`, following the existing `ALTER TABLE users ADD COLUMN ...`
pattern used for `dice_theme`):

```sql
ALTER TABLE users ADD COLUMN avatar_path TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN pronouns    TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN bio         TEXT NOT NULL DEFAULT '';
```

No new tables. `display_name` already exists.

## Server (`server/src/auth.ts`)

- Extend the `SessionUser` interface and the `GET /me` query to include
  `avatarPath`, `pronouns`, `bio` (alias columns the same way `dice_theme` is
  aliased to `diceTheme`).
- New endpoint **`PUT /api/auth/me/profile`** (behind `requireAuth`):
  - Body: `{ displayName, pronouns, bio, avatarPath }`.
  - Validation: `displayName` trimmed, non-empty, max ~40 chars; `pronouns`
    max ~30 chars; `bio` max ~280 chars; `avatarPath` must be empty or a
    `/uploads/...` path (do not accept arbitrary URLs).
  - Persists with a single `UPDATE users SET ... WHERE id = ?`.
  - Returns the updated `SessionUser` shape so the client can refresh state.
- **Avatar upload** reuses the existing generic endpoint
  `POST /api/uploads/image` (`server/src/uploads.ts`), which returns a
  `/uploads/<file>` URL. The client uploads first, then sends the returned URL
  as `avatarPath` in the profile PUT. (No orphan-file cleanup — consistent with
  the rest of this private tool.)
- **Member roster query** in `server/src/campaigns.ts` (the
  `GET /campaigns/:id` members select) gains `u.avatar_path` so the hub roster
  can render avatars.

## Client

### New `<Avatar>` component (`client/src/components/Avatar.tsx`)
Small reusable presenter: renders the image when `avatar_path` is set, else a
colored circle with the person's first initial (deterministic color from the
name/id so it is stable). Takes a size prop. Used by the topbar, profile page,
and member roster.

### New Profile page (`client/src/pages/ProfilePage.tsx`, route `/profile`)
- Avatar upload tile (click/drag, same UX as the backdrop uploader in
  `CustomizePage`, using the `uploadImage` helper in `api.ts`).
- Editable **display name**, **pronouns**, **short bio** (textarea with a live
  character counter against the 280 cap).
- Explicit **Save** button (name changes are meaningful; avoid autosave here).
  Shows a success notice and an error line, mirroring `CustomizePage`'s
  `notice`/`error` pattern.
- On save, updates `useAuth` user state (`setUser`) so the topbar reflects the
  new name/avatar immediately.

### Entry point
The current topbar shows `{user.display_name}` as plain text
(`DashboardPage.tsx` and others). Replace that with a clickable element —
`<Avatar>` + name — linking to `/profile`. Apply on the surfaces that already
show the name in the topbar.

### Auth context
`useAuth`'s `user` (from `GET /me`) already flows through the app; extend its
type to carry `avatarPath`, `pronouns`, `bio` so any consumer can read them.

## Avatar reach — account/OOC-space only

Show the avatar in:
- Topbar (you, logged in)
- `/profile` page
- Dashboard campaign cards / "your campaigns" home
- **Hub member roster** — the OOC "who's in this campaign + DM/PLAYER role" list
- **OOC + whisper** chat author labels

Do **not** show it in:
- Roll feed (stays person-name text; character portraits could go here later)
- IC chat speaker (character name already leads)
- Tokens / character sheets (character portraits already own that space)

## Testing / verification

- Migration applies cleanly on the existing dev DB (new columns default empty;
  existing users unaffected).
- `PUT /api/auth/me/profile` rejects empty/over-long display name; accepts and
  persists valid values; round-trips through `GET /me`.
- Avatar upload → returned `/uploads` URL saved → served and rendered.
- Topbar name/avatar updates immediately after Save (no reload).
- Verify in-browser via the running dev servers: edit profile as the DM account,
  confirm the hub roster and topbar update, and confirm the roll feed / IC chat
  are unchanged (immersion boundary held).

## Open questions

None blocking. (Password change and roll-feed character portraits are
deliberately deferred.)

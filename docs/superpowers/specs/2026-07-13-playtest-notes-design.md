# Playtest Notes Batch — design

**Date:** 2026-07-13
**Status:** Approved (pending spec review)

Three independent, small features from a playtester's notes. Each is separately
committable. A fourth note ("party-wide journal") needs **no work** — the Codex
"Journal" tab is already campaign-wide and shared (`server/src/codex.ts`: *"the
journal belongs to everyone"*); only the bullet enhancement (Feature A) touches it.

---

## Feature A — Bullet-list auto-continue in note text boxes

**Problem:** Typing a bulleted list in a `<textarea>` requires re-typing the
marker on every line. Playtester wants Google-Docs-style behavior.

**Behavior:**
- On **Enter** in a textarea, if the current line starts with a bullet marker
  (`-`, `*`, or `•`, optionally leading whitespace, followed by a space):
  - If there is content after the marker → insert a newline plus the same marker
    (and the same leading indentation) at the caret, and continue.
  - If the line is an *empty* item (just the marker/whitespace) → remove the
    marker and do **not** continue (this is the "Enter twice to exit" behavior).
- **Shift+Enter** is left untouched (normal newline).
- Non-bullet lines behave exactly as before.

**Design:**
- New module `client/src/bulletList.ts` exporting a pure helper plus a keydown
  handler:
  - `nextBulletState(value: string, caret: number): { value: string; caret: number } | null`
    — returns the new textarea value + caret position for an Enter press, or
    `null` if the current line isn't a bullet (let the default happen).
  - `handleBulletKeyDown(e, commit)` — on Enter (not Shift), calls
    `nextBulletState`; if non-null, `e.preventDefault()` and
    `commit(next.value, next.caret)`.
  - `commit(value, caret)` is supplied by the component: it sets the controlled
    state to `value`, then restores the caret with a
    `requestAnimationFrame`/ref (React reasserts `value` on re-render, so the
    caret must be set after paint).
- **Wire into two surfaces only:**
  - `client/src/components/NotesPanel.tsx` — the "My notes" textarea (private).
  - `client/src/components/CodexPanel.tsx` — the shared Journal entry **body**
    textarea (the new-entry composer).
- The marker set is `-`, `*`, `•`. Numbered lists are out of scope.

**Verification:** Type `- a` Enter `b` Enter Enter in each box; expect the
second line to auto-prefix `- `, and the final empty bullet to clear and exit.

---

## Feature B — Player-picked "style die" added to weapon damage

**Problem:** The weapon **Damage** button currently rolls only the weapon die
(`1d{form.damage}`). The group's house rule adds a second, player-chosen die to
damage.

**Current code** (`client/src/components/RemnantSheet.tsx`, per weapon form):
- Attack: `roll(remnantCheckFormula(die, tb), "... attack")` where `die` is the
  brawn die for Brawlers else finesse.
- Damage: `roll(\`1d${form.damage}\`, "... damage")`.

**Design:**
- Extend `WeaponForm` in `client/src/remnant.ts` (currently `type`, `range`,
  `damage`, `special`) with `styleDie?: number` — `undefined`/`0` = none, else a
  die size (4/6/8/10/12). Optional, so no migration and existing characters
  default to none.
- In each weapon form's editor (`RemnantSheet.tsx`), add a small `<select>`
  labeled **style die** next to the existing damage-die select, options:
  `None / d4 / d6 / d8 / d10 / d12`, bound to `form.styleDie` via the same
  `update({ weaponForms: ... })` pattern used for `damage`.
- **Damage roll** becomes:
  `1d{form.damage}` plus `+1d{form.styleDie}` when a style die is set. Button
  label reflects it: `Damage (d8)` or `Damage (d8 + d6)`.
- Read-only sheets (spectators / non-owners) show the select disabled, matching
  the existing `ro` handling on the other form fields.

**Verification:** Set a form's style die to d6 with damage d8 → the button reads
`Damage (d8 + d6)` and posts `1d8+1d6` through the roll pipeline; setting it to
None reverts to `1d8`.

---

## Feature C — DM announcement broadcast (toast to everyone)

**Problem:** The only DM-to-party signal today is a static `📣` banner on the
hub. The DM wants to push a live notification (a monster appears, someone is
downed, a quest drops) that everyone sees immediately.

**Design (manual broadcast; auto-triggers deferred):**

**Server** — `POST /api/campaigns/:id/announce` (new route; DM/co-DM only,
spectators excluded — mirror the role checks in `campaigns.ts`):
- Body: `{ message: string, kind: "info" | "combat" | "quest" | "alert" }`.
- Validate: `message` trimmed, non-empty, ≤ 200 chars; `kind` in the allowed
  set (default `"info"`).
- Broadcast (no DB — transient):
  `getIo().to(\`campaign:${id}\`).emit("announcement:push", { campaignId, message, kind, at: Date.now(), from: displayName })`.
  This reuses the exact pattern in `codex.ts`'s `touch()`.

**Client:**
- New `client/src/components/AnnouncementCenter.tsx`, self-contained like
  `CampaignDocks` (reads `campaignId` from params, fetches the viewer's role):
  - Opens its own campaign socket room join (self-contained, exactly as
    `CampaignDocks` does) and listens for `announcement:push`;
    on receipt, shows a **toast** and auto-dismisses after ~6s (manual close
    button too). Toast is styled by `kind`: combat = red, alert = amber, quest =
    gold, info = default (neutral/gold). Reuses the roll-toast CSS
    (`.roll-toast`) with a new `.announce-toast` + per-kind modifier classes.
  - If the viewer is **DM/co-DM**, also renders a **📣 Announce** trigger that
    opens a small popover: a text input, a `kind` selector, and **Send** →
    `POST /api/campaigns/:id/announce`.
- Mount `<AnnouncementCenter campaignId={id} />` on the three campaign screens:
  `CampaignDashboardPage`, `MapPage`, `CampaignPage` (hub). It is self-contained
  and opens its own room join like `CampaignDocks` — one extra lightweight
  connection, already precedented in the codebase.
- **De-dupe:** mount `AnnouncementCenter` once per page. The toast listener
  ignores the app's own initial hydration (there is no history fetch — announcements
  are transient, so only live `announcement:push` events ever arrive; no unread
  backfill problem like RollDock had).

**Verification:** As DM on the dashboard, send a "Combat" announcement "A Beowolf
lunges!" → a red toast appears for the DM and (in a second browser as a player)
for the player; it auto-dismisses. Non-DM has no Announce trigger. Empty message
→ 400.

---

## Out of scope
- Auto-triggered notifications (monster spawned / token at 0 HP / quest
  revealed). The manual broadcast covers these by hand; auto-hooks are a future
  follow-up.
- Announcement history/persistence (transient toasts only).
- Numbered-list continuation, and bullets in other text boxes (backstory, bio).

## Open questions
None blocking.

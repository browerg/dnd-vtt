# Schnee Atelier dashboard theme

A "full makeover" Remnant theme (`fullMakeover: true` in `client/src/theme.ts`).
Approved comp: `.impeccable/mocks/schnee/atelier-dashboard.png` (1586×992). The
build is matched against it at that exact size; see the Example page.

## Where things live

- `client/src/atelier/AtelierTopbar.tsx` — crest + wordmark, Dashboard/Map/Characters
  pills, Edit panels, the ⚙ menu (Grimm archive, Handbook, Schedule, Previously on…,
  Theme, the Example, All campaigns), avatar; and the title plaque.
- `client/src/atelier/AtelierPanels.tsx` — presentational panels: panel header (tab,
  sparkle, ⋮ menu), character card (portrait, Aura dial, attribute shields, weapon),
  mission brief, team status, session log, simple dice roller.
- `client/src/atelier/AtelierLive.tsx` — loads the player's character and notes.
- `client/src/atelier/atelierModel.ts` — maps real data to the panels; the notes
  parser; `ATELIER_GRID` (34px rows + 8px gutters = the classic 42px per row, so
  saved layouts keep their size) and `ATELIER_ARRANGEMENT` (the comp's layout).
- `client/src/atelier/atelierExample.ts` + `pages/AtelierExamplePage.tsx` — the
  `/themes/schnee-atelier/example` page with the comp's sample data.
- `client/src/schneeAtelier.css` — all styles, scoped to the theme.
- `client/public/assets/themes/schnee-atelier/` — palace backdrop, frame nine-slice,
  compass / circle / sparkle ornaments, crest; `example/` art is cut from the comp
  (`example/PROVENANCE.json`).

## Rules

- Never change a player's saved layout on theme switch. "✦ Atelier layout" (in Edit
  panels) is the only thing that rearranges, and only when clicked.
- Mission notes are the player's private notes, read as: first line = title,
  `📍 Place` / `Region: Place` = location tag, `•`/`-`/`1.` lines = steps (a plain
  line under a step is its detail), anything before the first step = description.
- Remnant sheets show all six attributes as dice; no rules are invented or changed.
- Each ⋮ menu can flip a panel back to its classic view (full sheet, full dice form,
  notes editor). The choice is per campaign, per device.

## Verification

`scripts/check-atelier.mjs` (Example capture, live dashboard, arrangement, R to roll,
notes round trip, ⚙ menu, phone width) and `scripts/check-schnee-theme.mjs` (theme
switching, campaign default, drag/resize/add/remove, reload, incumbent restore,
mobile picker). Both run against a synthetic API with Vite on 5182 and
`PLAYWRIGHT_MODULE` pointing at a playwright install.

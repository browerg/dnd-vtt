# D&D Virtual Tabletop (working name: dnd-vtt)

A web-based virtual tabletop for running D&D campaigns with friends — campaign hub,
character sheets, live dice, interactive battle maps, and DM tools.

## The one guiding principle

> **Speed and ease of use beat feature count.**
> Existing VTTs (Roll20, Foundry, Fantasy Grounds) are powerful but overwhelming.
> The five common tasks — rolling dice, moving tokens, revealing a room, tracking
> combat, and managing character sheets — must feel *instant and intuitive*.
> Every feature decision gets measured against this.

## Documents

| Doc | What it is |
|---|---|
| [docs/FEATURES.md](docs/FEATURES.md) | The full feature inventory from the brainstorm, organized and tagged by phase |
| [docs/ROADMAP.md](docs/ROADMAP.md) | The 5-phase build plan, with Phase 1 broken into buildable milestones |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Open decisions, risks, and things in the brainstorm that need a reality check |

## Status

- **Phase:** 1, Milestone 1.3 — character sheets **built and verified** (2026-07-09):
  full 5e sheet (abilities, skills, saves, HP/AC/initiative, conditions, inventory,
  spell slots + concentration, notes) with click-to-roll wired into the dice pipeline,
  debounced autosave, live HP sync to the whole party, owner-or-DM edit permissions.
  Milestones 1.1 (auth/campaigns/invites/presence) and 1.2 (server-authoritative dice,
  3D dice, roll feed, secret rolls) verified earlier the same day.
- **Stack:** TypeScript everywhere. React + Vite client, Express + Socket.IO server,
  SQLite via Node's built-in `node:sqlite` (swap for Postgres later if needed).
- **Run it:** `npm run dev:server` and `npm run dev:client` from the repo root, then
  open http://localhost:5173.
- **Next step:** Milestone 1.4 — campaign hub polish (announcements, house rules,
  session number) and tabbed chat (IC / OOC / whispers). Then the Phase 1 game night
  test. Deferred: SRD spell/monster data import, portrait uploads (needs file
  storage), Google/Discord OAuth buttons (needs API keys).

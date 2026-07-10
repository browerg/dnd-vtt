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

- **Phase:** 1 **complete** (2026-07-09) — all four milestones built and verified:
  1.1 auth/campaigns/invites/live presence · 1.2 server-authoritative dice with 3D
  physics dice, roll feed, secret rolls · 1.3 full 5e character sheets with
  click-to-roll, autosave, live HP sync · 1.4 campaign hub (announcement, chapter,
  session number, house rules) + tabbed chat (In Character speaks as your character,
  Out of Character, private whispers), all live over Socket.IO.
- **Stack:** TypeScript everywhere. React + Vite client, Express + Socket.IO server,
  SQLite via Node's built-in `node:sqlite` (swap for Postgres later if needed).
- **Run it:** `npm run dev:server` and `npm run dev:client` from the repo root, then
  open http://localhost:5173.
- **Phase 2 complete + Phase 3 started** (2026-07-10). Battle map: uploads
  (image/video/YouTube link, 500MB limit), grid, tokens with live HP, snap-drag,
  pan/zoom, pings, fog of war, initiative tracker, map switch/delete UI. Monsters:
  322 SRD stat blocks searchable and spawnable, DM stat block panel with attack
  rolls and HP tracking. Codex on the campaign hub: quests (hideable), NPCs (with
  DM-only secrets), shared journal, handouts with controlled reveal. One-click
  campaign JSON export. Dice favorites (macro chips).
- **Next step:** 🎲 **game night test #1** — which needs **hosting** (friends can't
  reach localhost). Then fix what hurt. Deferred: SRD spells, character creator,
  portrait uploads, OAuth buttons, world map, wiki.

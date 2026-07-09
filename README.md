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

- **Phase:** 1, Milestone 1.2 — dice system **built and verified** (2026-07-09):
  server-authoritative roll formulas (`2d6+4`), advantage/disadvantage, live public
  roll feed, private/DM/blind visibility, roll history, nat-20/nat-1 highlights, and
  3D physics dice (dice-box-threejs) that land on the server's results, with sound.
  Milestone 1.1 (auth, campaigns, roles, invites, live presence) verified earlier
  the same day.
- **Stack:** TypeScript everywhere. React + Vite client, Express + Socket.IO server,
  SQLite via Node's built-in `node:sqlite` (swap for Postgres later if needed).
- **Run it:** `npm run dev:server` and `npm run dev:client` from the repo root, then
  open http://localhost:5173.
- **Next step:** Milestone 1.3 — character sheets with click-to-roll. Google/Discord
  OAuth buttons still pending (needs API keys).

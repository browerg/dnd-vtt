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

- **Phase:** 1, Milestone 1.1 — walking skeleton **built and verified** (2026-07-09):
  email/password auth, campaigns, roles, invite links, and live presence over
  Socket.IO all working end to end.
- **Stack:** TypeScript everywhere. React + Vite client, Express + Socket.IO server,
  SQLite via Node's built-in `node:sqlite` (swap for Postgres later if needed).
- **Run it:** `npm run dev:server` and `npm run dev:client` from the repo root, then
  open http://localhost:5173.
- **Next step:** Google/Discord OAuth buttons (needs API keys), then Milestone 1.2 —
  the dice system.

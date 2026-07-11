# D&D Virtual Tabletop (working name: dnd-vtt)

A web-based virtual tabletop for running campaigns with friends — campaign hub,
character sheets, live dice, interactive battle maps, and DM tools. Speaks two
systems: **Remnant** (the group's RWBY TTRPG — the default) and D&D 5e.

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
| [docs/HOSTING.md](docs/HOSTING.md) | How to put the table online for game night (tunnel / Tailscale / VPS) |

## Status

- **Phase:** 1 **complete** (2026-07-09) — all four milestones built and verified:
  1.1 auth/campaigns/invites/live presence · 1.2 server-authoritative dice with 3D
  physics dice, roll feed, secret rolls · 1.3 full 5e character sheets with
  click-to-roll, autosave, live HP sync · 1.4 campaign hub (announcement, chapter,
  session number, house rules) + tabbed chat (In Character speaks as your character,
  Out of Character, private whispers), all live over Socket.IO.
- **Stack:** TypeScript everywhere. React + Vite client, Express + Socket.IO server,
  SQLite via Node's built-in `node:sqlite` (swap for Postgres later if needed).
- **Run it (dev):** `npm run dev:server` and `npm run dev:client` from the repo root,
  then open http://localhost:5173.
- **Run it (production):** `npm run build && npm start` — one process serves the
  client, API, sockets, and uploads on http://localhost:3001. See
  [docs/HOSTING.md](docs/HOSTING.md) to put it online.
- **Phase 2 complete + Phase 3 started** (2026-07-10). Battle map: uploads
  (image/video/YouTube link, 500MB limit), grid, tokens with live HP, snap-drag,
  pan/zoom, pings, fog of war, initiative tracker, map switch/delete UI. Monsters:
  322 SRD stat blocks searchable and spawnable, DM stat block panel with attack
  rolls and HP tracking. Codex on the campaign hub: quests (hideable), NPCs (with
  DM-only secrets), shared journal, handouts with controlled reveal. One-click
  campaign JSON export. Dice favorites (macro chips).
- **Milestone 3.2** (2026-07-10): homebrew bestiary — per-campaign Bestiary page
  with a full custom monster editor (traits, actions with rollable attacks),
  clone-from-SRD, campaign-scoped visibility. Plus the SRD spellbook: 319 spells
  searchable from the character sheet with one-click add and full descriptions.
- **Milestone 4 — Remnant mode** (2026-07-11): the group's actual system is now the
  default. Per-campaign `system` setting (new campaigns are Remnant; D&D 5e under an
  Advanced option). Edge/Setback roll modes (reroll the attribute die, keep
  higher/lower). Full Remnant character sheet with auto-computed Aura pool, HP,
  Defense Rating, and Semblance costs — verified against a real player PDF. All 15
  handbook Grimm auto-seed into every Remnant campaign as editable custom monsters;
  Grimm stat blocks (Threat/Ferocity/Armor/HP + traits) render in the bestiary and
  the map's DM panel with one-click attack (2d10+1d{ferocity}) and damage rolls,
  plus a Grimm editor. Character map tokens show a gold Aura bar above the HP bar.
  Initiative rolls 2d10 + Finesse (characters) or + Ferocity (Grimm). A collapsible
  quick-reference card (DCs, action economy, conditions, Final Flare, Semblance
  costs, Dust combos) lives on every Remnant campaign hub.
- **Polish + hosting sprint** (2026-07-11): full visual overhaul ("academy after
  dark" — Cinzel/Alegreya Sans, gold-on-night palette, atmosphere and motion),
  battle-map toolbar overflow fixed, production build served by the one server
  process, docs/HOSTING.md written. Plus a live measuring tape on the battle map
  (📏 Ruler, drag to measure, broadcast to the whole table) that reports Remnant
  range bands (Close/Mid/Long/Extreme) or feet on 5e campaigns.
- **Next step:** 🎲 **game night test #1** — pick a path from
  [docs/HOSTING.md](docs/HOSTING.md) and send invite links. Then fix what hurt.
  Deferred: character creator, portrait uploads, OAuth buttons, world map, wiki,
  drawing tools.

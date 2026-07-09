# Roadmap

Five phases, same shape as the brainstorm's suggested roadmap, with two changes:

1. **Phase 1 is broken into small milestones** so there's always something playable.
2. **Each phase ends with a "game night test":** your group actually uses it for a
   real session. If a phase's output can't survive a real session, the next phase
   waits.

---

## Phase 1 — Core Foundation

**Goal:** your group can run a *theater-of-the-mind* session on the site tonight —
no map yet, but sheets, dice, and chat all live-synced.

### Milestone 1.1 — Walking skeleton
- Project scaffolding, database, deployment pipeline (deploy from day 1, even if ugly)
- Email/password auth; Google + Discord OAuth
- Create a campaign, generate an invite link, join with a role (DM / Co-DM / Player / Spectator)
- Real-time sync layer in place (this is the architectural heart — dice, chat, and
  later the map all ride on it)

### Milestone 1.2 — Dice, live
- Roll formulas (`2d6+4`, advantage/disadvantage, modifiers)
- Public roll feed all players see instantly
- Secret / blind / DM rolls
- Roll history (searchable comes later; stored from day 1)
- 3D animated dice with sound — the signature moment; budget real time for it

### Milestone 1.3 — Character sheets
- Full 5e sheet: abilities, derived stats, skills, saves, proficiencies
- **Click-to-roll everywhere** — this is where sheets and dice fuse
- Inventory (items, gold, equipped), conditions
- Spellbook with slots and concentration (SRD spell data — see DECISIONS.md)
- Notes, backstory, images

### Milestone 1.4 — Hub & chat
- Campaign hub page: description, session number, announcements, house rules, player/character lists
- Tabbed chat (IC / OOC / whispers / dice results)
- Profiles: avatar, bio, dice theme, online status

**Game night test #1:** run a real theater-of-the-mind session. Fix what hurt.

---

## Phase 2 — Virtual Tabletop

**Goal:** full combat on a shared map.

- Battle map: upload image, square/hex/no grid, zoom/pan
- Tokens: create from character/monster, drag with snap, health bars, name labels
- Layers: ground / objects / creatures / DM-only
- Fog of war: manual reveal (dynamic vision is P5)
- Initiative tracker: auto-sort, turns, rounds, conditions, held actions, reactions,
  legendary/lair actions, concentration
- Combat screen: map + initiative + combat log + HP + turn timer
- DM control panel v1: spawn/delete/move anything, reveal/hide, lock movement, pause
- Measurement tool, DM drawing (walls, shapes), **player ping** (pulled forward from
  "wow" list — cheap and high-impact)

**Game night test #2:** run a real combat-heavy session.

---

## Phase 3 — Campaign Management

**Goal:** the campaign's whole world lives on the site between sessions.

- World map with pins, travel paths, hidden locations
- Monster database (SRD import + custom monsters, templates, cloning)
- NPC manager
- Quest tracker (main/side, objectives, rewards, hidden)
- Journal with timeline and search
- Handouts with controlled reveal
- Wiki
- Simple campaign export/backup (pulled forward from Admin Tools — protect the data early)

---

## Phase 4 — Advanced Systems

**Goal:** automation and atmosphere.

- Combat automation: auto HP, spell slots, condition durations, death saves, recharges
- Character creator (guided)
- Shops, loot tables and distribution, party storage
- Crafting (recipes, materials, timers)
- In-world calendar: moon phases, holidays, weather, seasons
- Relationships/reputation tracking
- Music (self-hosted/ambient first — see DECISIONS.md on Spotify) + soundboard
- Random generators
- Homebrew editor
- Session prep checklist
- Voice — decision pending (see DECISIONS.md; likely "use Discord" at first)

---

## Phase 5 — Premium Experience

**Goal:** the "wait, you built this?" layer.

- Dynamic lighting and player vision (darkvision, torches, magical darkness)
- Live line-of-sight from walls
- Draggable spell templates with auto-measurement
- Animated map effects (fire, weather, magic circles), music zones
- Interactive doors/traps/levers, cinematic mode
- Replay mode, session recording with searchable combat timeline
- Achievements and analytics
- Mobile companion mode
- Plugin/API system
- AI-assisted DM tools (optional)

---

## Sequencing notes

- **The real-time sync layer (1.1) is the most important technical decision in the
  project.** Dice feed, chat, token movement, initiative, and fog of war are all the
  same problem: shared state, updated live. Get it right once.
- **Every milestone ships something usable.** No milestone should end with "the
  backend is done but there's nothing to click."
- Visual polish (themes, dice skins, night mode) is ongoing, not a phase — but night
  mode should exist in Phase 1 because D&D happens at night.

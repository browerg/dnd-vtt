# Open Decisions & Reality Checks

Things that need a call before or during Phase 1, plus items from the brainstorm that
have hidden gotchas. Decisions get recorded here as they're made.

---

## Needs a decision before building

### 1. Project name
`dnd-vtt` is a placeholder. Note: avoid "D&D" in the public-facing name — it's a
Wizards of the Coast trademark. "VTT for my group" projects usually pick a fantasy-ish
neutral name.

### 2. Tech stack
Not chosen yet. Requirements that constrain the choice:
- **Real-time multiplayer state** (WebSockets) is core, not an add-on
- **Canvas/WebGL rendering** for the battle map and 3D dice
- Should be something you can maintain solo

A sensible default to react to: TypeScript everywhere, React front end, Node backend
with WebSockets, Postgres, and a canvas library (PixiJS) for the map + a physics dice
library for 3D dice. But this is open until you weigh in.

### 3. D&D content licensing ⚠️ *important*
The spellbook, monster database, and character creator imply shipping D&D content.
- **Safe:** SRD 5.1 / 5.2 content (released under Creative Commons) — most core
  spells, monsters, classes at base level. Free to use, even commercially.
- **Not safe:** non-SRD content (most subclasses, monsters like beholders and
  mind flayers, setting material) — can't be shipped built-in.
- **Escape hatch:** the homebrew editor doubles as "enter your own content" — users
  adding their own data is their business.
- **Decision needed:** private tool for your group only (relaxed) vs. anything
  public/shared (SRD-only built-ins).

### 4. Hosting & cost model
Real-time server + image uploads (maps, portraits, handouts) means an actual server
and storage, not just static hosting. Fine for one group; worth deciding early where
it runs and roughly what it may cost.

---

## Reality checks on specific brainstorm items

### Spotify integration — mostly not possible as imagined
Spotify's API cannot stream synced audio to multiple listeners; each user would need
Premium and their own playback session, and the terms don't allow this use. Realistic
options: (a) self-hosted/royalty-free ambient audio synced by the app — fully doable,
(b) "everyone press play" YouTube link sharing, (c) Spotify *link* sharing without sync.
Recommendation: build (a); it also covers battle/town/boss music and the soundboard.

### Voice chat — huge lift, probably unnecessary
WebRTC group voice is a project on its own (TURN servers, echo, reconnects). Your
group almost certainly already uses Discord. Recommendation: Phase 1–4, "runs alongside
Discord"; revisit built-in voice only if the site earns it. The profile "voice
indicator" can hook into Discord presence later.

### Scope overall
The brainstorm is roughly 3–5 person-years of features. That's fine — the roadmap
exists so it never feels that way. The rule that protects the project: **each phase
must survive a real game night before the next phase starts.** The moment building
outpaces playing, motivation dies.

### 3D dice physics — worth it, but timebox it
It's the signature feature and demo-magnet, but physics + juice can eat weeks.
Plan: use an existing 3D dice library first (several good open-source ones exist),
customize skins/sounds; hand-roll physics only if the libraries disappoint.

---

## Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-07-09 | Roadmap phases adopted from brainstorm, with milestone breakdown for Phase 1 | Always have something playable |
| 2026-07-09 | Player ping moved from "wow features" to Phase 2 | Cheap to build, big table impact |
| 2026-07-09 | Campaign export/backup moved to Phase 3 | Protect campaign data early |
| 2026-07-09 | Audience: private tool for the friend group | Relaxed licensing posture; optimize for one table |
| 2026-07-09 | Stack: TypeScript, React + Vite, Express + Socket.IO, SQLite (`node:sqlite`) | Best ecosystem for real-time canvas apps; zero-setup DB, Postgres later if needed |
| 2026-07-09 | Email/password auth hand-rolled (scrypt + DB sessions); OAuth deferred | Google/Discord need API keys the user must create |
| | *(name, hosting — pending)* | |

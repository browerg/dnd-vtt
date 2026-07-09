# Feature Inventory

Everything from the original brainstorm, organized into systems and tagged with the
phase it lands in (see [ROADMAP.md](ROADMAP.md)). Nothing has been cut — things that
need a second look are flagged ⚠️ and discussed in [DECISIONS.md](DECISIONS.md).

Legend: **P1–P5** = phase · ⚠️ = has an open decision or risk

---

## Accounts & Social (P1)

- **Auth:** email/password, Google login, Discord login
- **Invite-only campaigns** (invite link or code)
- **Roles:** DM, Co-DM, Player, Spectator
- **Profiles:** avatar, character portrait, banner, bio, dice color/theme, online status, voice indicator

## Campaign Hub (P1)

The "server homepage" for each campaign:

- Campaign description, current chapter, session number
- Calendar, player list, character list
- Recent events feed, DM announcements, house rules

## Character Sheets (P1) — *biggest Phase 1 feature*

- **Ability scores:** STR / DEX / CON / INT / WIS / CHA
- **Derived stats:** HP, temp HP, AC, initiative, passive perception/investigation, speed, hit dice
- **Skills & saving throws:** all of them, *clickable to roll*
- **Proficiencies:** armor, weapons, languages, tools
- **Inventory:** items, weight, quantity, gold, magic items, consumables, equipped slots, drag/drop
- **Spellbook:** prepared spells, spell slots, concentration, descriptions, search, favorites ⚠️ (spell content licensing)
- **Notes:** character notes, secrets, backstory, NPC relationships
- **Images:** portrait, mini icon, map token
- **Conditions:** poisoned, invisible, restrained, prone, exhaustion, dead, etc.

## Dice System (P1) — *the signature feature*

- **3D physical dice:** physics, bounce, sound
- **Dice:** d4, d6, d8, d10, d12, d20, d100, coin flip
- **Roll types:** normal, advantage, disadvantage, custom modifiers
- **Formulas:** `2d6+4`, `8d8`, `4d10+3`, …
- **Public feed:** everyone sees "Garrett rolled 🎲 18 + 4 = 22", animated
- **Secret rolls:** DM-only, player-only, blind
- **Roll history:** every roll ever, searchable
- **Favorites & macros:** saved attack/damage/healing/initiative rolls, named macros ("Fireball" → 8d6)

## Chat (P1)

Tabbed: In Character · Out of Character · DM · Private whispers · System · Dice · Combat

## Initiative Tracker (P2)

- DM starts combat, auto-sorts everyone
- Tracks: current turn, round, conditions, legendary actions, lair actions, held actions, reaction used, concentration

## Combat Screen (P2)

Dedicated page showing initiative, battle map, combat log, HP, statuses, concentration, turn timer.

## Interactive Battle Map (P2) — *biggest feature overall*

- **Grids:** square, hex, none
- **Tokens:** players, NPCs, enemies, pets, summons — circle/square/portrait/animated, health bar, name label
- **Movement:** drag, grid snap, free movement
- **Layers:** ground, objects, creatures, lighting, weather, effects, DM-only
- **Fog of war:** manual reveal (P2); dynamic reveal + player vision (darkvision, torch radius, magical darkness) (P5)
- **Drawing:** DM walls, lines, shapes; ping; measurement tool
- **Terrain:** water, lava, forest, mountain, road, dungeon
- **Doors:** locked, unlocked, hidden, secret, breakable
- **Objects:** chests, traps, altars, levers, campfires, furniture
- **Animated effects (P5):** fire, smoke, rain, snow, magic circles, blood
- **Music zones (P5):** walk into the tavern → music changes

## DM Control Panel (P2)

- Spawn/delete monsters, move anything, reveal/hide map
- Lock player movement, force initiative, pause game
- Weather, music, day/night toggles
- Hidden notes, private rolls, NPC/monster sheets
- Encounter builder, loot tables, random encounters

## World Map (P3)

Zoomable, with pins: cities, dungeons, villages, ports, quest markers, player markers,
travel paths, hidden locations revealed as explored.

## Monster Database (P3) ⚠️ (licensing)

Searchable stat blocks: HP, AC, abilities, spells, images, CR. Custom monsters,
templates, cloning.

## NPC Manager (P3)

Portrait, voice/accent notes, personality, secrets, inventory, relationships,
alive/dead, location.

## Quest System (P3)

Main/side quests, completed/failed/hidden states, objectives, rewards, party votes.

## Journal (P3)

Auto-stored sessions, DM notes, player notes, search, timeline.

## Handouts (P3)

DM uploads maps, letters, books, images, puzzles — revealed only when desired.

## Wiki (P3)

Places, gods, history, magic, items, monsters — searchable.

## Character Creator (P4)

Guided creation: race, class, background, portrait, equipment, stats. ⚠️ (licensing —
class/race content beyond the SRD)

## Inventory / Spell Automation (P4)

Auto: subtract HP, track spell slots, recharge abilities, duration countdowns, buff
timers, condition effects, death saves.

## Shops (P4)

Merchants with inventory, buy/sell, prices, limited stock, restock.

## Crafting (P4)

Recipes, materials, craft timers; alchemy, enchanting, cooking.

## Calendar & Weather (P4)

Moon phases, holidays, weather, time of day, seasons.

## Relationships & Reputation (P4)

NPC affection, faction reputation, kingdom reputation, party trust.

## Music (P4) ⚠️ (Spotify)

- Playlists: battle, town, boss music; ambient rain/ocean/thunder
- Spotify integration ⚠️, YouTube ⚠️ — see DECISIONS.md

## Soundboard (P4)

Door, explosion, wolf howl, dragon roar, crowd, magic.

## Loot System (P4)

Loot tables, roll treasure, chest inventory, distribute loot, party storage.

## Voice (P4, optional) ⚠️

Voice channels, push-to-talk, volume controls. See DECISIONS.md — Discord may be the
better answer.

## Random Generators (P4)

Names, cities, taverns, NPCs, loot, encounters, weather, rumors.

## Homebrew Editor (P4)

Custom classes, spells, weapons, items, monsters, conditions, rules — everything editable.

## Session Prep (P4)

DM checklist: encounter list, maps, music, NPCs, read-aloud text, hidden notes.

## Achievements & Analytics (P5)

- Achievements: Natural 20, First Death, Dragon Slayer, Treasure Hunter, …
- Stats: longest session, highest/lowest roll, most damage, healing done, distance traveled, gold earned, monsters killed

## Admin Tools (P5, basics earlier)

Permissions, backups, campaign export/import, audit log. (Backups and export deserve
to exist much earlier in simple form.)

## Visual Polish (ongoing, showcase in P5)

Animated backgrounds, dice skins, token borders, night mode, themes, custom fonts,
particle effects.

## "Wow" Features (P5)

- Live line-of-sight from walls and light sources
- Draggable spell templates (cones, circles, cubes) with auto-measured squares
- Interactive doors/traps/levers that animate when triggered
- Cinematic mode (DM zooms all players to a scene)
- Replay mode — scrub back through combat
- AI-powered NPC dialogue / tavern descriptions / encounter ideas (optional)
- Player ping system with animated indicators (worth pulling into P2 — it's easy and great)
- Session recording with auto combat logs and searchable timelines
- Mobile companion mode (rolls, inventory, sheet on phone; map on desktop)
- Plugin/API support for custom widgets, homebrew mechanics, automation

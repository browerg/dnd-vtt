# RWBY VTT Playtest Backlog

This document tracks confirmed rules, bugs, usability problems, feature requests, and future milestones discovered through playtesting.

## Status key

- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed
- `[?]` Needs clarification or design decision

---

# Confirmed Rules and Decisions

## Weapon attributes

- [ ] Add a Main Attribute selector to the character sheet.
- The selected Main Attribute applies to **weapon damage only**.
- It must not affect weapon attack rolls.
- It must not affect skill rolls.
- The attribute bonus is added on top of the weapon's existing damage formula.

Example:

```text
Weapon damage: 2d8+6
Main Attribute bonus: +3
Final damage: 2d8+9
```

## Rank bonuses

- Rank bonuses such as `+2` apply to appropriate skills.
- Rank bonuses must not automatically be added to weapon rolls.

## Dust allocation

- Every character begins with 3 Dust vials.
- A Dust Mage receives 2 additional Dust vials.
- Ranking up grants 2 additional Dust vials.
- Each Dust vial contains 3 charges.

---

# Milestone 1: Playtest Stability and Map Usability

## Active map-tool indicator

- [ ] Clearly identify the currently selected map tool.
- Supported tool states should include:
  - Grab / Move
  - Ruler
  - Draw
  - Erase
  - Reveal
  - Hide
- The selected toolbar button needs a strong active appearance.
- Add an optional persistent label such as:

```text
ACTIVE TOOL: RULER
```

- Change the map cursor where appropriate for the selected tool.
- Make it difficult for a player to accidentally draw or move the map because they forgot which tool was active.

## Panel movement and resizing

- [ ] Stop text and interface elements from highlighting while panels are being moved or resized.
- [ ] Add resize handles to all sides and corners.
- [ ] Fix inconsistent panel movement and resizing.
- [ ] Prevent unwanted snapping to other panels.
- [ ] Allow panels to be positioned freely against the background.
- [ ] Make panel deletion easier and more reliable.
- [ ] Review whether optional snapping should exist as a toggle rather than always being active.

## Chat panel

- [ ] Keep the chat input anchored to the bottom of the panel.
- [ ] Keep the message history independently scrollable.
- [ ] Prevent the input box from moving out of view when the panel is resized.

## Browser compatibility

- [ ] Investigate Firefox-specific layout and interaction problems.
- [ ] Check pointer capture during token dragging.
- [ ] Check custom range sliders.
- [ ] Check fixed and floating panels inside transformed containers.
- [ ] Check hover-only controls.
- [ ] Check use of `:has()` and other browser-sensitive CSS.

---

# Milestone 2: Character Sheet Overhaul

## Collapsible sections

- [ ] Make every major character-sheet section collapsible.
- [ ] Save each user's collapsed-section preferences.

Sections should include:

- Basic information
- Attributes
- Skills
- Weapons
- Aura
- Semblance
- Dust
- Inventory
- Conditions
- Notes
- Biography and backstory

## Main attribute

- [ ] Add a Main Attribute selector.
- [ ] Automatically include the selected attribute in weapon damage.
- [ ] Display the applied attribute beside the final damage formula.
- [ ] Consider allowing individual weapons to override the character's default damage attribute.

## Weapons

- [ ] Add Normal, Edge, and Setback controls directly beside each weapon.
- [ ] Make the currently selected roll mode visually obvious.
- [ ] Keep attack and damage calculations separate.
- [ ] Prevent rank bonuses from being added automatically to weapons.
- [ ] Show a preview of the final damage formula before rolling.

## Sustained Semblance

- [ ] Add a button that subtracts 2 Aura for sustaining a Semblance.
- [ ] Add confirmation or undo protection against accidental clicks.
- [ ] Record the Aura change in the combat log.

---

# Milestone 3: Aura System

## Character Aura

- [ ] Add an Aura color field to the character sheet.
- [ ] Use the selected Aura color for:
  - Aura bars
  - Token effects
  - Aura damage
  - Aura break
  - Character-sheet accents where appropriate

## Enemy Aura

- [ ] Allow enemies and custom monsters to have Aura.
- [ ] Support current Aura and maximum Aura separately.
- [ ] Show enemy Aura in the selected-token inspector.
- [ ] Allow the DM to hide exact enemy Aura values from players.

## Aura break

- [ ] Add a glass-breaking sound when Aura reaches zero.
- [ ] Add an Aura-shatter visual effect.
- [ ] Use the character's selected Aura color in the effect.
- [ ] Apply an Aura Broken state.
- [ ] Add the break to the combat log.
- [ ] Avoid replaying the effect repeatedly while Aura remains at zero.

---

# Milestone 4: Dust System

## Dust inventory and charges

- [ ] Build a clear Dust-vial tracker.
- [ ] Each vial contains 3 charges.
- [ ] Allow individual charges to be consumed or restored.
- [ ] Allow an entire vial to be refilled.
- [ ] Allow vials to be added or removed.
- [ ] Allow each vial to have a Dust type.
- [ ] Allow custom or mixed Dust types.

Suggested display:

```text
Fire Dust
Vial 1: ● ● ●
Vial 2: ● ● ○
Vial 3: ○ ○ ○
```

## Dust effects

- [ ] Add visual and audio effects for Dust abilities.
- [ ] Initial Dust types may include:
  - Fire
  - Ice
  - Lightning
  - Wind
  - Earth
  - Gravity
  - Hard-Light
  - Water
- [ ] Add Dust combination rules after reference images and rules are supplied.
- [ ] Avoid hard-coding combinations until the full rules are reviewed.

---

# Milestone 5: Conditions and Combat Presentation

## Condition styling

- [ ] Give conditions distinct text colors, badges, or icons.
- [ ] Do not rely on color alone for accessibility.
- [ ] Show condition styling in:
  - Selected-token details
  - Token overlays
  - Initiative
  - Combat logs
  - Character sheets

Suggested visual identities:

- Burning: red or orange
- Frozen: pale blue
- Broken: crimson or fractured
- Stunned: yellow
- Poisoned: green
- Down: dark red
- Restrained: purple
- Blinded: grey

## Down state

- [ ] Add a Down condition or combat state.
- [ ] Add a visual token overlay.
- [ ] Clearly display Down in the sidebar.
- [ ] Optionally dim or desaturate the token.
- [ ] Announce the state in the combat log.
- [ ] Allow recovery or removal through DM controls.

---

# Milestone 6: Monster Library

- [ ] Expand the existing monster dictionary into a reusable Monster Library.
- [ ] Allow creation of custom monsters.
- [ ] Allow transparent PNG uploads.
- [ ] Support HP and Aura.
- [ ] Support attributes and skills.
- [ ] Support attacks and damage formulas.
- [ ] Support conditions, immunities, and resistances.
- [ ] Support Dust abilities.
- [ ] Support Semblance-like abilities.
- [ ] Allow monsters to be duplicated.
- [ ] Allow saved monsters to be edited.
- [ ] Allow monsters to be deployed directly onto a map.
- [ ] Allow monsters to be reused across campaigns.
- [ ] Support private DM monsters and optionally shared monsters.

---

# Milestone 7: Campaign Notes

## Note permissions

- [ ] Allow notes to be private to their author.
- [ ] Allow notes to be shared with the whole party.
- [ ] Allow DM-only notes.
- [ ] Allow notes to be shared with selected players.

## Built-in notes

- [ ] Add headings, lists, bold text, links, and tables.
- [ ] Add automatic saving.
- [ ] Add search.
- [ ] Add folders, tags, or categories.
- [ ] Allow linking notes to:
  - Characters
  - NPCs
  - Maps
  - Sessions
  - Quests
  - Items

## Google Docs approach

For very large documents, such as a 69-page campaign document, players should continue using Google Docs initially.

### Phase 1

- [ ] Allow a Google Docs link to be saved in the campaign.
- [ ] Add a title and description.
- [ ] Add private, party, selected-player, and DM-only permissions.
- [ ] Open the document in a new tab.

### Phase 2

- [ ] Add a built-in rich-text editor for smaller notes.

### Phase 3

- [ ] Investigate Google Drive integration.
- [ ] Investigate importing or previewing Google Docs.
- [ ] Avoid attempting to recreate the entire Google Docs editing experience.

---

# Milestone 8: Roll and Notification Improvements

- [x] Fix roll notifications after the roll history reaches its maximum retained length.
- [ ] Confirm notifications work for all weapon attack and damage buttons.
- [ ] Confirm notifications work for Normal, Edge, and Setback rolls.
- [ ] Confirm private and blind roll visibility is correct.
- [ ] Test roll notifications in Firefox.
- [ ] Add clearer labels for attack rolls versus damage rolls.

---

# Recently Completed

- [x] Move Scene Director into the collapsible DM sidebar.
- [x] Move Map Object controls into the collapsible DM sidebar.
- [x] Remove those controls from the open map area.
- [x] Add a collapsible map sidebar.
- [x] Add character-sheet links from the sidebar.
- [x] Add prepared token and encounter tools.
- [x] Add exact drag placement.
- [x] Add visual encounter formations.
- [x] Fix roll notifications when the retained roll list remains the same length.

---

# Suggested Implementation Priority

## Immediate

1. Active map-tool indicator
2. Panel movement and resizing fixes
3. Chat input anchoring
4. Weapon Normal, Edge, and Setback controls
5. Main Attribute damage support
6. Enemy Aura
7. Sustained Semblance Aura button
8. Collapsible character-sheet sections

## Next

1. Dust vial and charge tracking
2. Aura colors
3. Aura break audio and visual effects
4. Condition colors
5. Down state
6. Custom Monster Library

## Later

1. Built-in campaign notes
2. Google Docs links and permissions
3. Google Drive integration
4. Dust combinations
5. Expanded Dust animations

---

# Open Design Questions

- [ ] Should panel snapping be removed completely or made optional?
- [ ] Should individual weapons be able to override the character's Main Attribute?
- [ ] Should enemy Aura values be exact, approximate, or hidden from players?
- [ ] Which Dust types and combinations are officially supported?
- [ ] Should Aura automatically regenerate, or remain completely manual?
- [ ] Should the Down state trigger automatically at zero HP?

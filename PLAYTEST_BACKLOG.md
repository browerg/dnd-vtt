# RWBY VTT Playtest Backlog

This document tracks confirmed rules, bugs, usability problems, feature requests, and future milestones discovered through playtesting.

## Status key

- `[ ]` Not started
- `[~]` In progress / partially implemented
- `[x]` Completed
- `[?]` Needs clarification or design decision

---

# Confirmed Rules and Decisions

## Weapon attributes

- [x] Add a Main Attribute selector to the character sheet.
- [x] Apply the selected Main Attribute to **weapon damage only**.
- [x] Do not apply it to weapon attack rolls.
- [x] Do not apply it to skill rolls.
- [x] Add the attribute bonus on top of the weapon's existing damage formula.

## Rank bonuses

- [x] Rank bonuses apply to appropriate skills.
- [x] Rank bonuses are not automatically added to weapon rolls.

## Dust allocation

- [x] Every character begins with 3 Dust vials.
- [x] A Dust Mage receives 2 additional Dust vials.
- [x] Ranking up grants 2 additional Dust vials.
- [x] Each Dust vial contains 3 charges.

---

# Milestone 1: Playtest Stability and Map Usability

## Active map-tool indicator

- [~] Clearly identify the currently selected map tool.
- [ ] Add an optional persistent `ACTIVE TOOL` label.
- [~] Improve map cursors for selected tools.
- [~] Reduce accidental draw/move actions caused by unclear tool state.

## Panel movement and resizing

- [~] Reduce text/interface highlighting while panels move or resize.
- [~] Improve resize handles and resizing behavior.
- [~] Improve panel movement consistency.
- [~] Reduce unwanted snapping.
- [x] Persist dashboard panel layouts on the server.
- [~] Continue panel deletion/usability polish.
- [ ] Decide whether snapping should be optional.

## Chat panel

- [x] Keep chat input anchored to the bottom.
- [x] Keep message history independently scrollable.
- [x] Prevent the input from moving out of view while resizing.

## Browser compatibility

- [ ] Firefox compatibility pass.
- [ ] Pointer capture testing during token dragging.
- [ ] Custom range slider testing.
- [ ] Floating/fixed panel testing inside transforms.
- [ ] Hover-only control testing.
- [ ] Browser-sensitive CSS review.

---

# Milestone 2: Character Sheet Overhaul

## Collapsible sections

- [x] Make major character-sheet sections collapsible.
- [x] Save collapsed-section preferences.

## Main attribute

- [x] Add a Main Attribute selector.
- [x] Include the selected attribute in weapon damage.
- [x] Display the applied attribute in weapon-damage calculations.
- [?] Decide whether individual weapons can override the default Main Attribute.

## Weapons

- [x] Add Normal, Edge, and Setback controls.
- [x] Make selected roll mode visually clear.
- [x] Keep attack and damage calculations separate.
- [x] Prevent rank bonuses from being automatically added to weapons.
- [x] Show the resulting weapon damage calculation.

## Sustained Semblance

- [x] Add the 2 Aura sustain control.
- [~] Continue accidental-click protection where useful.
- [~] Continue improving combat-log coverage for Aura changes.

---

# Milestone 3: Aura System

## Character Aura

- [x] Add Aura color.
- [x] Use Aura color in Aura UI/effects.
- [x] Support Aura bars and token presentation.
- [x] Support Aura damage and Aura-break behavior.

## Enemy Aura

- [x] Allow enemies/custom monsters to have Aura.
- [x] Support current and maximum Aura.
- [x] Show enemy Aura in tactical/map interfaces where applicable.
- [~] Continue refining how much exact enemy Aura information players see.

## Aura break

- [x] Add Aura-break sound.
- [x] Add Aura-shatter visual effect.
- [x] Use Aura color in the effect.
- [x] Apply Aura Broken state.
- [~] Continue improving combat-log coverage.
- [x] Avoid replaying the break repeatedly while Aura remains at zero.

---

# Milestone 4: Dust System

## Dust inventory and charges

- [x] Build a Dust-vial tracker.
- [x] Each vial contains 3 charges.
- [x] Consume/restore charges.
- [x] Refill vials.
- [x] Manage vials through the character system.
- [x] Assign Dust types.
- [x] Support implemented Remnant Dust rules and allocation.

## Dust effects

- [x] Add Dust-related token effects.
- [~] Continue expanding audio/visual presentation.
- [ ] Add additional Dust combinations after rules review.
- [x] Avoid unsupported hard-coded combinations.

---

# Milestone 5: Conditions and Combat Presentation

## Condition styling

- [x] Add distinct condition visuals/icons.
- [x] Avoid relying on color alone.
- [x] Show conditions on tactical-map tokens and selected-token interfaces.
- [~] Continue standardizing condition presentation across initiative, logs, and sheets.

## Down state / Final Flare

- [x] Add Downed and Critically Downed states.
- [x] Add token presentation for downed/final-flare states.
- [x] Display downed state in encounter/tactical interfaces.
- [x] Support RWBY Final Flare behavior around zero HP.
- [~] Continue improving combat-log announcements.
- [x] Allow DM-controlled recovery/removal through the condition system.

---

# Milestone 6: Monster Library / Grimm Archive

- [x] Expand into a reusable Monster Library / Grimm Archive.
- [x] Add Remnant/Grimm library content.
- [x] Support artwork/token images and preserve art when preparing/deploying tokens.
- [x] Support HP and combat statistics.
- [x] Support attributes/skills and Remnant-specific monster data.
- [x] Support attacks/damage/action data.
- [x] Prepare and deploy monsters onto maps.
- [x] Reuse prepared monsters/encounters.
- [x] Add prepared-token tray and visual encounter formations.
- [~] Continue expanding custom-monster editing/duplication.
- [~] Continue expanding custom resistances/immunities/Dust/Semblance-like data.

---

# Milestone 7: Campaign Notes

## Campaign notes and external documents

- [x] Add campaign notes support.
- [x] Add Google Drive / Google Docs link support.
- [x] Persist campaign document links.
- [x] Add navigation to campaign notes/resources.
- [~] Continue expanding note visibility/permission options.

## Built-in notes

- [~] Built-in notes exist; richer editing remains future work.
- [ ] Rich formatting.
- [~] Continue autosave/persistence improvements.
- [ ] Search.
- [ ] Folders/tags/categories.
- [ ] Rich linking to characters/NPCs/maps/sessions/quests/items.

## Google Docs approach

- [x] Save external Google Docs / Drive links.
- [x] Open campaign resources externally.
- [~] Continue expanding metadata/permission controls.
- [ ] Consider deeper Drive integration only if useful.
- [ ] Consider import/preview.
- [x] Do not attempt to recreate Google Docs.

---

# Milestone 8: Roll and Notification Improvements

- [x] Fix roll notifications after retained-history rollover.
- [x] Add weapon attack and damage roll integration.
- [x] Support Normal, Edge, and Setback.
- [x] Preserve private/blind visibility rules.
- [x] Add initiative tie-breakers and clearer turn order.
- [x] Synchronize multiplayer 3D dice animation start times.
- [x] Preload DiceBox to reduce first-roll delay.
- [x] Keep roll text hidden until dice land.
- [x] Reduce stalled-animation timeout from 15 seconds to 6 seconds.
- [~] Continue real-world remote multiplayer testing.
- [ ] Test rolls/3D dice in Firefox.

---

# Milestone 9: DM Tools, Permissions, and Campaign Flow

- [x] Scene Director in collapsible DM sidebar.
- [x] Map Object controls in collapsible DM sidebar.
- [x] Collapsible encounter/map sidebar.
- [x] Prepared token and encounter tools.
- [x] Exact drag placement and visual encounter formations.
- [x] Player-specific NPC control assignments.
- [x] DM/co-DM retain NPC access.
- [x] Server-persisted dashboard layouts.
- [x] Navigation improvements.
- [x] First-time DM onboarding tour.
- [x] DM Guide / guide library.

---

# Milestone 10: Discord Session Integration

## Session notifications

- [ ] Add optional Discord webhook URL to launcher settings.
- [ ] Add Test Discord Connection / Send Test Message.
- [ ] Wait for a valid Cloudflare public URL before notifying Discord.
- [ ] Automatically announce when hosting successfully starts.
- [ ] Prevent duplicate session-live notifications.
- [ ] Do not block hosting if Discord delivery fails.

## Join session link

- [ ] Include the current public VTT URL.
- [ ] Present a clear Join Game / Join Session action.
- [ ] Use the newly generated quick-tunnel URL each session.
- [ ] Never reuse a stale URL.

## Initial scope

- [ ] Discord webhook only.
- [ ] No bot commands yet.
- [ ] No Discord account linking yet.
- [ ] No role sync yet.
- [ ] No VTT/Discord chat sync yet.

---

# Recently Completed

- [x] Main Attribute weapon-damage support.
- [x] Weapon Normal / Edge / Setback controls.
- [x] Sustained Semblance Aura support.
- [x] Collapsible character-sheet overhaul.
- [x] Dust vial/charge rules and elemental token effects.
- [x] Aura colors, break visuals, and sound.
- [x] Downed / Critically Downed / Final Flare flow.
- [x] Initiative tie-breakers and turn-order display.
- [x] Remnant Grimm / Monster Library expansion.
- [x] Prepared token tray and encounter formations.
- [x] Campaign Notes / Google Drive links.
- [x] Persistent dashboard layouts and navigation polish.
- [x] Per-player NPC control assignments.
- [x] DM onboarding tour and guide library.
- [x] Multiplayer dice animation synchronization.

---

# Suggested Implementation Priority

## Immediate

1. Remote multiplayer test of synchronized dice.
2. Discord session-live webhook notification.
3. Discord Join Game / Join Session link.
4. Remaining map-tool indicator polish.
5. Remaining panel movement/resizing polish.

## Next

1. Firefox/browser compatibility pass.
2. Richer built-in campaign notes.
3. Additional custom-monster editing.
4. Additional Dust combinations/effects after rules review.
5. More combat-log polish.

## Later

1. Deeper Google Drive integration if needed.
2. More advanced Discord integration after webhook notifications are stable.
3. Optional Discord account linking/bot commands/role sync/chat.

---

# Open Design Questions

- [ ] Should panel snapping be removed or optional?
- [ ] Should individual weapons override the default Main Attribute?
- [ ] Should enemy Aura values be exact, approximate, or hidden?
- [ ] Which additional Dust combinations should be supported?
- [ ] Should Aura automatically regenerate or remain manual?
- [ ] Should any downed-state transitions beyond Final Flare trigger automatically?

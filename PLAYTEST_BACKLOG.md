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

- [x] Clearly identify the currently selected map tool.
- [x] Add an optional persistent `ACTIVE TOOL` label. (Always-on rather than toggleable.)
- [x] Improve map cursors for selected tools. (All six tools have distinct cursors.)
- [~] Reduce accidental draw/move actions caused by unclear tool state. (Indicator,
      cursors, and per-tool hints are all shipped; needs a playtest to confirm the
      accidents actually stopped.)

## Panel movement and resizing

- [x] Reduce text/interface highlighting while panels move or resize.
- [x] Improve resize handles and resizing behavior.
- [x] Improve panel movement consistency.
- [x] Reduce unwanted snapping. (`compactType={null}` + `preventCollision={false}` —
      panels stay exactly where they are dropped.)
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

**Complete.** This milestone ships in the launcher, not the VTT — see
[vivid-realms-launcher](https://github.com/browerg/vivid-realms-launcher)
(`src/main.js`, the `announceDiscordSession` / `announceDiscordSessionEnded` /
`testDiscordWebhook` functions and the `launcher:save-discord-settings` IPC handler).
That is why it read as untouched here for so long.

## Session notifications

- [x] Add optional Discord webhook URL to launcher settings.
- [x] Add Test Discord Connection / Send Test Message.
- [x] Wait for a valid Cloudflare public URL before notifying Discord. (Fires from
      `parseTunnelOutput` only once the `*.trycloudflare.com` address is scraped.)
- [x] Automatically announce when hosting successfully starts.
- [x] Prevent duplicate session-live notifications. (`discordAnnouncementAttempted`
      latch plus a URL-change guard.)
- [x] Do not block hosting if Discord delivery fails. (Failures are caught, logged,
      and surfaced as a status message; hosting continues.)

## Join session link

- [x] Include the current public VTT URL.
- [x] Present a clear Join Game / Join Session action. (Real Discord link buttons,
      with an automatic fallback to plain clickable URLs if Discord rejects the
      components payload.)
- [x] Use the newly generated quick-tunnel URL each session.
- [x] Never reuse a stale URL. (Invite URL and announcement latches reset on both
      start and stop.)

## Initial scope

- [x] Discord webhook only.
- [x] No bot commands yet.
- [x] No Discord account linking yet.
- [x] No role sync yet.
- [x] No VTT/Discord chat sync yet.

## Delivered beyond the original scope

- [x] Session-**ended** notification with a formatted session duration.
- [x] Optional Session Notes URL, surfaced in both the start and end messages.
- [x] Custom session announcement text (up to 1,200 characters).
- [x] Independent enable/disable toggles for start and end announcements.
- [x] Webhook URL validated against an allowlist of Discord hosts before any request.

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
- [x] Discord session integration — start/end notifications, Join Session button,
      session notes link, and custom announcement text (ships in the launcher repo).
- [x] Active map-tool indicator, per-tool cursors, and keyboard shortcuts.
- [x] Dashboard panel drag/resize polish — no text selection while dragging, styled
      resize handles, free placement with no auto-compaction.
- [x] Repaired double-encoded UTF-8 (mojibake) across 9 client/server source files —
      em-dashes, ellipses, and every map-tool and panel icon.

---

# Suggested Implementation Priority

## Immediate

1. Remote multiplayer test of synchronized dice.
2. Firefox/browser compatibility pass (rolls, 3D dice, pointer capture, range sliders).
3. Playtest confirmation that the map-tool indicator actually stopped the accidental
   draw/move actions.

## Next

1. Richer built-in campaign notes (formatting, search, tags, linking).
2. Additional custom-monster editing.
3. Additional Dust combinations/effects after rules review.
4. More combat-log polish.
5. Decide the open design questions below — several are now the main thing blocking
   further Aura/condition automation.

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

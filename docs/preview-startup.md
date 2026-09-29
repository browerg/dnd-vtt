# Cosmetic preview startup

All rolling demos (bundle dice, bundle trail, trail catalogue, mystery dice catalogue, Cache dice rewards and Customize Dice throw buttons) use `previewDice` in `client/src/dice3d.ts`.

- Emporium and Customize Dice preload the renderer without sound assets.
- Previews never request collision audio and stay silent even after a gameplay roll has loaded sound banks.
- The pinned dice-box-threejs engine performs its `simulateThrow` rehearsal synchronously inside `roll`. The preview call temporarily bypasses only that rehearsal and restores the method in `finally`; unforced cosmetic dice then simulate visibly. Gameplay retains the rehearsal and forced face mapping.
- A newer preview cancels the old preview's animation wait and linger. Cleanup finishes before the replacement starts. Gameplay rolls are never cancelled by a preview: the preview reports a busy tray instead of silently waiting behind gameplay.
- Ordinary previews linger for 250ms after landing; six-die showcases linger for 1.2s.
- Shop Nat 20 / Nat 1 events are explicitly marked as previews, replace the current overlay immediately and skip sound. Gameplay critical events still queue normally.
- Turn-start previews are local state updates with no asset wait. Token borders and chat names are already rendered in their catalogue cards. The customizer's rotating model is already silent, with a 90ms settings debounce.

Validation: `scripts/check-all-previews.mts` exercises every trail, all four special dice, custom dice, replacement and an authoritative gameplay roll. `scripts/check-preview-startup.mts` holds audio requests to confirm visual initialization needs none. `scripts/check-first-flame-trail.mts` checks the actual preview buttons, preference preservation, ownership, mobile and reduced motion.

The emissive lighting masks are capped at 128px along their longest edge. Diffuse face artwork, numerals, UV alignment and shader glyph protection retain their original resolution. This bounds the synchronous pixel-classification work on every special die face.

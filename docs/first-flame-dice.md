# Relic of the First Flame

`first-flame` extends the installed `@3d-dice/dice-box-threejs` 0.0.12
integration (bundled Three r143). It changes no geometry, physics, notation,
server results, ownership rules, or gameplay.

## Integration

- `client/src/dice3d.ts`: `ensureBox()` constructs the shared box; `drain()`
  configures each queued roll, awaits `roll()`, announces critical results,
  lingers, and clears the dice. `notationFor()` still supplies forced faces.
- `client/src/diceCustomization.ts`: normal colorsets, patterns, and the
  existing glass experiment. The experiment skips factories with an active
  cosmetic, so it cannot alter the relic or leak into a separate preview box.
- `client/src/diceCosmetics.ts`: theme registry, deterministic 512px stone/crack
  artwork, composited-face emissive masks, and per-roll animation controller.
  The existing material factory is wrapped once per box, including its d4
  forced-face rebuilds. No shader patch or additional rendering engine is used.
- Trails remain in `dice3d.ts`'s canvas overlay. First Flame uses a 260ms ribbon
  and at most 80 small embers. A saved trail selection takes precedence over
  the theme's default; equipping the dice does not overwrite that selection.
- `CriticalRollOverlay` handles `tabletop:critical-roll`. The theme supplies a
  default Nat 20 effect; `/api/shop/critical-effect` indicates whether the roller
  explicitly equipped another effect, which takes precedence. Nat 1 is unchanged.

The controller pulses slowly at idle, strengthens during rolls, settles after
landing, and adds one 650ms Nat 20 flare. The engine stops rendering after landing,
so the controller renders the existing scene during the 700ms linger. It does not
double-render during physics. Masks share no image Source with diffuse textures;
they are reused within a roll and disposed when the dice clear. Reduced motion
uses constant emission, suppresses trails, and disables celebration motion.

New mythic themes can supply a texture generator, emission classifier, palette,
pulse settings, and trail/critical IDs through `DiceCosmetic`.

## Selection and validation

Relic owners can equip and preview the dice in Vivid Cache. Trail and critical
effect components remain available through the existing cosmetic selectors.

Run `npm run typecheck --workspace=server`, `npx tsc --noEmit -p client/tsconfig.json`,
`npm test --workspace=server`, and `npm run build`.

Browser smoke checks:

1. Preview First Flame, then roll it with forced d4/d6/d8/d10/d12/d20 faces.
   Check visible values, readable labels, moving crack glow, and landing fade.
2. Roll a natural 20: check the dice flare and short gold/ember celebration.
   An explicitly equipped celebration should still win over the default.
3. Switch to white/custom dice, then back to First Flame. Check that glow does
   not leak and that subsequent previews/random rolls complete normally.
4. Enable reduced motion and repeat. Emission should remain constant with no trail.

Verified in headless Edge with the real WebGL engine and the application's roll
queue. The library has an existing d4 quirk: its returned result cache may retain
the pre-swap value, while `getFaceValue()` and the displayed face correctly match
the forced value. This also occurs with white dice; VTT results remain authoritative
on the server and do not consume that cache.

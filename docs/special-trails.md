# Special dice trails

Three Legendary Vivid Cache rewards extend the existing local trail selector:

- **Riftwake** (`riftwake` / `trail-riftwake`): violet elliptical apertures with
  a rotating mint arc, expanding then contracting along the dice path.
- **Astral Script** (`astral-script` / `trail-astral-script`): sequentially drawn
  golden rune strokes, linked starlight and upward drift.
- **Prism Shatter** (`prism-shatter` / `trail-prism-shatter`): paired streams of
  rotating two-face crystals with spectral colors and simulated tumbling.

Find all three under **Emporium → Dice trails**. Anyone can preview a full dice
set over the dark showcase backdrop. Previewing never writes a saved trail;
the catalogue returns after the roll. Winning grants the matching entitlement;
owners equip through Dice trails or the Customize Dice selector. The existing
local trail preference behavior is preserved.

They are cache-exclusive, including for GM/free-cosmetics bypasses. Each has
weight 45 of 10,000 (0.45%). Rose Burst now also has weight 45; the total Legendary
share remains 1.8%. Mythic dice odds and the free Cache price are unchanged.

`shared/specialTrails.ts` owns names, descriptions and entitlement IDs.
`client/src/specialTrails.ts` implements bounded Canvas 2D particles. Spawning is
distance-based, so stationary dice do not accumulate effects. At most 96 marks
exist at once per roll; marks expire within 1.1 seconds. A new roll cancels the previous
trail renderer so fading effects cannot clear the new roll's canvas. Reduced
motion skips trails and stops an active trail if the preference changes.
The swatches and Cache cards use authored SVG in `CacheRewardArt.tsx`.

Validation: server tests cover catalogue consistency, lifetime, Canvas save/
restore balance, stationary sampling and particle bounds. The browser check
`scripts/check-special-trails.mts` mocks accounts and APIs, previews all three,
checks unchanged preferences, locks unowned trails, equips an owned trail, and
checks desktop/mobile and reduced motion. It does not open player data.
Run with `node --import tsx scripts/check-special-trails.mts`; `QA_URL` defaults
to `http://127.0.0.1:5176/shop`, and `PLAYWRIGHT_MODULE` can point to a bundled
Playwright `index.mjs`. Screenshots go to `../vtt-trails-qa` or `QA_OUTPUT`.

## First Flame bundle trail

The existing `first-flame` trail now uses the special renderer: distance-sampled molten seams, paired lifting obsidian plates and a forked flame vent every third sample. Gold cools through orange to crimson over 1.1 seconds. Marks are capped at 96; reduced motion, roll replacement and disposal share the special-trail cleanup. The existing bundle entitlement and Mythic rarity are unchanged.

The Emporium's bundle and trail catalogue use matching faultline artwork. Free previews show the Relic dice with their trail and preserve saved preferences. `scripts/check-first-flame-trail.mts` checks preview, mobile layout, reduced motion and equip with synthetic ownership. The shared lifecycle test also covers First Flame expiration and canvas state balance.

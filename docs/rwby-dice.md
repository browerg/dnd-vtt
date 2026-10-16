# RWBY Legendary dice

Three authored dice materials, listed in Emporium → Mystery dice and in Vivid Cache:

- **Silver-Eyed Eclipse:** crimson lacquer, six silver scythe engravings, orbiting petals and a silver sweep. Preview uses the existing petals trail.
- **Winter’s Reliquary:** midnight blue crystal, twelve porcelain spear inlays, concentric silver rings and counter-rotating blue glyph light. Preview uses the existing frost trail.
- **Emberheart Reactor:** eight gunmetal armor segments, brass fasteners and heat vents that charge sequentially around an expanding amber pulse. Preview uses the existing ember trail.

The face textures are deterministic Canvas artwork. Time-based light is bounded GLSL, with no per-frame texture creation. Existing geometry, physics and face numbering remain intact for the supported dice shapes. Numerals retain the existing shader's protected ink mask; reduced motion freezes the surface animation. No critical effect or trail entitlement is bundled with these dice.

## Acquisition and odds

All three are **Legendary** (Garrett's call, 2026-10-15): bought outright for the Legendary price (`RARITY_PRICES.legendary`, 1,000 VCoins) or won in Vivid Cache at the same weight as the other Legendary rewards.

- `shared/rwbyDice.ts` holds the IDs and `rarity`. They are spread into `MYTHIC_DICE` (`shared/mythicDice.ts`), which is really the list of unlock-gated dice; each entry's `rarity` says how it is obtained.
- `server/src/shopCatalog.ts` sells each set as a `type: "dice"` cosmetic whose ID **is** the dice unlock ID, so the normal `/api/shop/purchase` route writes exactly the row `ownsMythicDice` checks. Under the GM bypass the purchase records that row too, since dice ownership never reads the bypass.
- `server/src/vividCacheStore.ts` scales all weights so the Mythic tier stays at exactly 3%, shared equally, however many rewards are added; the other rewards keep their relative weights.

## Previews

`RWBY_DICE_PREVIEWS` in `shared/rwbyDice.ts` is **true** and is meant to stay on: Legendary items are not secret, so Mystery dice shows the real material and a free "Preview roll". Previews never change equipment or ownership. Mythic sets stay concealed.

Validation: production build, server typecheck, reward/ownership/pricing tests (`server/src/rwbyDice.test.ts`), and `scripts/check-rwby-dice.mts` for browser rendering, preview isolation, narrow viewport and reduced motion. The browser harness mocks accounts and never opens the player database.

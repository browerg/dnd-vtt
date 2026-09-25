# Mystery dice previews

The Emporium's **Mystery dice** catalogue contains three sets. Their names
remain visible alongside black silhouettes and question marks, even after
previewing -- in the catalogue, the Vivid Cache reel and the cache reveal alike.
They are not purchases.

**Since 2026-09-25 they are Vivid Cache rewards at mythic rarity** (weight 5 each,
the same as the Relic, keeping the mythic tier at 20 of 10,000), and a winner can
equip them. `shared/mythicDice.ts` maps each theme to its unlock id;
`server/src/diceOwnership.ts` checks the unlock, and both the equip gate in
`server/src/auth.ts` and the cache reveal's Equip button go through it.

- **Event Horizon:** obsidian-purple star fields, accretion rings, and moving
  spiral light around a dark center.
- **Chronos Engine:** brass dial marks, concentric mechanical rings, a mint
  sweep, and counter-moving illuminated teeth.
- **Prismatic Echo:** an interlocking crystal lattice with spectral interference
  and traveling facet highlights.

`client/src/specialDice.ts` defines the deterministic canvas textures and three
GPU surface effects. `diceCosmetics.ts` registers them with the existing material
factory. Each effect has its own shader cache key, with one shared time uniform
per roll. Printed numbers get steady illumination independently of the effect.
Reduced motion freezes the uniform and emission; trails already honor that setting.
The geometry, physics, and actual roll results are unchanged.

The catalogue closes while the global renderer shows d4/d6/d8/d10/d12/d20 over a
dark backdrop, holds for 2.6 seconds after landing, then reopens. Shop navigation
and controls are inert during this reveal and regain interaction afterward. The preview uses
an explicit per-roll trail and never writes saved settings or calls a purchase or
equip endpoint. Errors return to the catalogue with feedback. Navigating away
does not reopen it on another page.

Validation: `npm run build`, `npm run typecheck --workspace=server`, and
`npm run test --workspace=server`. The material lifecycle test covers distinct
shader programs, reduced motion, texture disposal, and ordinary-dice isolation.

For the browser smoke check, start the client on port 5175 and run
`node --import tsx scripts/check-special-dice.mts`. It requires Playwright and
Microsoft Edge; `PLAYWRIGHT_MODULE` can point to a bundled Playwright `index.mjs`.
`QA_URL` and `QA_OUTPUT` override the local page and screenshot directory.
The test mocks all API responses and does not start the server or open player data.

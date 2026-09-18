# Vivid Cache

The Emporium includes a 500-VCoin cache using the existing fictional wallet,
cosmetic unlocks, and transaction ledger. There are no purchases with real money.

## Configuration

`server/src/vividCacheStore.ts` owns the price, reward definitions, integer
weights, bundle unlock IDs, and duplicate refunds. The default probabilities are
70% Common, 22% Rare, 6% Epic, 1.8% Legendary, and 0.2% Mythic. Individual
probabilities are each reward's weight divided by the sum of all weights.
Refunds are respectively 100, 150, 200, 300, and 400 VCoins. Keep weights positive
integers and refunds below the opening cost. These existing shop rewards have
cache-specific rarity labels; their existing shop prices and rarities are unchanged.

## Persistence and recovery

`POST /api/shop/cache/open` accepts only a request ID; the authenticated session
supplies the account and cryptographic server randomness selects the reward.
A `BEGIN IMMEDIATE` transaction includes the conditional debit, selection,
unique unlock inserts, duplicate refund, ledger entries, and opening history.
Failures roll back all changes. A partially owned bundle grants its missing
pieces; only an entirely owned bundle refunds.

`vivid_cache_openings` records user, request ID, selected reward and rarity, cost,
refund, timestamp, and a snapshot of the returned result. Its unique account/key
constraint prevents recharging retries. A partial unique index allows only one
unacknowledged opening per account, including across tabs or server restarts.
Different request IDs return that pending opening rather than charging again.
There are no time-based expiry windows that could turn a delayed retry into a debit.

The client saves its request ID before sending. `GET /api/shop/cache` recovers an
undismissed reveal after reload. Continue calls the authenticated acknowledgement
endpoint; old request IDs still replay their original result after acknowledgement.
Opening snapshots contain the balance at purchase time; the catalog supplies the
current wallet balance. History is retained server-side, not exposed as a public
admin/debug endpoint.

## Relic of the First Flame

The bundle grants `relic-first-flame`, `dice-first-flame`, `trail-first-flame`,
`crit20-first-flame`, and `title-relic-owner` in the existing unlock table. It is
excluded from normal purchases, including GM/free-cosmetics bypasses. An authorized administrator can explicitly grant all five IDs in a database
transaction if needed; there is no player-facing grant endpoint.

Players equip dice from the cache collection, and choose the trail and Nat 20
effect using the existing selectors. Winning never overwrites an equipped cosmetic.
Dice use the existing saved `dice_theme` and multiplayer roll payload, with a
server ownership check on equip. The procedural canvas texture and existing
material hook produce obsidian, golden cracks, emissive numbers, and gentle
firelight while rolling. The trail uses small canvas embers. Nat 20 uses a brief
warm flare and existing ring/particle geometry with no new audio. The earned title
appears on the player's profile and profiles visible to campaign members.

The four priority pieces are implemented. Token borders and chat flair remain
future work because those cosmetic systems are not implemented in this repository.

## Presentation and verification

The reel receives an already committed reward. Weighted decorative draws surround
it with no conditional rare neighbors or near-miss adjustments. Fixed card spacing
centers the selected card at every viewport width. Reduced motion skips the reel
animation and disables the new particles and animated material glow.

The reel runs for 11 seconds with 56 card positions of travel and a gradual
slowdown. Quiet procedural ticks follow actual card crossings, slowing with the
reel. Ticks have no control of their own: the table's existing critical-roll
sound mute suppresses them, and reduced-motion and recovered reveals are silent
either way. Timing is configured in `shared/vividCacheReel.ts`.

Run `npm run test --workspace=server`, `npm run typecheck --workspace=server`,
and `npm run build`. Cache tests use isolated in-memory SQLite databases and cover
insufficient balance, debit/grants, exact weighted selection, duplicate refunds,
Mythic/partial bundles, rollback, pending recovery, account isolation, replay
protection, and reel positioning. Browser verification uses mocked API responses,
never the live player database.

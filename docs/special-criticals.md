# Special critical-success effects

Void Collapse, Heaven’s Lance, and Chronobreak extend the existing Natural 20 overlay. Each has authored geometry, a 3.3-second presentation and a distinct synthesized sound using the existing mute preference. Natural 1 effects remain unchanged. Reduced motion hides the spectacle while retaining the result and player name.

Shared metadata is in `shared/specialCriticals.ts`. The Emporium provides free previews and Cache-only ownership. Server purchase and GM bypass rules require actual unlocks for these effects; existing critical-slot equip and resolution handles them after unlocking.

Each reward has weight 150/10000 (1.5%). Lightning Strike now also has weight 150, preserving the 6% Epic total. Legendary and Mythic odds and the free Cache price remain unchanged.

Validation: production build, server typecheck, 57 server tests, and `scripts/check-special-criticals.mts` with synthetic accounts. Browser checks cover all three previews, absence of equip before unlocking, no preview writes, mobile overflow and reduced motion. Set PLAYWRIGHT_MODULE to a Playwright installation when it is not locally available. No player database is used.

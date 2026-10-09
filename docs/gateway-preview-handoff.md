# Candlelit gateway preview

Approved: shared-table login and ivory horizontal campaign lobby. Device-local optional preview, original theme remains default. No campaign dashboard theme changes.

## Graphics completed first

All production art is in `client/public/assets/gateway-preview/`. `library.webp` (238 KB) is the shared login/lobby backdrop; `lobby-banner.webp` (129 KB) is the lobby header; `remnant-cover.webp` (64 KB) and `fantasy-cover.webp` (73 KB) are system fallback campaign covers. Art has no baked-in UI. `compass.svg` and `frame.svg` are original responsive vector ornaments. Raster provenance is beside assets.

Approved references: `C:/Users/melin/creative/login-concepts/shared-table.png` and `C:/Users/melin/creative/campaign-selection-concepts/campaign-lobby.png`.

## Design contract

Ivory #f6efe3, ink #14243c, copper #b78859, warm muted #65584c. Crimson Pro headings; Alegreya Sans body. Login has large live Vivid Realms wordmark and tagline on left, opaque ivory form on right. Lobby has wood header, ivory content sheet, illustrated header, search and system filters, vertically scrolling horizontal campaign rows. All names, roles and descriptions come from actual campaign API, never sample mockup data. Covers depend on system until custom campaign artwork exists; do not invent a map or upload API.

## Behavior

Toggle label `Updated theme · Preview`; persist on device, keep working when storage unavailable, synchronize mounted components and tabs. Put toggle on both login and directory so the user can revert after sign-in. Keep login/register/recovery and dev-login functional. Reuse campaign creation and role routing. Matching welcome transition uses compass, copper/ivory colors and reveal; avoid new video payload. Reduced motion gets simple fade. Preview on small screens stacks the login form and campaign rows; existing theme is unaffected.

## Handoff

Assets are ready for Claude or Codex to implement. Work in `LoginPage.tsx`, `DashboardPage.tsx`, `WelcomeOverlay.tsx` with scoped CSS and one shared device preference hook. Test original and preview, auth modes, search/filter, create and enter campaign, persistence, mobile, keyboard and reduced motion. Do not push without user request.

## Implementation status

Implemented locally by Codex after graphics completion. `components/GatewayPreview.tsx` owns the device-local toggle; `GatewayPreview.css` scopes the illustrated theme. Login, directory and welcome overlay opt in through the shared hook. Search uses real campaign names/descriptions. Default system covers are deliberately shared, not story-specific artwork. Initial cinematic entrance video is unchanged; only the post-sign-in greeting is themed. Browser checks in `scripts/check-gateway-preview.mjs` cover default-off, persistence, login, transition, twelve campaigns, search, mobile overflow and revert. Screenshots are under `.impeccable/review/gateway-preview/`. Built-in bundled Playwright can be supplied via `PLAYWRIGHT_MODULE`.

## Reference fidelity correction

Desktop login now uses login-reference.webp from the exact approved image, preserving the scene, logo, tagline and outer frame. The painted account interior is covered by live accessible HTML fields and links. At 1586 x 992 its panel uses the original placement and proportions. Smaller screens use the clean library illustration and a stacked live form. Desktop artwork scales with the viewport; the live type and controls adapt rather than stretching. Browser checks additionally exercise registration and recovery navigation.

## Campaign directory fidelity correction

Uses campaign-reference.webp illustration regions for the approved brand and campaign cover artwork. Campaign names, descriptions, roles and links remain actual API data. Search and filters share the toolbar; metadata has its own column. The desktop sheet reserves a 795px minimum height and the directory 484px (about three campaign rows), growing with real content. Mobile stacks artwork and content. No campaigns are seeded or created by the redesign. Browser verification covers twelve, one and zero campaigns, one-campaign minimum height, setup open/close, search, mobile navigation bounds and reverting the preview.

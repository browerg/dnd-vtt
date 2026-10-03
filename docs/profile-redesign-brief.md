# Profile redesign exploration — 3 October 2026

## Confirmed intent

Redesign the owner and visitor profile pages. The user wants more customization and a stronger sense of personal ownership. Explore generated visual concepts first, then let the user select a direction before implementation. Their stated priority is **showing off earned badges and rare cosmetics**.

## Existing product truth

The current profile supports an uploaded avatar, display name, pronouns, a 280-character biography, ten predefined cover palettes, three showcased achievement badges, and the automatic earned Relic Owner title. Owner editing and password settings live on `/profile`; `/profiles/:userId` is the visitor presentation. The cover composition and badge layout are currently fixed. Existing profile access and cosmetic ownership rules must be preserved.

## Proposed outcome

A visitor recognizes the player through a deliberately chosen collection: featured rare item, earned badge arrangement, and selected cosmetic effects. The owner can preview and arrange their showcase without confusing preview with equipment changes. Ownership is server-authoritative; no locked or fabricated rewards appear as earned.

Potential additions shown in concepts are proposals, not existing functionality: a featured collectible with live preview, effect-preview buttons, configurable badge arrangements, uploaded cover art, theme accents, and movable showcase sections. Characters and campaign memories are secondary alternatives, not the user's primary request. Account security remains available separately from public presentation. Customize remains the home for the complete owned inventory.

## Exploration

Initial concepts explore a personal gallery, an art-led player canvas, and a campaign scrapbook. A focused Collector's Showcase concept responds to the user's subsequent emphasis on earned badges and rare cosmetics. Artwork, sample names, dates, badge labels, and inventories in the generated images are illustrative.

Experience mode for visitor presentation; Operate mode for owner editing. The user approved the Personal Gallery image and explicitly requested its exact layout and a matching example profile. Approved reference: `.impeccable/mocks/profile/personal-gallery.png`. Build comp-led. The demo is explicitly labelled and separate from actual account ownership.

## Direction contract

THESIS: A player's curated gallery, where personal art and earned objects have distinct places rather than a generic profile card.

OWN-WORLD: Near-black gallery walls, warm ivory serif text, restrained copper rules and controls. Rich fantasy artwork supplies colour; interface chrome stays quiet.

STORY: Meet the player in the portrait rail, see their chosen world, inspect their character and signature dice, then discover earned badges and a campaign memory.

FIRST VIEWPORT: At 1536 × 1024, a 54px top navigation; a 355px left portrait/identity rail; a wide castle banner over a 2:1 character/dice row; badges and memory beneath; a compact owner toolbar along the bottom. Preserve these proportions and the demo's artwork subjects and copy. Real profiles use the same semantic layout with their own saved content.

FORM: Personal Gallery, candidate 4 from seed cac199b3, explicitly selected by the user. The generated image is the approved comp. Sample artwork is regenerated into separate reusable assets; UI text stays semantic.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisions after viewing

Choose the profile composition, the prominence of a single signature collectible versus a broad trophy collection, and how much section rearrangement is useful. Then define the editor flow, responsive layout, ownership checks, access boundaries, reduced-motion and silent preview behavior, and new/empty collection states.

## Implemented follow-up

The current gallery has an owner editor and visitor presentation, plus `/profiles/example` for the labelled Ruby Rose example. Cover art, character art/name, signature dice, memory/caption, accent, section visibility and badge-first order save on the account. Badge selection retains its existing immediate-save behavior in Journal. Unsaved gallery drafts recover within the browser tab after navigation.

The user requested basic ready-made banners alongside uploads. Four free choices are available: Lakeside Citadel (the example's landscape art), Midnight, Ember and Forest (simple CSS colour treatments). Only those preset identifiers are accepted for covers; character and memory images still require uploaded raster paths. Banner changes preview immediately and publish with Done editing.

Verification includes build and server typecheck, banner validation and shared-campaign privacy tests, plus synthetic-account browser checks for saving, reloads, uploads, visitor preview, draft recovery, discard, hidden sections, save failure recovery, desktop/mobile layouts and inaccessible profile errors. The example never grants artwork or badges to a real account.

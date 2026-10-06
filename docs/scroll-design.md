# Personal Scroll direction

User-approved: Personal Signature (B) casing, wallpaper and personal emblem, with Academy (A) sans-serif message typography. Operate mode inside a Remnant campaign; character-owned device for chatting, contacts and rolls.

## Direction contract
THESIS: A personal Academy Scroll, recognisable as an everyday object in Remnant.
OWN-WORLD: graphite metal, crimson edge inlay, moonlit mountain wallpaper, engraved emblem; warm-white readable sans-serif messages.
STORY: open from the pocket, recognise your character, enter messages, contact the party, inspect rolls, make it yours.
FIRST VIEWPORT: slim framed portrait screen, status bar, large lock-screen clock and character name, central emblem, recent message and Open Scroll action. Messaging uses quiet wallpaper, comfortable bubbles, composer and four app destinations.
FORM: explicitly chosen by the user: B with A typography. Reference images exec-19a6c882-9bab-404f-a2aa-7b3e09bdc7ed.png and exec-d42bb815-0a0e-4b38-8a9b-e2d4e331d6cb.png in the task generated-images directory.
FINISH: verify desktop/mobile, chat and settings persistence, sound mute and reduced motion; record shipped design and asset provenance.

Preferences save on this browser per account and campaign. Uploads use the existing authenticated image endpoint. Existing server message permissions and private recipients remain authoritative. No invented delivery/read receipts.

## Reproduction and verification — 2026-10-06

This record is separate from the older Personal Gallery build state. The user chose B plus A typography directly; no retrospective concept-roll seed or closed automated gate is claimed.

Measured casing aperture from the generated reference-matched frame: left/right 6%, top 5.8%, bottom 8.5%. The live screen occupies that aperture; graphite metal, crimson inlays and the dimensional chin badge remain raster artwork. The central thorned rose is its own transparent plate. Wallpaper and UI remain independent.

Evidence: `.impeccable/review/scroll-lock.png`, `scroll-messages.png`, `scroll-settings-mobile.png`, `scroll-desktop-viewport.png`, `scroll-mobile-viewport.png`. Regenerate with `scripts/check-scroll.mjs`, using QA_URL and PLAYWRIGHT_MODULE as needed. Data in these captures is synthetic.

Review correction outcomes: textured casing/rose restored; warm message overlay restored; hidden threads scroll only when visible and retain reading position; unread clears only for the viewed channel; private header identifies the correspondent with available portrait or initials; reply icons are SVG and reply text uses sans-serif. Existing message channels are an intentional adaptation of the concept's single-conversation view.

Separate reviewer supplied the findings; its follow-up and documenter stopped at usage limits. Final correction scoring and documentation were completed locally. Browser regression covers lock/open, NPC private replies with preserved reply ID, draft and preference persistence, messages arriving while Settings is visible, rolls, and mobile bounds. Appearance settings remain browser-local, not account-synced.

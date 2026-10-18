# Sending correspondence in the VTT

## Overview

Sending is the D&D campaign correspondence dock implemented in `client/src/components/SendingDock.tsx`, `SendingDock.css`, and `MagicLetter.tsx`. It carries the approved parchment concept into real campaign messaging on the dashboard, campaign hub, map, character and bestiary screens, and schedule. Remnant campaigns retain their Pocket Scroll phone. Dashboard and hub message panels now provide an Open your Sendings entry point.

This is a scoped D&D correspondence expansion. It does not replace the global `DESIGN.md`, its sidecar, or other campaign visual systems. The implementation is in the local installed checkout; it has not been pushed or deployed. The standalone `/sending-demo.html` remains available with sample data and its separate controls; see [SENDING-DEMO.md](SENDING-DEMO.md).

## Colors

The transparent parchment artwork supplies warm vellum, deckled edges, and brass rolls. Dark brown text (`#493725`) and translucent brown rules (`#80663855`) organize messages. Rust controls (`#74402e`) use pale text (`#fff1d4`); unread dots and counts use rust and cream. Production magic uses Moonlight: pale core (`#e9fcff`), blue glow (`#65bdff`), and settled dark ink (`#423b37`). The demo's ink selector is not part of the production dock.

**The Settled Ink Rule.** Luminous writing settles into dark text for reading.

## Typography

Georgia/serif carries dock controls and static correspondence. The heading is regular 21px with 1.2 line height, inbox names 18px, excerpts 13px, and static messages 16px with 1.5 line height. Own static messages use italic text. Metadata and auxiliary controls use compact 10–12px treatments.

Animated letters use `28px "Segoe Script", "Lucida Handwriting", "SendingHand", cursive` with 40px line advances. SendingHand is the bundled Google Fonts Caveat face at `/assets/sending/caveat.ttf`, licensed in `client/public/assets/sending/CAVEAT-LICENSE.txt`. The renderer awaits its font-loading attempt before laying out the canvas. Locally installed Segoe Script and Lucida Handwriting take priority, so handwriting appearance can still vary across devices.

## Layout

The dock is fixed at bottom right: 340px wide, 18px from the right, 12px from the bottom, and at most 640px high while reserving 90px of viewport height. Only the parchment, sealed dock, and notification accept pointer input, allowing surrounding campaign interaction. The content frame has 74px top, 54px side, and 72px bottom insets to keep text clear of the ragged paper edges.

At 600px and narrower, the width fits within a 20px viewport allowance, right/bottom insets become 10px, content side insets become 52px, and available height reserves 45px. Below 560px viewport height, the dock fits within 16px vertically and content spacing tightens, retaining 52px side insets. The conversation log scrolls independently. Writing follows the newest letter when the reader is near the bottom; upward wheel or touch interaction stops the automatic writing follow.

## Elevation & Depth

The parchment uses the generated blank art at `/assets/sending/parchment.png` with a soft drop shadow. The sealed dock uses CSS rolled-paper gradients and a circular wax seal containing an inline SVG symbol. Unread messages add a soft seal glow; notification peeks float above the dock. No message text is baked into the art.

## Shapes

Fine straight rules divide channels, messages, quotes, and composer. Fields and send buttons use 3px corners. Unread counts are rounded; the seal is circular. Selection combines bold text and a rust bottom rule rather than a glowing tab fill.

## Components

**Channels and inbox:** Sendings is private correspondence; Party maps to in-character chat, Table talk to out-of-character chat, and Rolls reuses the existing `RollFeed`. Party, Table talk, outgoing letters, and old history remain static text. Private threads sort unread first, then by newest message ID. Thread identity uses the shared `chatThreads` helpers: other account plus both participants' personas, preserving separate GM/NPC conversations and reply targets.

**Real delivery:** campaign detail, members, characters, and message history load through existing campaign APIs. The component joins the campaign socket room, merges chat events by message ID, and reloads on connection and campaign/character updates. Private events are additionally filtered at the client boundary. Sending posts to `/api/campaigns/:id/messages`; errors appear inline, duplicate in-flight submission is blocked, and the draft clears after success. Spectators receive read-only presentation.

**Composition:** users can start a private conversation with another campaign member and write replies up to 4000 characters. GM/co-GM users can write as themselves, an NPC, or a named contact; Party supports GM or character speaker selection. Per-message Reply supplies a quote through `replyToId`, displayed with author and text. Clear conversation requests confirmation and calls the existing server hide-thread endpoint; it clears the viewer's inbox copy while retaining the other participant's copy.

**Read state and persistence:** open state, seen message IDs, and draft text are stored in `sessionStorage` under keys prefixed `sending:<userId>:<campaignId>`. Drafts are separate by thread/channel. These UI preferences are browser-tab session state, not server-synced read receipts. Real message history and thread hiding use the server. On the first history load without stored seen state, history establishes a quiet baseline rather than creating a backlog of unread magical letters.

**Incoming letters:** viewing a private conversation animates only its latest incoming unseen message. The renderer eases glyph reveal, samples letter pixels to position a star nib, adds two wisps, a 650ms fading trail, and time-adjusted twinkling sparks, then fades luminous glyphs to dark ink over 1500ms of animation time. Production uses a fixed 1.8 pace. This is glyph reveal, not true pen-stroke reconstruction.

**Notifications and rolls:** incoming messages outside the visible conversation show a clickable peek for six seconds without forcing the dock open. Roll notifications have their own count and 4.5-second peek; opening Rolls clears that count. Initial roll history is treated quietly. The old scroll alert suppresses its duplicate presentation when this dock is present.

**Accessibility:** canvas text has a separate screen-reader copy; Reveal all skips writing. Reduced motion immediately reveals dark ink and removes the parchment transition, including when the preference changes during playback. Focus outlines are brown and visible. Closed parchment is inert and hidden from assistive technology. Escape closes composition first, otherwise folds the dock and restores focus to its button; an active modal takes precedence.

## Do's and Don'ts

- **Do** preserve real campaign visibility, shared persona-aware thread keys, and server authority for sends and thread hiding.
- **Do** keep animation limited to new incoming private letters and retain skip and reduced-motion behavior.
- **Don't** confuse the public sample inbox with real correspondence or promote these scoped parchment tokens into global campaign styling.

Not canonized or repaired: compact auxiliary metadata is not a reusable body-text standard. Local handwriting variability, simulated stroke motion, and session-local UI preferences are explicit implementation limits; this documentation pass does not change code or claim deployment verification.

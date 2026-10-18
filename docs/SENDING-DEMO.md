# Sending prototype

## Overview

The standalone demo is served at `/sending-demo.html` from `client/public/sending-demo.html`. It records the user-approved concept as a working local prototype: a small parchment letter that writes itself in magical light. This is a local expansion of D&D correspondence within Vivid Realms, not a replacement for the global design system. The incumbent `DESIGN.md` and `.impeccable/design.json` retain their existing authority and scope.

The prototype contains sample conversations and local replies. Conversation history and read state are saved in `sessionStorage` under `vivid:sending-demo:inbox:v1`, scoped to the browser tab's session. Unsaved reply drafts live in memory per conversation and survive navigation within the open page, but not a reload. It is not connected to campaign chat, real message delivery, accounts, server persistence, or server permissions. Production integration is outside this implementation's scope.

Source evidence: the demo's embedded CSS and JavaScript, `client/public/sending-inbox.js`, `client/public/sending-inbox.css`, `client/public/assets/sending/README.md`, `PRODUCT.md`, and the incumbent `DESIGN.md`.

## Colors

The workbench uses a dark green-black background (`#161a18`) with warm ivory text (`#eee8d9`). Parchment has a warm vellum fallback (`#ead8af`), brown framing, and dark brown interface text. Generated artwork supplies the paper's material variation.

The three selectable inks have distinct luminous cores, glows, and settled inks:

| Ink | Core | Glow | Settled ink |
| --- | --- | --- | --- |
| Moonlight | `#e9fcff` | `#65bdff` | `#423b37` |
| Candle gold | `#fff9de` | `#ffc15a` | `#51391e` |
| Arcane violet | `#f6e8ff` | `#b17bff` | `#47324d` |

**The Settled Ink Rule.** Light accompanies writing; completed glyphs settle to dark ink for reading.

## Typography

The workbench heading uses locally bundled Cinzel with Georgia and serif fallbacks, regular weight, and a desktop size of `clamp(42px,6vw,72px)`. The mobile heading is 44px. Workbench body and controls use Georgia/serif at 16px; labels are 14px and hints 13px. Inside the parchment, the conversation title is 21px, inbox sender names 18px, static message bodies 16px with 1.5 line height, and metadata 11–12px. Local replies use italic message text.

Canvas handwriting uses `30px "Segoe Script", "Lucida Handwriting", cursive` with 48px line advances. These handwriting faces depend on local availability; the prototype does not bundle a handwriting font. Rendering and wrapping can therefore differ across devices. A production implementation should bundle a suitable licensed handwriting face.

## Layout

The desktop letter is fixed at the bottom right, 340px wide, with a height capped at 640px and constrained by viewport height. It sits 18px from the right and 14px from the bottom; at 1000px and wider the right inset becomes 6vw. The workbench occupies the left side with controls capped at 390px.

At 760px and narrower, the open letter centers horizontally near the bottom, fits within a 20px viewport allowance, and uses a viewport-constrained height. It overlays the workbench rather than becoming an inline form section. The closed dock remains at the bottom right. Long messages scroll inside the letter; the writing follows the active glyph. Canvas layout uses a nominal 250px writing measure.

## Elevation & Depth

The generated transparent parchment asset provides deckled paper, rolled ends, and brass detail. The open letter has a soft drop shadow, strengthened on mobile. CSS paper and rods provide a fallback when the image does not load. The rolled dock uses CSS gradients and a glowing wax seal with an inline SVG symbol.

## Shapes

The letter follows the artwork's organic silhouette. Workbench fields use 4px corners and action buttons 3px corners. The closed dock has rounded rolled ends and a circular seal. Fine brown rules divide the sender, message, and footer.

Inbox rows and message entries use fine brown separators. A small rust unread dot, numeric count, and dock text communicate unread state. Selected channel buttons use a rust bottom rule and bold text. The reply composer stays within the parchment, with a translucent light field and brown filled submit button.

## Components

**Letter renderer:** canvas progressively clips each handwritten glyph into view with eased progression. The `penPoints` helper samples glyph alpha column by column to choose the writing point's vertical position along visible letter pixels. A bright star-shaped nib, two curling wisps, a fading trail (650ms), and time-adjusted twinkling sparks strengthen the magic at that point. Fresh glyphs fade continuously from luminous color to dark ink over 1500ms of animation time. This remains a glyph-reveal simulation, not true pen-stroke reconstruction. The canvas has a separate accessible text copy.

**Private inbox:** the demo initially opens the inbox with sample threads from Elara, Rowan, and The Keeper. Threads with unread messages appear first, then sort by the last message's available numeric timestamp. Each row shows the sender, latest excerpt, time, contact description, and unread indicator. Opening a private thread marks its messages read. The newest unread incoming letter receives the canvas animation; earlier conversation history renders as static text. Reopening a read conversation shows static history rather than replaying the effect.

**Shared channels:** Party and Table talk are normal shared sample message streams with local replies. Party is labelled in character; Table talk is labelled out of character. These messages use static text rather than the private letter animation. No real party or table receives them.

**Workbench:** sender and message fields, a 600-character message limit, three ink choices, and Unhurried/Natural/Swift pace choices control the local demonstration. Simulate new Sending adds a sample incoming message to a matching sender's private thread or creates a demo contact. Ink and pace selectors configure writing without restarting the conversation.

**Incoming notification:** when tucked away, a new sample Sending updates the unread dock and shows a clickable peek for 6500ms without forcing the parchment open. The peek opens that sender's thread. A new message to the currently viewed private thread renders there; messages elsewhere leave the current conversation in place and show the peek.

**Reply composer:** Reply opens the composer for a private thread or shared channel. Drafts are retained separately while switching conversations or cancelling. Empty submission shows an inline error; a valid reply adds a local message, clears that conversation's draft, and saves history in tab-local session storage. The interface explicitly states that nothing was sent to a real player.

**Letter actions:** Sendings, Party, and Table talk switch channels; Back to inbox returns from a private thread. Reveal all completes the active animated letter immediately. Roll up and Escape tuck the parchment into the dock; Escape first closes an open composer. Folding returns focus to the dock. Closed content is inert and hidden from the accessibility tree. Controls have a visible 2px focus outline, gold on the workbench and brown inside the parchment.

**Reduced motion:** users with `prefers-reduced-motion: reduce` receive the full message immediately, without writing particles or the parchment opening transition.

## Do's and Don'ts

- **Do** preserve blank artwork and render message text separately. `parchment.png` was generated on 18 October 2026; its exact prompt and Cinzel font provenance are recorded in the asset README.
- **Do** keep skip, tuck, keyboard focus, accessible text, and reduced-motion behavior when extending this experiment.
- **Don't** describe this demo as functioning chat delivery or apply its parchment presentation to unrelated routes.

Not canonized or repaired: the small uppercase scene label and compact inbox metadata are local treatments, not a reusable eyebrow or body-text standard. Platform-dependent handwriting, simulated glyph reveal, and tab-local sample persistence remain documented prototype limitations; this documentation pass changes no implementation.

The workbench also includes **Reset sample inbox**, which restores seeded conversations and clears local reply drafts for another demonstration. It affects only this demo's tab-session data.

## Production integration

The approved concept now also has a React VTT implementation, documented in [SENDING.md](SENDING.md). That implementation uses real campaign messages and sockets; the prototype at `/sending-demo.html` remains a separate sample-only demonstration. Statements above about local sample history, no campaign API, selectable inks, and prototype layout apply to this public demo, not the production component. The production integration is present in the local installed checkout and has not been pushed or deployed.

Production canvas lettering adds bundled Caveat (`/assets/sending/caveat.ttf`) as SendingHand after Segoe Script and Lucida Handwriting, and awaits its font-loading attempt before layout. Its license is `client/public/assets/sending/CAVEAT-LICENSE.txt`. Production content uses 54px horizontal insets on desktop and 52px on mobile to clear the paper edges; these values do not replace the standalone demo's layout above.

# Sending demo assets

`parchment.png` was generated with the built-in image generator on 18 October 2026 for the local Sending prototype. It has transparency and contains no baked-in message text.

Exact generation prompt:

Production game UI asset, one single open vertical parchment scroll, straight-on orthographic front view, isolated on genuinely transparent background. Aspect ratio about 0.58 width to height. Warm pale ivory vellum, delicate realistic paper fibers and subtle age only around edges, very clean light cream center for readable text. Gently irregular organic deckled edges. Rolled paper at very top and bottom on thin aged brass rods with small refined finials. Restrained very fine brown corner line flourishes only at outer corners. Large empty blank writing area occupying 85 percent of paper. Tasteful realistic painted fantasy RPG object, sophisticated material detail. Absolutely NO text, letters, symbols in center, no writing, no wax seal, no glow, no particles, no background, no table, no perspective tilt, no other objects. Full object visible with small transparent margin all around.

`cinzel.woff2` comes from the installed `@fontsource/cinzel` package. Cinzel is licensed under the SIL Open Font License; see the accompanying font license. Handwriting uses the locally available Segoe Script or Lucida Handwriting face, with a cursive fallback.

The production VTT additionally bundles `caveat.ttf` from Google's official font repository (`https://github.com/google/fonts/tree/main/ofl/caveat`) as `SendingHand`, after Segoe Script and Lucida Handwriting. Its SIL Open Font License is included in `CAVEAT-LICENSE.txt`. Production waits for this local fallback font before laying out magical writing.

The demo is at `/sending-demo.html`. It does not send messages, alter accounts, or replace existing campaign chat. Its canvas reveals each handwritten glyph progressively, adds a glowing writing point and particles, and settles the glow to dark ink. This is a visual simulation, not font-specific pen-stroke reconstruction. Reduced-motion users receive the complete message immediately. A future production implementation should use a bundled handwriting font for consistent rendering across devices.

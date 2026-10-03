---
name: Vivid Realms Customize and Personal Gallery
description: Scoped systems for the Vault and Workshop, and the Personal Gallery.
colors:
  copper: "#efb18c"
  copper-hover: "#f4c4a7"
  copper-ink: "#271b15"
  slate-bg: "#10171e"
  slate-panel: "#151f28"
  slate-well: "#1b2732"
  slate-line: "#34424e"
  slate-input: "#141d25"
  slate-selected: "#26313a"
  slate-art: "#18222c"
  slate-tile-line: "#2d3a46"
  slate-hover-line: "#72818c"
  copper-nav-bg: "#2d2928"
  copper-nav-line: "#6d5549"
  text: "#f0eeeb"
  muted: "#b3bfc9"
  placeholder: "#a1afbb"
  profile-bg: "#151515"
  profile-bg-deep: "#10100e"
  profile-line: "#39322d"
  profile-line-soft: "#2a2421"
  profile-text: "#efe9df"
  profile-muted: "#a1978e"
  profile-quiet: "#a1978e"
  profile-accent: "#c9845d"
  profile-accent-text: "#e0a07c"
  profile-accent-fill: "#dc9a76"
  profile-accent-fill-hover: "#e8ad8c"
  profile-accent-ink: "#2a1810"
  profile-accent-wash: "rgba(201, 132, 93, 0.16)"
  profile-rose: "#c97b88"
  profile-rose-text: "#e4a0ab"
  profile-rose-fill: "#df9aa6"
  profile-rose-fill-hover: "#eab3bc"
  profile-rose-ink: "#2b1318"
  profile-rose-wash: "rgba(201, 123, 136, 0.16)"
  profile-jade: "#6fa487"
  profile-jade-text: "#96c7a9"
  profile-jade-fill: "#8fc0a2"
  profile-jade-fill-hover: "#a6d0b6"
  profile-jade-ink: "#11241a"
  profile-jade-wash: "rgba(111, 164, 135, 0.16)"
  profile-ice: "#7ea6c1"
  profile-ice-text: "#a8c9de"
  profile-ice-fill: "#9fc2d9"
  profile-ice-fill-hover: "#b6d2e4"
  profile-ice-ink: "#10202b"
  profile-ice-wash: "rgba(126, 166, 193, 0.16)"
  profile-panel: "#1c1816"
  profile-field: "#141110"
typography:
  display:
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "clamp(27px, 3vw, 40px)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "clamp(22px, 2vw, 30px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Alegreya Sans, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.22
  body:
    fontFamily: "Alegreya Sans, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Alegreya Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  profile-display:
    fontFamily: "Wittgenstein, Georgia, serif"
    fontSize: "41px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "0"
  profile-headline:
    fontFamily: "Wittgenstein, Georgia, serif"
    fontSize: "27px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0"
  profile-section:
    fontFamily: "Wittgenstein, Georgia, serif"
    fontSize: "19.5px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0"
  profile-body:
    fontFamily: "Wittgenstein, Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0"
  profile-label:
    fontFamily: "Wittgenstein, Georgia, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0"
rounded:
  tag: "3px"
  control: "5px"
  tile: "7px"
  profile-control: "3px"
  profile-panel: "4px"
spacing:
  tight: "6px"
  control: "8px"
  compact: "10px"
  small: "12px"
  grid: "14px"
  medium: "16px"
  section: "20px"
  large: "24px"
  gutter: "30px"
  profile-grid: "18px"
  profile-panel-gap: "20px"
components:
  button-primary:
    backgroundColor: "{colors.copper}"
    textColor: "{colors.copper-ink}"
    rounded: "{rounded.control}"
    padding: "8px 15px"
  button-primary-hover:
    backgroundColor: "{colors.copper-hover}"
    textColor: "{colors.copper-ink}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 15px"
  input:
    backgroundColor: "{colors.slate-input}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  category-current:
    backgroundColor: "{colors.copper-nav-bg}"
    textColor: "{colors.copper}"
    rounded: "{rounded.control}"
    padding: "12px 10px"
  equipped-tag:
    backgroundColor: "{colors.copper}"
    textColor: "{colors.copper-ink}"
    rounded: "{rounded.tag}"
    padding: "3px 7px"
  collection-tile:
    backgroundColor: "{colors.slate-panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.tile}"
    padding: "0 0 13px"
  collection-tile-selected:
    backgroundColor: "{colors.slate-selected}"
    textColor: "{colors.text}"
    rounded: "{rounded.tile}"
  profile-button-primary:
    backgroundColor: "{colors.profile-accent-fill}"
    textColor: "{colors.profile-accent-ink}"
    rounded: "{rounded.profile-control}"
    padding: "0 22px"
    height: "43px"
  profile-button-primary-hover:
    backgroundColor: "{colors.profile-accent-fill-hover}"
  profile-button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.profile-accent-text}"
    rounded: "{rounded.profile-control}"
    padding: "0 20px"
  profile-input:
    backgroundColor: "{colors.profile-field}"
    textColor: "{colors.profile-text}"
    rounded: "{rounded.profile-control}"
    padding: "8px 12px"
  profile-card:
    backgroundColor: "{colors.profile-bg-deep}"
    textColor: "{colors.profile-text}"
  profile-banner-choice:
    backgroundColor: "{colors.profile-bg}"
    textColor: "{colors.profile-text}"
    rounded: "{rounded.profile-control}"
    padding: "0 0 10px"
---

# Design System: Vivid Realms Customize and Personal Gallery

## Overview

**Creative North Star: "The Vault and Workshop"**

The Vault and Workshop place owned cosmetics on quiet slate surfaces with restrained copper controls. The collection is dense and browseable; the workshop gives the live die room beside grouped editing controls. Existing material rendering and cosmetic art supply the richness.

This system applies only to Customize. It preserves Vivid Realms’ Cinzel and Alegreya Sans pairing while replacing this route’s surrounding purple-and-gold shell with slate and copper. Other routes retain their incumbent systems.

**Key Characteristics:**

- Slate tonal layers and thin structural borders.
- Copper marks action, selection, and equipped status.
- Live cosmetic materials remain the visual subject.
- Responsive collection browsing and explicit equipment actions.

Recorded from `client/src/pages/CustomizePage.css`, `CustomizePage.tsx`, `client/src/components/CollectionDiceEditor.tsx`, `CollectionDicePreview.tsx`, and inherited typography in `client/src/styles.css`. The approved direction is in `docs/customize-redesign-brief.md`; product constraints are in `PRODUCT.md`. Review captures sampled: desktop, workshop, mobile, and mobile-detail. Source values take precedence over raster appearance.

### Personal Gallery scope

**Creative North Star: "Personal Gallery"**

The Personal Gallery places personal art and earned objects against near-black gallery walls. Warm ivory serif text, fine accent rules, and quiet controls frame the collection. Artwork supplies the richer color and texture.

This profile system applies to owner, visitor, and labelled example profiles. Tokens prefixed `profile-` describe this world; unprefixed tokens and the preceding Customize guidance retain their existing scope. The gallery uses Wittgenstein rather than Customize's Cinzel and Alegreya Sans pairing.

**Key Characteristics:**

- Square portrait and artwork frames against warm dark surfaces.
- A single selected accent family coordinates rules, controls, and focus.
- Serif names, copy, and controls share a quiet editorial voice.
- The same gallery composition serves owner, visitor, and labelled example.

Recorded from `client/src/components/ProfileGallery.css`, `ProfileGallery.tsx`, `client/src/pages/ProfilePage.tsx`, and `shared/profileGallery.ts`; direction: `docs/profile-redesign-brief.md`; product constraints: `PRODUCT.md`. Desktop example capture was sampled. Source values are normative.

## Colors

Cool slate establishes the interface; warm copper gives controls and state changes a clear point of emphasis.

### Primary

- **Copper:** primary actions, links, focus outlines, selected borders, active tabs, and equipped labels.
- **Copper hover:** brighter feedback for primary actions.
- **Copper ink:** dark text on copper fills.
- **Copper navigation background and line:** quiet warm framing for the current category.

### Neutral

- **Slate background:** full route canvas.
- **Slate panel:** inventory cards.
- **Slate well:** secondary-button hover.
- **Slate input:** search, selection fields, and color-control containers.
- **Slate selected:** final pressed-state fill for tiles, shape buttons, and saved designs.
- **Slate art:** the tile’s image well.
- **Slate line and tile line:** structural divisions and resting card outlines.
- **Slate hover line:** pointer feedback on secondary controls.
- **Text, muted, and placeholder:** primary reading, support information, and field hints.

Rarity and cosmetic colors remain contextual item data. Their wider hues are not additional interface accents.

**The Copper State Rule.** Use copper for actionable and selected states, with a separate Equipped label for equipment status.

### Personal Gallery palette

**Primary:** profile accent, accent-text, accent-fill, accent-fill-hover, accent-ink, and accent-wash form the default copper family. Rose, jade, and ice each replace the entire six-role family. Accent text is brighter than the rule color; filled controls have their own dark ink. The picker names each color and exposes pressed state.

**Neutral:** profile background and deep background separate canvas from artwork cards. Line and soft-line divide regions; ivory text carries primary reading; muted and quiet share the same support-text value. Panel and field neutrals define editing surfaces. Profile token values are listed in the frontmatter.

**The Coordinated Accent Rule.** Within Personal Gallery, switch the full accent family together so frames, text, fills, ink, and focus remain coordinated.

## Typography

**Display Font:** Cinzel with Georgia and serif fallbacks.
**Body Font:** Alegreya Sans with a sans-serif fallback.

Cinzel gives names and headings a ceremonial character; Alegreya Sans keeps collection labels and editing controls compact. The inherited global heading face also applies to workshop section headings.

### Hierarchy

- **Display:** page heading; frontmatter records the desktop clamp. It becomes 31px at the tablet breakpoint and 27px on mobile.
- **Headline:** inspector item name; mobile uses 28px.
- **Title:** bold inventory item names; mobile uses 16px.
- **Body:** page copy and normal controls. Inspector descriptions use a 1.5 line height.
- **Label:** form labels and supporting actions. Rarity and shape controls use 14px; these are supporting roles, not body replacements.

Workshop model headings use 25px, mobile 23px; the editor heading uses 24px. Labels remain sentence case. Cinzel’s small-cap letterforms are not an instruction to uppercase all interface text.

### Personal Gallery typography

Wittgenstein, with Georgia and serif fallbacks, is loaded locally in regular, medium, and regular italic. Headings use regular weight and zero tracking. Profile display is the player name; headline is the character or tab heading; section is the lower gallery heading. Body and label roles use the same serif face.

Names reduce to 36px at 1280px and 30px at 860px. Character headings reduce to 22px at 520px. Biography uses 17.5px with 1.45 line height. Pronouns use 16px; memory captions use 16.5px italic with a 64ch measure. Controls use 15-17px. Compact labels do not establish a smaller body-text standard.

## Layout

The route fills the viewport without a centered max-width container. A 74px topbar precedes a 218px category rail and flexible content. The category rail is sticky, viewport-height, and independently scrollable. The collection pairs a flexible inventory with an inspector sized at a minimum of 300px or 34% of the browser. Inventory tiles use three columns and the grid spacing token. The inspector sticks 16px from the viewport top.

The workshop narrows the category rail to 185px and uses saved designs, live model, and controls in columns of 185px / minmax(250px, 1fr) / 300px. The model area sticks 20px from the top. Thin borders divide these functional regions. Horizontal gutters use 20–30px; compact gaps use 6–12px.

- At 1650px and wider: four inventory columns; workshop columns expand to 220px / minmax(300px, 1fr) / 340px.
- At 1200px and narrower: two inventory columns, 180px category rail, 310px inspector; saved designs become a horizontal workshop strip.
- At 900px and narrower: categories become a horizontally scrolling strip above content; the equipped summary is hidden.
- At 650px and narrower: the topbar is 62px; two-column inventory and inspector become separate views. The workshop stacks saved designs, model, then controls. Model and inspector are no longer sticky.

The collection die stage is 340px tall by default, 420px on wide screens, and 300px on mobile. The workshop stage is 410px by default, 490px wide, 340px at the laptop breakpoint, and 275px mobile.

### Personal Gallery layout

A sticky 54px topbar precedes a 355px identity rail and flexible gallery. The rail has a square portrait and a vertical tab list; main content uses 18px gaps and 21px / 24px / 28px / 18px padding. The framed banner uses 1139:231; character/dice columns use 763:359 with a 17px gap. Badges and memory use 584:555 columns with a fine divider. A three-column badge list and centered memory caption preserve distinct object groups. Owners can hide sections and move badges/memory above character/dice.

The owner toolbar is fixed below the main area, 102px high; gallery padding reserves its space. Editor panels center over the main area, sit 12px above the toolbar, and scroll within a viewport-derived maximum height. Width is capped at 560px.

- At 1280px: the rail becomes 300px and controls tighten.
- At 1060px: feature and lower rows stack, the memory divider disappears, and toolbar labels hide while accessible names remain.
- At 860px: the rail becomes a top identity region with a 120px portrait, tabs scroll horizontally, main padding becomes 16px, and the toolbar becomes 72px high. Panels use viewport width minus 24px.
- At 520px: character art becomes 4:3, campaign rows wrap, and example disclosure becomes a normal-flow bar.

## Elevation & Depth

Interface depth comes from tonal layers, one-pixel borders, and the rendered object. Customize explicitly clears button shadows and selected-state glow. The live preview disables engine shadows; material shading remains part of the dice rendering.

**The Material First Rule.** Keep interface surfaces flat so live dice materials and cosmetic effects carry the depth.

### Personal Gallery depth

Flat warm-dark regions and thin borders carry gallery structure. Artwork supplies scene depth; the dice stage uses a restrained radial glow. The active desktop tab fades its accent wash horizontally, and Midnight, Ember, and Forest banners use radial gradients. These gradients are native to the shipped world.

Account menus use `0 14px 34px rgba(0, 0, 0, 0.45)`; floating editor panels use `0 22px 60px rgba(0, 0, 0, 0.55)`. Artwork headings carry a soft text shadow. These are ambient overlays, not hard offset shadows.

**The Gallery Frame Rule.** Use flat framed surfaces for gallery objects; reserve floating surface shadows for menus and editing panels.

## Shapes

Controls have gently rounded corners; tiles are slightly softer; equipped tags are compact rectangles. The frontmatter records the three radii. Category and form divisions stay straight. Inventory artwork uses an aspect ratio of 1.12. SVG category icons use rounded strokes rather than a glyph font. Avatars and token art retain circular geometry where the subject requires it.

### Personal Gallery shapes

Portraits and gallery artwork stay square-cornered. Controls use profile-control radius; menus and panels use profile-panel radius. One-pixel rules and a small outlined diamond form the recurring ornament; the diamond is CSS geometry, while functional icons are inline stroked SVG. Circular swatches communicate accent choices within the rectangular frame language.

## Components

### Buttons

Primary actions use copper fill and dark ink with weight 700. Secondary actions use transparent fill and a slate border. Normal buttons have a minimum height of 42px; mobile workshop save/equip actions use 46px. Hover changes fill and border over 160ms without translating the element. Disabled buttons use half opacity and a default cursor. Focus uses a copper outline (2px) offset by 4px.

Pressed controls use the final slate-selected fill, copper border, and primary text. Active collection tabs are the exception: transparent fill, copper text, and a bottom rule. Save/update and equip remain separate controls.

### Chips

The Equipped tag is a status label placed at the upper-left of an inventory tile, using bold 12px text and copper fill. It is not a filter chip or a generic badge system.

### Cards / Containers

A tile is an interactive button with an artwork well, bold name, and rarity below. Its selected border and pressed fill are independent of the Equipped label. Names wrap. Hover follows the ordinary control border treatment; selected state retains its copper border. Panels and inspector regions use structural dividers rather than floating-card shadows.

### Inputs / Fields

Search, selects, and design-name fields use dark slate fill, a thin line, and the control radius. They share the minimum control height. Native color inputs sit beside a hexadecimal readout. Ranges use copper and disable when a pattern is absent. Fieldsets divide Color & ink from Surface. Error messages use a distinct bordered banner with explanatory text, and are not encoded by color alone.

### Navigation

The global route navigation uses muted links and a copper bottom rule for the current route. Category navigation pairs a line icon, category name, and count on desktop. Current categories use a warm tinted fill and copper text. Small screens hide icons and counts while preserving horizontally scrollable names. Mobile item details provide an explicit Back to collection control and restore focus to the originating tile.

### Live Dice Preview

The same live renderer serves collection and workshop. Users drag or use arrow keys to rotate, pause automatic rotation, choose D4 through D20, and invoke a separate test roll. Automatic rotation is 0.24 radians per second and stops for reduced motion, pointer dragging, pause, or a hidden document. CSS transitions and animations also stop under reduced motion. Preview failure leaves selection and equipment available.

### Personal Gallery controls and editor

Primary completion actions use accent-fill and accent-ink. Outline actions use an accent border and accent-text; hover adds accent-wash. State transitions take 160ms ease. Disabled outline actions use half opacity; Done editing uses 0.6 opacity. Keyboard focus uses a 2px accent-text outline offset 3px. Reduced motion disables gallery CSS transitions and animations.

Inputs use profile-field fill, a one-pixel line, control radius, and at least 42px height. Focus changes the border to accent. Panel field groups have 12px gaps; the panel body separates groups by 20px. Panels show selected color names, explanatory labels, and save/discard state in text.

### Personal Gallery navigation and artwork

Desktop tabs use a 3px leading accent rule plus a fading wash; mobile uses a 2px bottom rule and solid wash. Top navigation uses an accent bottom border. Account actions live in an anchored menu.

Banners have a one-pixel accent frame with 4px inner padding. Built-in choices appear as a two-column grid of named previews: Lakeside Citadel uses shipped illustrative artwork; Midnight, Ember, and Forest use pure CSS. A selected preview keeps its dark fill and adds an accent border plus a 2px offset outline, without glow. The shared preset allowlist maps saved identifiers to the same renderer in picker and profile; uploads remain a separate source. These backgrounds are decorative rather than earned rewards.

Character cards carry semantic text over artwork. Real signature dice use DiceThumbnail; the labelled example uses illustrative dice art. Earned badge and cosmetic ownership remains authoritative; the example's badges and illustrations are explicitly disclosed. Empty regions explain their purpose and offer owner editing actions where applicable.

## Do's and Don'ts

### Do:

- **Do** keep selection, preview, and equipping visibly distinct.
- **Do** use the shipped cosmetic art and live dice materials.
- **Do** keep keyboard focus visible and honor reduced motion.
- **Do** scope these tokens and patterns to Customize.

### Don't:

- **Don't** replace functioning dice with concept illustrations.
- **Don't** restore the old selected-state glow on Customize controls.
- **Don't** use color alone to indicate equipped status.

Not canonized: inherited small sidebar heading treatments and 12–13px auxiliary metadata are not a reusable eyebrow or body-text standard. They are carried by the build; this documentation pass does not alter implementation.

### Personal Gallery guardrails

- **Do** keep Personal Gallery tokens scoped to profile surfaces.
- **Do** preserve named preset previews and a visible selected state.
- **Do** distinguish illustrative example content from earned objects.
- **Do** keep focus visible and honor reduced motion.
- **Don't** treat a chosen banner as an earned badge or equipment change.
- **Don't** apply Customize's flat-depth rule to the gallery's floating editor panels.

Not canonized for Personal Gallery: compact mobile badge metadata and the reused achievements manager's incumbent styling are not a general typography or component standard; they remain local implementation details, and this documentation pass does not repair them.

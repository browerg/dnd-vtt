# Customize redesign exploration

Status: concepts for user selection; no application UI changes yet.

## Confirmed scope

Customize becomes the home for all owned cosmetics. The Emporium primarily handles discovery and acquisition. Preserve dice selection, custom dice creation, and the floating interactive 3D model.

## Current problems

- A long single-column editor mixes creation, collection, effects, and backdrop controls.
- Saved dice are below the editor, trails, and experimental glass controls.
- Purchased and Cache-earned cosmetics are principally managed in the Emporium.
- The temporary Glass test section exposes implementation commentary. The More someday section describes already-shipped features as future work.
- A small die occupies a large preview region, which scrolls out of view while editing.

## Proposed behavior

- Open to owned items, with visible category navigation, search, rarity filtering, and explicit equipped markers.
- Selecting an item updates its inspector; equipping remains an explicit action.
- Dice keep a persistent floating model, rotation controls, die shape selection, and test roll. Other categories receive appropriate previews, including silent critical-effect previews.
- Create dice opens a focused editor with color/ink and surface groups, a name, save/update controls, and a distinct equip action. Preserve the five-preset limit and edit/delete behavior.
- Include dice, trails, Nat 20/Nat 1 effects, turn-start effects, token borders, profile appearance, and table backdrops. Avoid losing less-populated categories during navigation consolidation.
- Retain server ownership enforcement, loading/error states, reduced motion, and backdrop upload/device persistence. Do not treat preview as ownership or equipping.
- On narrow screens, show collection navigation above the grid; open item details in a focused view with a compact preview and reachable actions.

## Visual options

1. **The Vault:** dark slate, copper accents, category rail, wide collection grid, persistent right inspector. Best initial recommendation for browsing a growing collection.
2. **The Workshop:** graphite and vermilion, compact collection browser, large center model, right-side creation controls. Strongest for making dice; browsing has less room.
3. **The Folio:** warm ivory, dark ink, forest-green selection, horizontal categories, catalogue grid and large studio preview. Clearest departure from the current dark theme.

The user chooses the direction before implementation. Mockup inventory, counts, and rendered dice are illustrative. Actual item metadata, rarity, ownership, and dice materials come from the existing application.

## Recent push context

Reviewed the latest 15 commit summaries and changed-file history on origin/rwby-theme through cc12a84, plus relevant Customize, cosmetics, and preview code. Recent additions include token quick cards, GM map organization, shop boards, six Mythic critical effects, prior premium critical effects, Relic material/trail upgrades, and silent/faster previews. This is redesign discovery, not a security or regression audit of every commit.

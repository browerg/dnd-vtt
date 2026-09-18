# What's New in Vivid Realms

Written for players, not developers. The launcher reads this file straight from
GitHub, so anything added here shows up for everyone the next time they open it —
no new launcher download needed.

Format matters to the launcher's parser: `## ` starts a dated entry, `### ` starts
a group inside it, and `- ` is a bullet. Newest at the top.

Each entry is split into `### Major changes` and `### Minor changes`, in that
order, so anyone skimming gets the headline features first and the polish last.
Those are the only two groups an entry should have. The parser understands no
heading below `### ` — a `#### ` line is dropped silently and nobody ever sees it —
so each feature is a single bullet that opens with its name in `**bold**`, which
is the one piece of markup the launcher renders.

---

## 18 September 2026

### Major changes

- **Relic of the First Flame** — the bundle's dice are here. Obsidian, with molten
  cracks that breathe while the dice sit on the table, burn hotter as they tumble,
  and cool once they land. Embers trail behind them, and a natural 20 sets the roll
  alight. A trail or celebration you already chose still wins; the relic's own only
  fill in where you haven't picked one. Reduced motion holds the glow steady and
  skips the embers. None of it changes what you actually roll.
- **The Emporium, rebuilt** — one screen built around the newest bundle instead of
  a long scroll of grids. Everything on it is a door: click any feature on the left
  or any card along the bottom and that part of the catalogue opens over the top,
  closing with X or Escape. The Vivid Cache opens the same way. Token borders and
  chat effects are listed but marked Soon, and nothing charges you for them.
- **Sound at the table** — the sign-in page and the Emporium have music that fades
  in, loops quietly and stops when you leave. Hover the Music button for a volume
  slider; each page remembers its own level. The Emporium door opens as you walk in
  and coins change hands when you unlock something. Everything starts quiet, obeys
  the same mute as the critical roll effects, and waits for the opening video.

### Minor changes

- **A closer look before you buy** — the key art fills its frame now instead of
  sitting between empty bars, and there's a free Preview dice roll button on it.
  Anyone can watch the relic roll before unlocking it: no VCoins spent, nothing
  equipped, your own dice untouched.
- **Welcome back** — signing in greets you by name while your campaigns load
  behind the greeting, so it clears onto a page that's ready.
- **The Vivid Cache, slowed down** — the reel now runs about eleven seconds with a
  long slowdown instead of ending almost as soon as it starts, with quiet ticks
  following the cards. The sound mute silences them; reduced motion skips them.

---

## 11 September 2026

### Major changes

- **Rulers calibrated by the GM** — maps now need saved ruler distances before
  anyone can measure. The GM clicks Set ruler distances and drags on the map:
  Close, Mid and Long boundaries on Remnant maps (beyond Long is Extreme), or a
  known distance in feet on D&D maps. Distances save per map and hold steady when
  you zoom or change the grid. Existing maps need this one-time setup to replace
  the old grid-based guesses; canceling keeps whatever was saved before.
- **Ten more ways to leave your mark** — Wear It Proud, Seat at the Table, Behind
  the Screen, A Hero Is Born, The Usual Suspects, In My Own Words, True Colors,
  Dressed to Impress, Rock Bottom Has a Basement and Quest Regular, covering your
  first badge, campaign roles, owning characters, filling out your profile, three
  minimum rolls in a row and ten distinct quests. All have collectible artwork and
  unlock notifications. Existing data counts automatically; earned badges stay yours.

### Minor changes

- **Six more profile palettes** — ten looks instead of four. Joining Astral violet,
  Ember rose, Verdant gold and Moonlit tide: **Gilded amber**, **Crimson petal**,
  **Atlas steel**, **Obsidian**, **Sakura dusk** and **Dust ignition**. Pick one
  under Profile, then Personalize profile. Campaign members see it too.
- **Release notes to Discord** — the launcher can post these notes straight to your
  server. Open Discord settings, pick a date and the sections to share, preview the
  post exactly as it will appear, then send. Nothing is ever pinged.

---

## 10 September 2026

### Major changes

- **Achievements** — unlocks appear in a top-right badge notification with a short
  chime; multiple queue, and the sound can be muted. Every achievement has its own
  collectible badge, and you can display three on your Profile and swap them freely.
  Click a member's name in the campaign hub to see theirs — only chosen badges are
  shared, and other progress stays private. Seven account-wide achievements track
  your first maximum and minimum rolls, two in a row, ten overall, and your first
  completed quest. Maximum means every kept die shows its highest face and minimum
  means every kept die shows 1; modifiers and discarded dice don't count, ordinary
  rolls break streaks, and manual and blind rolls are excluded.
- **Your adventurer's record** — profiles have celestial covers, four personal
  palettes, a signature earned title and a three-badge showcase. Wear an earned
  badge as your title, browse your collection and revisit your milestones. Campaign
  members see the same showcase with your bio and pronouns.
- **Chat replies** — hover any line in the comms channel and click the reply arrow
  to send your message with a quote of theirs above it. Click the quote to jump to
  the original, which flashes so you can spot it. Replies stay in their own channel:
  In Character can't be quoted into Out of Character, and a whisper can only be
  answered by the two people in it. Escape cancels a reply while composing.
- **Ten more distinctions** — Let Fate Decide, Dice Goblin, Certified Dice Gremlin,
  Emotional Whiplash, The Comeback, Third Time's the Charm, Side Quest Enthusiast,
  The Plot Depends on Me, A Little Treat and A Whole New Persona, earned through
  roll totals, dramatic consecutive rolls, distinct quests, your first paid cosmetic
  and saving three badges. Existing first-quest credit is preserved, and further
  completions count toward 5 and 25.
- **Vibrant daylight themes** — five bright looks: **Beacon Daybreak**, **Atlas
  Skyglass**, **Mistral Bloom**, **Vacuo Sunburst** and **Aura Pop**. Built for
  bright rooms, with solid light panels, clear borders, dark text, readable map
  labels and no film grain. Find them in the theme menu; existing themes are
  unchanged.

### Minor changes

- **Faster badge artwork** — unlock notifications use small WebP thumbnails with a
  sharper version for high-density screens, and profile badges use optimized art
  instead of full-resolution originals. Less to download on a slow connection.

---

## 9 September 2026

### Major changes

- **Easier to read** — two themes built for readability: **Clear Daylight**, bright
  and high-contrast, and **High Contrast Night**, for maximum clarity without a
  bright screen. Both drop the film grain and paper texture that sat over the text
  and give buttons and inputs a much more visible outline. Pick either from the
  theme menu; they work in Remnant and D&D 5e alike.
- **View as player** — a new button on the battle map shows the GM the table exactly
  as players see it: fog at full strength, hidden objects gone, secret NPC names
  withheld and GM tools tucked away. A banner keeps you from forgetting you're in it.

### Minor changes

- **Chat sounds** — chat makes a sound when someone speaks, so you stop missing
  messages while staring at the battle map. Whispers use a brighter tone, so you
  know someone messaged you privately without looking. A bell button on the chat
  tabs mutes it, and your choice is remembered.
- **Fixed** — cleaned up garbled icons and punctuation across the interface,
  including the GM's VCoin panel and the map's ruler, draw and fog tools.

---

## 23 August 2026

### Major changes

- **Cosmetics** — unlockable **turn-start effects**, a flourish around your token
  when initiative reaches you: aura pulse, Dust ignition, frost ring, voltage surge,
  shadow bloom and a rose entrance. Unlockable **natural 20 and natural 1 effects**
  so your crits and disasters look the way you want. Plus dice trails: ember, frost,
  shadow, lightning and rose petals.
- **VCoins** — completing a quest pays the whole party. The GM can also hand coins
  out directly for whatever they think deserves it, to one player or everyone at
  once, and gets a VCoin Rewards panel on the dashboard showing recent payouts.
- **The Emporium** — the shop has a goblin merchant now, and he reacts when you
  spend. The layout was polished throughout.

### Minor changes

- **Password recovery** — a forgotten password no longer means a new account.

---

## 19–20 August 2026

### Major changes

- **Dice presets** — advanced dice customization with saveable presets, so you can
  build a dice set and switch between them.

### Minor changes

- **Playtest polish** — a pass of fixes from the group's playtest notes.

---

## 7 August 2026

### Major changes

- **Synchronized dice** — multiplayer dice animations are synced, so everyone at
  the table sees the same roll tumble at the same moment instead of each screen
  doing its own thing.

---

## 21 July 2026

### Major changes

- **GM tools** — first-time GM onboarding tour and a guide library, NPCs assignable
  to specific players rather than all-or-nothing, campaign notes with Google Docs
  and Drive links, and dashboard panel layouts saved to the server so your setup
  follows you to any computer.
- **Remnant** — the monster library is complete, Grimm artwork is preserved when you
  place a token on the map, and the character sheet has been overhauled with
  collapsible sections and an overview at the top.

### Minor changes

- **Combat** — initiative tie-breakers and a clearer turn order display.

---

## 20 July 2026

### Major changes

- **Dust and Semblance** — Dust vial rules with charge tracking and elemental
  effects on map tokens, plus Sustained Semblance upkeep controls including the
  2 Aura per round cost.

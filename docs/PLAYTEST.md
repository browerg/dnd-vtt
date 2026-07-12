# The Solo Playtest — learn your own table before game night

This is a guided tour of everything the app does, written for someone who has
never actually played a tabletop RPG. Work through it top to bottom with the
app open; each step says what to click and what you should see. Budget about
an hour. Nothing here can break anything — and you have a backup button anyway
(you'll find it in Part 2).

**The one-paragraph version of how a session works:** the DM describes the world and controls the monsters; each player controls
one character (Susy controls Skylar). When the outcome of an action is
uncertain — swinging a sword, sneaking past a guard — the player rolls dice
against a target number. Combat is taken in turns, in an order decided by an
"initiative" roll. That's genuinely it; everything else is decoration on those
two loops.

## Part 0 — Get in

1. Start the app: `npm run dev:server` and `npm run dev:client`, open
   http://localhost:5173.
2. On the login page, use the **Dev quick login** row — click **Melinda (DM)**.
   (These buttons exist only on your machine in dev mode; the hosted version
   won't have them.)
3. You land on **Your campaigns**. Open **Remnant test** — it's pre-loaded with
   Skylar (a real character from Susy's paper sheet) and a test battle map.

- [ ] Logged in without typing a password

## Part 1 — Dice (the heart of everything)

Find the **Roll dice** card on the campaign hub.

1. Click **d10** twice — the formula becomes `2d10`. Hit **Roll**. Watch the
   3D dice tumble and the result land in the **Rolls** feed on the right.
   `2d10` is *the* Remnant roll — nearly every check in your group's system is
   2d10 + an attribute die.
2. Type `2d10+1d6` and roll. That's a full Remnant check: 2d10 plus a d6
   attribute. The feed shows every individual die, so nobody can fudge.
3. Click **Edge**, roll `2d10+1d6` again. Look closely at the feed: the d6 was
   rolled **twice** and the *lower one is crossed out*. Edge = reroll your
   attribute die, keep the better. **Setback** keeps the worse. (This is
   Remnant's version of what D&D calls advantage/disadvantage.)
4. Try the **visibility** dropdown: roll one as **Only me** — it appears in
   your feed marked private. As DM you'll use **Blind (only DM)** for secret
   player rolls ("roll Perception… I won't tell you why").
5. Type a label like `Fireball damage`, then click **★** — you just saved a
   favorite chip. Click the chip to roll it instantly. Game-night gold for
   attacks you make constantly. The ✕ on the chip removes it.
6. Open **✍️ Rolled real dice at the table?** below the panel. Some players
   love their physical dice — they roll on the table, type the total here,
   and it posts to the feed marked "rolled at the table" (honor system, no
   3D animation). Try posting a 17.

- [ ] Saw a crossed-out die on an Edge roll
- [ ] Saved and rolled a favorite

## Part 2 — The campaign hub (your DM homepage)

1. Click **Edit hub**. Set an announcement ("Session 0 — testing!"), a chapter
   name, session number, and a house rule. Save. The announcement shows as a
   gold banner to everyone.
2. Click **Create invite link** — this is how friends join. Each link carries a
   role (player by default). You already used one on Garrett.
3. Note **⬇ Download campaign backup (JSON)** — that's your save-scum button.
   Click it now so you know it works. Before every real session: click it.

- [ ] Announcement banner visible
- [ ] Backup JSON downloaded

## Part 3 — The character sheet

Open **Skylar** from the Characters card.

1. Everything computes itself. Her **Aura 70 / HP 16 / Defense 16** come from
   her attribute dice and rank — the same math the paper PDF got slightly
   wrong (a selling point of your app; her paper sheet has inconsistencies).
2. **Attributes are dice, not numbers.** Skylar's Aura is a d10 — bigger die =
   better. Click **Roll 2d10+d10** under an attribute; it goes straight to the
   campaign feed.
3. **Skills**: the checked ones are Trained (adds her rank bonus). Click any
   skill to roll it. Flip the topbar toggle to **Edge** and roll again — the
   whole sheet respects the current mode.
4. **Aura is the shield.** The gold bar absorbs ALL damage until it hits 0
   ("Aura Broken" — which also locks her Semblance). HP is small and only
   drains after Aura breaks. Click the − / + buttons on both pools; watch the
   bars. Set HP to 0 to see the **Final Flare** banner (a dying character
   gets one last heroic turn), then put it back.
5. **Semblance**: her "Netrunning" panel computes the Aura cost (18) from its
   Type/Scope/Intensity/Duration — players never do that math at the table.
6. **Weapon forms**: Remnant weapons transform (fists ⇄ cannons for Skylar).
   The active form is highlighted; switching is what a Bonus Action is for.
7. **Conditions**: tick **Burning** — now open the battle map later and look
   at her token. Untick it when you're done. **Dust** tracks elemental
   ammo charges.
8. Click the **round avatar** in the topbar to upload a portrait image (the
   current gold "S" is a placeholder I generated — replace it with real art).
   The portrait becomes her face on the map.
9. Notice **Saved** in the topbar — every change autosaves; there is no save
   button to forget.

- [ ] Rolled a skill with Edge from the sheet
- [ ] Saw the Final Flare banner appear and go away
- [ ] Uploaded (or at least opened) the portrait picker

## Part 4 — Codex & chat (the between-combat stuff)

On the hub, the **Codex** card has four tabs:

1. **Quests** — add one ("Find the missing shipment"). The **hidden** toggle
   keeps a quest DM-only until you reveal it.
2. **NPCs** — add one with **secret notes**. Players literally never receive
   the secret text (it's stripped on the server, not just hidden).
3. **Journal** — shared session notes anyone can write.
4. **Handouts** — upload any image ("a mysterious letter"); it stays DM-only
   until you hit reveal.

Then the **Chat** card: **In Character** speaks *as your character*, **Out of
Character** is table talk, **Whispers** are private DMs to one person.

- [ ] Made a hidden quest and an NPC with a secret
- [ ] Sent an IC message

## Part 5 — The battle map (the main event)

Open **🗺️ Battle map**. The **Emerald Forest (test)** map is active, with
Skylar and a Beowolf already placed.

**Getting around:** drag empty space to pan, scroll to zoom, **double-click to
ping** (a gold ring everyone sees — "look HERE").

1. **Tokens.** Drag Skylar around — she snaps to the grid. Notice her two
   bars: gold = Aura, green = HP, live from her sheet. The Beowolf has a red
   **⚠2** pip — hover it: Burning, Staggered (I left those as a demo).
2. **📏 Ruler.** Toggle it, drag from Skylar to the Beowolf. The label shows
   the **range band** — Close/Mid/Long/Extreme — which is how Remnant measures
   distance (no counting squares). Everyone at the table sees your tape.
   Toggle it off (or it stays your click behavior).
3. **✏️ Draw.** Toggle it, pick an ink color, sketch a line ("the river is
   here"). **Erase** removes a stroke you click; **Clear ink** (DM) wipes all.
   Drawings persist per map and everyone sees them.
4. **Fog of war.** Tick **Fog** in the toolbar — the map goes dark(er for
   players, translucent for you). Use **Reveal** and paint the area around the
   tokens; players only ever see what you've revealed. **Reveal all** / **Hide
   all** are the bulk buttons. This is how you hide the dungeon until the
   party walks into it.
5. **Spawning monsters.** In the sidebar, search `ursa` and hit **Spawn**. It
   arrives auto-sized and numbered with its own HP bar. Search is your entire
   bestiary: 15 Remnant Grimm + 322 D&D monsters + anything custom.
6. **The stat block panel.** Click the Beowolf token. As DM you get its full
   card: Threat, Armor, Ferocity, traits, an **HP editor** (−5/−1/+1/+5), an
   **attack 2d10+1d6** button and a **dmg 1d6** button that roll into the real
   feed, and a **Conditions** list with toggle chips.

- [ ] Pinged, measured a range band, drew and erased a line
- [ ] Revealed fog around the tokens
- [ ] Spawned an Ursa and opened its stat block

## Part 6 — Run one round of combat (the full loop)

This is the exact sequence you'll run at game night. The Remnant loop: attacker
rolls **2d10 + attribute die vs the defender's Defense/DC**; on a hit, damage
comes off Aura first.

1. In the sidebar under **Initiative**, use **Add from map…** to add Skylar,
   the Beowolf, and your Ursa. Each gets a real initiative roll in the feed
   (2d10 + Finesse for characters, 2d10 + Ferocity for Grimm).
2. Hit **⚔️ Start combat**. The list sorts by initiative; the current
   combatant gets a **▶** and their token a gold ring. Rows show live HP and
   condition flags — click a row to jump to that token.
3. **Skylar's turn** (say she's first): open her sheet in another tab, click
   her attack-ish skill (e.g. Brawling with Edge if a trait grants it). Her
   Defense is 16 — for the Beowolf to hit *her*, its attack must roll ≥ 16.
4. **Beowolf's turn**: click **Next turn →**, select its token, hit **attack
   2d10+1d6**. If the total beats 16, click **dmg 1d6**, then subtract that
   from *Skylar's Aura on her sheet* (Aura absorbs everything until it breaks).
5. Beat on the Beowolf with the HP editor until 0 — kill it by removing the
   token, or keep it as a corpse. **End** wipes the initiative list.

- [ ] Ran two full turns with real rolls
- [ ] Damage flowed: attack roll → damage roll → Aura bar dropped

## Part 7 — See it as a player (the two-window trick)

Sessions are per browser profile, so:

1. Open an **incognito window** at localhost:5173 and quick-login as
   **Garrett (player)**.
2. Put the windows side by side, both on the battle map. Now watch the magic:
   - Drag a token in one window — it moves in the other, live.
   - Garrett **cannot** move Skylar (not his), can't see un-revealed fog
     (it's opaque black for him), gets no stat block panel, no fog/spawn tools.
   - Ping and draw as Garrett — players CAN do those.
   - As Melinda, roll a **Blind** roll — Garrett's feed shows nothing.
   - Whisper Garrett from chat — only he sees it.
3. This pair of windows is also your best debugging tool forever: anything
   that looks right in both windows will look right at game night.

- [ ] Watched a token move live in the second window
- [ ] Confirmed Garrett can't see through fog or move Skylar

## Part 8 — The bestiary (your monster workshop)

Open **📖 Bestiary** from the campaign topbar.

1. Browse the 15 Grimm (Threat 1 Creeps up to the Threat 5 Grimm Dragon).
   They're campaign-scoped copies — edit them freely per campaign.
2. Open **Nuckelavee** and read its traits. That's the boss-fight template.
3. Hit **+ New Grimm**, make something dumb ("Test Puppy", Threat 1, Ferocity
   d4), save, spawn it on the map, then delete it here.
4. SRD (D&D) monsters can't be edited directly — **Clone to custom** first.
5. Encounter sizing rule of thumb from the handbook: total Threat ≈ 4–6 for
   an Initiate party, 8–12 for Huntsman rank.

- [ ] Created, spawned, and deleted a custom Grimm

## When something confuses you

Write it down. Every point where *you* hesitated is a point where Susy or Nick
will hesitate at the table — that list is exactly the "fix what hurt" backlog
the roadmap plans for after game night #1. And the **Quick reference** card on
the hub answers most rules questions (DCs, conditions, Semblance costs, Final
Flare) without leaving the app.

import type { RemnantData, SemblanceEffect } from "./remnant";

/**
 * Ready-made Semblances a player can load onto their sheet. Each one is the
 * table's own write-up, entered as given — no rules are added here.
 */
export interface SemblancePreset {
  id: string;
  label: string;
  semblance: Pick<RemnantData["semblance"], "name" | "type" | "scope" | "intensity" | "duration" | "limitation" | "description" | "upgrades"> & {
    effects: SemblanceEffect[];
  };
}

const TERRA_EFFECTS: SemblanceEffect[] = [
  {
    name: "The Indecisive King", target: "Self", extraCost: 0, upkeep: 0,
    text: "Terra gains +2 to her Defense Rating against the next attack that targets her. Alternatively, Terra can gain Edge on her next attack roll against a target.",
    flavor: "The crown the King wore allowed him to see into the future, which inevitably drove him mad. When it was worn by a woman who would be his wife and Queen, she too saw a future where they were married. The crown can be simultaneously good and bad. Who knows what the future holds!",
  },
  {
    name: "The Man Who Stared at the Sun", target: "Another ally", extraCost: 0, upkeep: 0,
    text: "An ally of Terra's choice within the Mid or Close range band restores Aura equal to a roll of Terra's Aura Die times two.",
    flavor: "A popular Vacuoan tale where a man won a staring contest with the sun, inevitably going blind. Demonstrates unyielding will to give up. Also staring at the sun? PURE. Aura.",
  },
  {
    name: "The Shallow Sea / The Judgement of Faunus", target: "Self or another target", extraCost: 5, upkeep: 0,
    text: "Gains one minor Faunus trait for the next 3 minutes.",
    flavor: "Both of these tales are about the creation of Faunus. The Judgement of Faunus being the combining of humans and animals. Why not play God for a turn?",
  },
  {
    name: "The Tale of the Two Brothers", target: "Self", extraCost: 0, upkeep: 0,
    text: "Choose 1.\nLight — Create plant life, cleanse water, heal HP of an ally for one roll of Terra's Grit Die.\nDarkness — Destroy plant life, infect water, deal 2d6 damage to an enemy Grimm.",
    flavor: "Yin and Yang type shit.",
  },
  {
    name: "Silver Eyed Warrior", target: "Self or another target", extraCost: 5, upkeep: 0,
    text: "Until the start of Terra's next turn, Terra or the target gains the ability to deal double damage to any Grimm creature.",
    flavor: "Main character energy but for one turn.",
  },
  {
    name: "The Hunter's Children", target: "Up to 4 people", extraCost: 2, upkeep: 0,
    text: "Until Terra's next turn, each person deals extra damage equal to Terra's Aura Die.",
    flavor: "The Hunter had four kids, so only four people can be blessed at a time! They were stronger when they fought together. GANG UP ON THAT GUY!",
  },
  {
    name: "The Grimm Child", target: "An enemy", extraCost: 0, upkeep: 0,
    text: "The enemy makes an opposed Resolve Check against Terra (Terra also makes a Resolve Check; if hers is higher, the effect happens). If the target fails, they gain the Terrified condition. If Terra fails the check, the Aura is not expended.",
    flavor: "Actual nightmare fuel, who wouldn't be scared shitless?",
  },
  {
    name: "The Gift of the Moon", target: "Objects", extraCost: 0, upkeep: 0,
    text: "Choose an object and use basic telekinesis (throw, move, spin, repair small damages, etc).",
    flavor: "The moon is broken. No matter how many times you apologize, what's done is already done. You can change shape, but never be fully complete again.",
  },
  {
    name: "The Infinite Man", target: "Another ally", extraCost: 0, upkeep: 1,
    text: "The ally gains Edge on their next attack roll. If they hit, they deal double damage. If Terra keeps the Semblance sustained, the ally continues to gain Edge on their attacks, but the double damage only happens the first time.",
    flavor: "The moral of the story was DON'T put all your eggs in one basket, but what if I did anyways?",
  },
  {
    name: "The Two Dragon Brothers", target: "Anywhere", extraCost: 10, upkeep: 0,
    text: "Choose 1.\nGod of Light — Up to 3 allies gain +3 to their attack rolls and deal double damage to Grimm.\nGod of Darkness — Up to 3 allies gain +3 to their damage rolls and gain Edge on all attack rolls against humans and Faunus.",
    flavor: "The two brothers make a grand return but with more aura this time. Literally.",
  },
  {
    name: "The Girl in the Tower", target: "Another target within Close range", extraCost: 0, upkeep: 0,
    text: "Terra must succeed on a DC 15 Brawn Check. On a success, the target receives the Grappled condition. If Terra fails the check, the Aura is not used up.",
    flavor: "Salem is a bit of a manipulator, why couldn't we have kept that bitch in the tower?",
  },
  {
    name: "A City of Eternal Night", target: "Self and 1 other ally", extraCost: 0, upkeep: 1,
    text: "Terra and the ally become \"soulbound\". If either soulbound member takes damage, the damage is halved and both take the damage. If either becomes Aura broken, the soulbond ends.",
    flavor: "The man and the monster needed each other in order to survive. If the man died, the monster would cease to grow stronger. If the monster died, the city would collapse.",
  },
  {
    name: "The Boy Who Cried Grimm", target: "Self", extraCost: 0, upkeep: 1,
    text: "You know when someone talking to you is lying.",
    flavor: "Don't be crying wolf- I mean grimm!!! No one will believe you.",
  },
  {
    name: "The Warrior in the Woods", target: "Self", extraCost: 0, upkeep: 1,
    text: "Summon the Lady of the Woods. She takes her turn directly after Terra. Whenever Terra becomes Aura broken or stops sustaining her Semblance, the Lady of the Woods vanishes.",
    flavor: "She had a cool sounding weapon :)",
    companion: {
      name: "The Lady of the Woods",
      description: "Human woman (ghost). Takes her turn directly after Terra; vanishes when Terra is Aura broken or stops sustaining her Semblance.",
      attributes: { brawn: 6, finesse: 8, resolve: 8, wit: 6, aura: 4, grit: 6 },
      hp: 20,
      auraBase: 30,
      auraPerSummonerDie: 3,
      weapon: { name: "Billhook", range: "Close", damage: 8, special: "To hit 2d10 + d8 · 2d8 damage · can attack twice" },
    },
  },
  {
    name: "The Story of the Seasons", target: "Up to 4 team members (Team TITS / Team CCNT / Team COCK)", extraCost: 0, upkeep: 0, finalFlareOnly: true,
    text: "Assign up to 4 team members one of the four seasons (each season once).\nWinter — Target gains a bonus to their DR equal to a roll of Terra's Aura Die.\nSpring — Target gains Edge on their next attack roll; if they hit, they deal double damage.\nSummer — Target can move 1 extra range band as a free action. If they move at least 2 range bands on their turn before they attack, they deal extra damage equal to Terra's Aura Die.\nFall — Target cannot gain negative status effects this turn. If the target deals damage to a human or Faunus, they also apply the Despairing status effect (no check required).\nAt the end of the same turn Terra uses this effect, she becomes Aura broken, falls prone, and falls unconscious.",
    flavor: "Terra gives everything she has to her friends so they can keep fighting for their future. When all hope is lost, she will be the one to find their light.",
  },
];

export const SEMBLANCE_PRESETS: SemblancePreset[] = [
  {
    id: "terra",
    label: "Terra — Fairy Tale (15 effects)",
    semblance: {
      name: "Fairy Tale",
      type: "",
      scope: "Area",
      intensity: "Major",
      duration: "Instant",
      limitation: "",
      description: "When Terra activates her Semblance, she chooses one of her effects below. Some cost extra Aura, as listed on each effect. Huntress Level Up — Endurance: sustained duration costs are reduced by 1 Aura per round.",
      upgrades: ["Endurance"],
      effects: TERRA_EFFECTS,
    },
  },
];

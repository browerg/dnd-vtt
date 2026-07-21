// Remnant (RWBY TTRPG) rules: attributes as die sizes, 2d10 + attribute die,
// Aura pool as shield + Semblance fuel, small HP with the Final Flare.

import type { InventoryItem } from "./sheet";

export type RemnantAttrKey = "brawn" | "finesse" | "resolve" | "wit" | "aura" | "grit";

export const REMNANT_ATTRIBUTES: { key: RemnantAttrKey; name: string; blurb: string }[] = [
  { key: "brawn", name: "Brawn", blurb: "Physical power" },
  { key: "finesse", name: "Finesse", blurb: "Precision & speed" },
  { key: "resolve", name: "Resolve", blurb: "Willpower" },
  { key: "wit", name: "Wit", blurb: "Perception & tactics" },
  { key: "aura", name: "Aura", blurb: "Soul energy" },
  { key: "grit", name: "Grit", blurb: "Survival & HP" },
];

export const DIE_SIZES = [4, 6, 8, 10, 12] as const;

export const REMNANT_SKILLS: { key: string; name: string; attr: RemnantAttrKey }[] = [
  { key: "athletics", name: "Athletics", attr: "brawn" },
  { key: "brawling", name: "Brawling", attr: "brawn" },
  { key: "breaching", name: "Breaching", attr: "brawn" },
  { key: "intimidation", name: "Intimidation", attr: "brawn" },
  { key: "acrobatics", name: "Acrobatics", attr: "finesse" },
  { key: "stealth", name: "Stealth", attr: "finesse" },
  { key: "sleight", name: "Sleight of Hand", attr: "finesse" },
  { key: "piloting", name: "Piloting", attr: "finesse" },
  { key: "composure", name: "Composure", attr: "resolve" },
  { key: "deception", name: "Deception", attr: "resolve" },
  { key: "persuasion", name: "Persuasion", attr: "resolve" },
  { key: "survival", name: "Survival", attr: "resolve" },
  { key: "perception", name: "Perception", attr: "wit" },
  { key: "investigation", name: "Investigation", attr: "wit" },
  { key: "tactics", name: "Tactics", attr: "wit" },
  { key: "technology", name: "Technology", attr: "wit" },
  { key: "semblance-control", name: "Semblance Control", attr: "aura" },
  { key: "aura-sense", name: "Aura Sense", attr: "aura" },
  { key: "dust-channeling", name: "Dust Channeling", attr: "aura" },
  { key: "endurance", name: "Endurance", attr: "grit" },
  { key: "resistance", name: "Resistance", attr: "grit" },
  { key: "recovery", name: "Recovery", attr: "grit" },
];

export const RANKS = ["Initiate", "Huntsman", "Specialist", "Legendary Huntsman"] as const;
export type Rank = (typeof RANKS)[number];

export const RANK_TABLE: Record<Rank, { training: number; auraBonus: number; hpBonus: number }> = {
  Initiate: { training: 1, auraBonus: 5, hpBonus: 2 },
  Huntsman: { training: 2, auraBonus: 10, hpBonus: 4 },
  Specialist: { training: 3, auraBonus: 15, hpBonus: 6 },
  "Legendary Huntsman": { training: 4, auraBonus: 20, hpBonus: 8 },
};

export const AURA_BASE: Record<number, number> = { 4: 30, 6: 40, 8: 50, 10: 60, 12: 70 };
export const HP_BASE: Record<number, number> = { 4: 8, 6: 12, 8: 16, 10: 20, 12: 24 };

export const ARMOR_TYPES = [
  { key: "none", name: "None", bonus: 0 },
  { key: "light", name: "Light", bonus: 2 },
  { key: "medium", name: "Medium", bonus: 4 },
  { key: "heavy", name: "Heavy", bonus: 6 },
] as const;

export const ACADEMIES = ["Beacon", "Shade", "Haven", "Atlas"] as const;
export const ARCHETYPES = [
  "Bladesman",
  "Marksman",
  "Brawler",
  "Dust Mage",
  "Sentinel",
  "Tactician",
  "Semblance Specialist",
] as const;

export const RANGE_BANDS = ["Close", "Mid", "Long", "Extreme"] as const;

export const REMNANT_CONDITIONS = [
  "Aura Broken",
  "Burning",
  "Frozen",
  "Shocked",
  "Drenched",
  "Disoriented",
  "Disarmed",
  "Slowed",
  "Staggered",
  "Grappled",
  "Poisoned",
  "Terrified",
  "Despairing",
  "Prone",
  "Weapon Jam",
  "Downed",
  "Critically Downed",
];

export const DUST_TYPES: { key: string; name: string; note: string }[] = [
  { key: "fire", name: "Fire", note: "Burning" },
  { key: "water", name: "Water", note: "Drenched" },
  { key: "lightning", name: "Lightning", note: "Shocked" },
  { key: "wind", name: "Wind", note: "Knockback" },
  { key: "steam", name: "Steam", note: "Fire + Water" },
  { key: "gravity", name: "Gravity", note: "Fire + Lightning" },
  { key: "combustion", name: "Combustion", note: "Fire + Wind" },
  { key: "ice", name: "Ice", note: "Water + Wind" },
  { key: "rock", name: "Rock", note: "Lightning + Water" },
  { key: "hardlight", name: "Hard-Light", note: "All four primaries" },
  { key: "lava", name: "Lava", note: "Fire + Rock" },
];

export const SEMBLANCE_TYPES = [
  "Enhancement",
  "Projection",
  "Manipulation",
  "Restoration",
  "Perception",
  "Binding",
] as const;
export const SEMBLANCE_SCOPES = [
  { key: "Personal", mult: 1 },
  { key: "Single Target", mult: 1.5 },
  { key: "Area", mult: 2 },
] as const;
export const SEMBLANCE_INTENSITIES = [
  { key: "Minor", cost: 4 },
  { key: "Moderate", cost: 8 },
  { key: "Major", cost: 12 },
  { key: "Extreme", cost: 16 },
] as const;
export const SEMBLANCE_DURATIONS = [
  { key: "Instant", add: 0, note: "" },
  { key: "Short", add: 2, note: "+2" },
  { key: "Sustained", add: 0, note: "+2/rd" },
  { key: "Scene", add: 8, note: "+8" },
] as const;
export const SEMBLANCE_UPGRADES = [
  "Efficiency",
  "Reach",
  "Power",
  "Precision",
  "Endurance",
  "Resilience",
  "Awakening",
];

export interface WeaponForm {
  type: string;
  range: string;
  damage: number; // die size
  styleDie?: number; // optional extra die added to damage (0/undefined = none)
  special: string;
}

export interface RemnantData {
  system: "remnant";
  age: string;
  gender: string;
  species: string;
  hometown: string;
  academy: string;
  academyYear: string;
  teamName: string;
  teamRole: string;
  teammates: string[];
  archetype: string;
  mainAttribute: RemnantAttrKey;
  rank: Rank;
  attributes: Record<RemnantAttrKey, number>;
  trainedSkills: string[];
  armor: string;
  // current pools; maxes are computed but mirrored here so map tokens can read them
  aura: number;
  auraMax: number;
  auraColor: string;
  hp: number;
  maxHp: number;
  weaponName: string;
  weaponForms: WeaponForm[];
  activeForm: number;
  semblance: {
    name: string;
    undiscovered: boolean;
    type: string;
    scope: string;
    intensity: string;
    duration: string;
    limitation: string;
    description: string;
    upgrades: string[];
    active?: boolean;
    maintainedRounds?: number;
  };
  dust: Record<string, number>; // charges by type key
  conditions: string[];
  lien: number;
  inventory: InventoryItem[];
  equipment: string;
  bond: string;
  trait: string;
  ideal: string;
  flaw: string;
  fear: string;
  backstory: string;
  notes: string;
}

export const trainingBonus = (rank: Rank) => RANK_TABLE[rank]?.training ?? 1;

export const auraMaxFor = (d: RemnantData) =>
  (AURA_BASE[d.attributes.aura] ?? 40) +
  (RANK_TABLE[d.rank]?.auraBonus ?? 5) +
  (d.semblance.undiscovered ? 10 : 0);

export const hpMaxFor = (d: RemnantData) =>
  (HP_BASE[d.attributes.grit] ?? 12) + (RANK_TABLE[d.rank]?.hpBonus ?? 2);

export const defenseRating = (d: RemnantData) =>
  8 + d.attributes.finesse + (ARMOR_TYPES.find((a) => a.key === d.armor)?.bonus ?? 0);

export const semblanceCost = (d: RemnantData): { activation: number; note: string } => {
  const base = SEMBLANCE_INTENSITIES.find((i) => i.key === d.semblance.intensity)?.cost ?? 4;
  const mult = SEMBLANCE_SCOPES.find((s) => s.key === d.semblance.scope)?.mult ?? 1;
  const dur = SEMBLANCE_DURATIONS.find((x) => x.key === d.semblance.duration);
  const activation = Math.round(base * mult) + (dur?.add ?? 0);
  return { activation, note: dur?.key === "Sustained" ? " (+2/rd sustained)" : "" };
};

// 2d10 + attribute die (+ training bonus when trained)
export const remnantCheckFormula = (die: number, bonus = 0) =>
  bonus > 0 ? `2d10+1d${die}+${bonus}` : `2d10+1d${die}`;

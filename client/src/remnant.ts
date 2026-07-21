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

export type DustTier = "Primary" | "Combined Tier 1" | "Combined Tier 2" | "Custom";

export interface DustType {
  key: string;
  name: string;
  element: string;
  components: string;
  combatEffect: string;
  environmentalUse: string;
  condition?: string;
  tier: DustTier;
}

export interface DustVial {
  id: string;
  type: string;
  customName?: string;
  customCombatEffect?: string;
  customEnvironmentalUse?: string;
  charges: number;
}

export const DUST_VIAL_CAPACITY = 3;

export const DUST_TYPES: DustType[] = [
  { key: "fire", name: "Fire", element: "Heat / Flame", components: "Primary", combatEffect: "Burning — 1d6 damage at the start of the target's next 2 turns.", environmentalUse: "Ignite terrain, melt obstacles, fire barriers.", condition: "Burning", tier: "Primary" },
  { key: "water", name: "Water", element: "Liquid / Flow", components: "Primary", combatEffect: "Drenched — Setback on Fire resistance; chains with Lightning.", environmentalUse: "Extinguish fires, create slick terrain, push targets.", condition: "Drenched", tier: "Primary" },
  { key: "lightning", name: "Lightning", element: "Electricity", components: "Primary", combatEffect: "Shocked — Setback on the target's next attack roll.", environmentalUse: "Power machinery, chain through Drenched targets, short-circuit technology.", condition: "Shocked", tier: "Primary" },
  { key: "wind", name: "Wind", element: "Air / Force", components: "Primary", combatEffect: "Knockback — push the target one range band away.", environmentalUse: "Create updrafts, redirect projectiles, clear smoke.", tier: "Primary" },
  { key: "steam", name: "Steam", element: "Vapor", components: "Fire + Water", combatEffect: "Obscured cloud — Setback on all attacks inside for 2 turns.", environmentalUse: "Fill enclosed spaces and obscure areas.", tier: "Combined Tier 1" },
  { key: "gravity", name: "Gravity", element: "Gravity / Force", components: "Fire + Lightning", combatEffect: "Grounded or Launched — pin in place or launch one range band up.", environmentalUse: "Crush objects, redirect falling, alter trajectories.", tier: "Combined Tier 1" },
  { key: "combustion", name: "Combustion", element: "Explosive Force", components: "Fire + Wind", combatEffect: "Explosion — Fire damage die to the target and all enemies at Close range; knock them back one band.", environmentalUse: "Demolish barriers and trigger chain reactions.", tier: "Combined Tier 1" },
  { key: "ice", name: "Ice", element: "Cold / Solid", components: "Water + Wind", combatEffect: "Frozen — target loses Movement next turn; Ice terrain remains.", environmentalUse: "Create barriers, freeze water, slow pursuit.", condition: "Frozen", tier: "Combined Tier 1" },
  { key: "rock", name: "Rock", element: "Stone / Earth", components: "Lightning + Water", combatEffect: "Staggered — target cannot use a Bonus Action next turn.", environmentalUse: "Create cover, collapse terrain, block passages.", condition: "Staggered", tier: "Combined Tier 1" },
  { key: "hardlight", name: "Hard-Light", element: "Solid Light", components: "All four primaries", combatEffect: "Shield — absorb one full attack for a target, or create an environmental barrier.", environmentalUse: "Construct bridges, walls, and temporary cover.", tier: "Combined Tier 1" },
  { key: "lava", name: "Lava", element: "Molten Stone", components: "Fire + Rock", combatEffect: "Scorched — immediate Fire damage die and Lava terrain dealing Fire damage.", environmentalUse: "Destroy cover, create impassable terrain, melt fortifications.", tier: "Combined Tier 2" },
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
  dustVials?: DustVial[];
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

// vivid-functional-semblance-upgrades
export interface SemblanceCostResult {
  activation: number;
  note: string;
  upkeep: number;
  effectiveScope: string;
  effectiveIntensity: string;
  precisionEdge: boolean;
  concentrationDc: number;
  awakening: boolean;
  upgradeCounts: Record<string, number>;
}

export const semblanceUpgradeCount = (d: RemnantData, upgrade: string) =>
  d.semblance.upgrades.filter((entry) => entry === upgrade).length;

export const semblanceCost = (d: RemnantData): SemblanceCostResult => {
  const upgradeCounts = Object.fromEntries(
    SEMBLANCE_UPGRADES.map((upgrade) => [upgrade, semblanceUpgradeCount(d, upgrade)])
  ) as Record<string, number>;

  const baseIntensityIndex = Math.max(
    0,
    SEMBLANCE_INTENSITIES.findIndex((entry) => entry.key === d.semblance.intensity)
  );
  const effectiveIntensityIndex = Math.min(
    SEMBLANCE_INTENSITIES.length - 1,
    baseIntensityIndex + upgradeCounts.Power
  );
  const effectiveIntensity = SEMBLANCE_INTENSITIES[effectiveIntensityIndex];

  const baseScopeIndex = Math.max(
    0,
    SEMBLANCE_SCOPES.findIndex((entry) => entry.key === d.semblance.scope)
  );
  const effectiveScopeIndex = Math.min(
    SEMBLANCE_SCOPES.length - 1,
    baseScopeIndex + upgradeCounts.Reach
  );
  const effectiveScope = SEMBLANCE_SCOPES[effectiveScopeIndex];

  const duration = SEMBLANCE_DURATIONS.find(
    (entry) => entry.key === d.semblance.duration
  );
  const rawActivation =
    Math.round(effectiveIntensity.cost * effectiveScope.mult) +
    (duration?.add ?? 0);
  const activation = Math.max(2, rawActivation - upgradeCounts.Efficiency * 2);
  const upkeep =
    duration?.key === "Sustained"
      ? Math.max(0, 2 - upgradeCounts.Endurance)
      : 0;

  const changes = [
    effectiveIntensity.key !== d.semblance.intensity
      ? `Power → ${effectiveIntensity.key}`
      : "",
    effectiveScope.key !== d.semblance.scope
      ? `Reach → ${effectiveScope.key}`
      : "",
    upgradeCounts.Efficiency
      ? `Efficiency −${upgradeCounts.Efficiency * 2}`
      : "",
  ].filter(Boolean);

  const note =
    duration?.key === "Sustained"
      ? ` (+${upkeep}/rd sustained)${changes.length ? ` · ${changes.join(" · ")}` : ""}`
      : changes.length
        ? ` (${changes.join(" · ")})`
        : "";

  return {
    activation,
    note,
    upkeep,
    effectiveScope: effectiveScope.key,
    effectiveIntensity: effectiveIntensity.key,
    precisionEdge: upgradeCounts.Precision > 0,
    concentrationDc: upgradeCounts.Resilience > 0 ? 8 : 11,
    awakening: upgradeCounts.Awakening > 0,
    upgradeCounts,
  };
};

// 2d10 + attribute die (+ training bonus when trained)
export const remnantCheckFormula = (die: number, bonus = 0) =>
  bonus > 0 ? `2d10+1d${die}+${bonus}` : `2d10+1d${die}`;

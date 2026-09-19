import { CACHE_COST } from "./vividCacheStore.js";

export type CriticalSlot = "nat20" | "nat1";
export type CosmeticSlot = CriticalSlot | "turnStart" | "tokenBorder" | "chatFlair";
export type CriticalEffectStyle =
  | "first-flame"
  | "golden"
  | "rose"
  | "lightning"
  | "fracture"
  | "smoke"
  | "debris";

export type TurnStartEffectStyle =
  | "none"
  | "aura"
  | "ember"
  | "frost"
  | "shadow"
  | "lightning"
  | "rose";

/**
 * A themed set of cosmetics sold and shown as one thing. COSMETICS stays the
 * flat catalogue; a bundle groups some of those ids, adds the presentation
 * around them, and is what the Emporium's front page is built from.
 *
 * A feature marked "upcoming" is deliberately NOT part of what a buyer gets —
 * it is a teaser for a cosmetic type that does not exist yet, and the client
 * renders it as such. Never give an upcoming feature a cosmeticId.
 */
export type BundleIcon = "dice" | "trail" | "burst" | "fracture" | "ring" | "chat" | "crown";

export interface BundleFeature {
  title: string;
  blurb: string;
  icon: BundleIcon;
  status: "included" | "upcoming";
  /** Present only on "included" rows; must match a COSMETICS id. */
  cosmeticId?: string;
  /** Where the client sends someone who clicks the row. */
  target?: string;
}

export interface CosmeticBundle {
  id: string;
  name: string;
  kicker: string;
  quote: string;
  tagline: string;
  /** Key art. Null until the art exists; the client draws a frame instead. */
  art: string | null;
  rarity: "legendary" | "mythic";
  source: { kind: "cache"; price: number } | { kind: "shop" };
  features: BundleFeature[];
  /** Newest wins the front page. ISO date. */
  releasedAt: string;
}

export const BUNDLES: CosmeticBundle[] = [
  {
    id: "first-flame",
    name: "Relic of the First Flame",
    kicker: "Mythic Dice Set",
    quote: "Some dice do not merely roll… they remember.",
    tagline: "A cosmetic legend. A story with every roll.",
    art: "/assets/bundles/first-flame.webp",
    rarity: "mythic",
    source: { kind: "cache", price: CACHE_COST },
    releasedAt: "2026-09-11",
    features: [
      {
        title: "Animated dice model",
        blurb: "Obsidian and gold. Alive.",
        icon: "dice",
        status: "included",
        target: "/customize",
      },
      {
        title: "Exclusive trail",
        blurb: "A path of burning legacy.",
        icon: "trail",
        status: "included",
        cosmeticId: "trail-first-flame",
        target: "category:dice-trail",
      },
      {
        title: "Nat 20 animation",
        blurb: "The First Flame ignites.",
        icon: "burst",
        status: "included",
        cosmeticId: "crit20-first-flame",
        target: "category:nat20-effect",
      },
      {
        title: "Nat 1 animation",
        blurb: "Even failure burns brightly.",
        icon: "fracture",
        status: "included",
        cosmeticId: "crit1-first-flame",
        target: "category:nat1-effect",
      },
      {
        title: "Token border",
        blurb: "Carry the flame with you.",
        icon: "ring",
        status: "included",
        cosmeticId: "border-first-flame",
        target: "category:token-border",
      },
      {
        title: "Chat effect",
        blurb: "Your name leaves a mark.",
        icon: "chat",
        status: "included",
        cosmeticId: "chat-first-flame",
        target: "category:chat-flair",
      },
      {
        title: "Profile title",
        blurb: "◆ Relic Owner ◆",
        icon: "crown",
        status: "included",
        target: "/profile",
      },
    ],
  },
];

/** Newest first; the Emporium features the head of this list. */
export function bundlesNewestFirst(): CosmeticBundle[] {
  return [...BUNDLES].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
}

export const COSMETICS = [
  { id: "crit1-first-flame", type: "nat1-effect", slot: "nat1", effect: "first-flame", name: "First Flame · Ashfall", description: "The flame gutters into molten cracks and falling embers on a natural 1.", price: 1, rarity: "mythic" },
  { id: "border-first-flame", type: "token-border", slot: "tokenBorder", effect: "first-flame", name: "First Flame Border", description: "A thin molten-gold ring around your character tokens, leaving their artwork clear.", price: 1, rarity: "mythic" },
  { id: "chat-first-flame", type: "chat-flair", slot: "chatFlair", effect: "first-flame", name: "First Flame Name", description: "A quiet gold accent on your name in campaign chat.", price: 1, rarity: "mythic" },
  { id: "trail-first-flame", type: "dice-trail", effect: "first-flame", name: "First Flame Trail", description: "Cache-exclusive molten gold and fading embers.", price: 1, rarity: "mythic" },
  { id: "crit20-first-flame", type: "nat20-effect", slot: "nat20", effect: "first-flame", name: "First Flame", description: "Cache-exclusive ancient gold flare.", price: 1, rarity: "mythic" },
  {
    id: "trail-aura",
    type: "dice-trail",
    effect: "aura",
    name: "Aura Glow",
    description: "A clean ribbon of Huntsman-blue Aura energy.",
    price: 0,
    rarity: "starter",
  },
  {
    id: "trail-ember",
    type: "dice-trail",
    effect: "ember",
    name: "Ember Trail",
    description: "Fire sprites and sparks peel away from every throw.",
    price: 100,
    rarity: "uncommon",
  },
  {
    id: "trail-frost",
    type: "dice-trail",
    effect: "frost",
    name: "Frost Trail",
    description: "Cold motes and icy stars linger behind the dice.",
    price: 100,
    rarity: "uncommon",
  },
  {
    id: "trail-shadow",
    type: "dice-trail",
    effect: "shadow",
    name: "Shadow Trail",
    description: "Dark violet smoke blooms in the wake of the roll.",
    price: 100,
    rarity: "rare",
  },
  {
    id: "trail-lightning",
    type: "dice-trail",
    effect: "lightning",
    name: "Lightning Trail",
    description: "Fast electric arcs snap around the moving dice.",
    price: 100,
    rarity: "rare",
  },
  {
    id: "trail-petals",
    type: "dice-trail",
    effect: "petals",
    name: "Rose Petals",
    description: "Crimson petals scatter behind the dice as they tumble.",
    price: 100,
    rarity: "legendary",
  },

  // Natural 20 celebration effects.
  {
    id: "crit20-golden",
    type: "nat20-effect",
    slot: "nat20",
    effect: "golden",
    name: "Golden Critical",
    description: "The classic radiant critical-success fanfare.",
    price: 0,
    rarity: "starter",
  },
  {
    id: "crit20-lightning",
    type: "nat20-effect",
    slot: "nat20",
    effect: "lightning",
    name: "Lightning Strike",
    description: "A white-blue electrical surge detonates around your natural 20.",
    price: 50,
    rarity: "rare",
  },
  {
    id: "crit20-rose",
    type: "nat20-effect",
    slot: "nat20",
    effect: "rose",
    name: "Rose Burst",
    description: "A dramatic crimson-pink bloom of petals celebrates the perfect roll.",
    price: 50,
    rarity: "legendary",
  },

  // Natural 1 failure effects.
  {
    id: "crit1-fracture",
    type: "nat1-effect",
    slot: "nat1",
    effect: "fracture",
    name: "Critical Failure",
    description: "The classic red fracture-and-glitch failure screen.",
    price: 0,
    rarity: "starter",
  },
  {
    id: "crit1-smoke",
    type: "nat1-effect",
    slot: "nat1",
    effect: "smoke",
    name: "Skull & Smoke",
    description: "The table darkens under a rolling cloud of ominous violet smoke.",
    price: 50,
    rarity: "rare",
  },
  {
    id: "crit1-debris",
    type: "nat1-effect",
    slot: "nat1",
    effect: "debris",
    name: "Falling Debris",
    description: "The critical failure hits hard enough to bring the ceiling down.",
    price: 50,
    rarity: "legendary",
  },

  // Turn-start effects. These play briefly around a player-owned token when
  // initiative advances to that combatant.
  {
    id: "turn-none",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "none",
    name: "No Turn Effect",
    description: "Keep initiative transitions clean and unadorned.",
    price: 0,
    rarity: "starter",
  },
  {
    id: "turn-aura",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "aura",
    name: "Aura Pulse",
    description: "A bright Aura wave expands from your token as your turn begins.",
    price: 50,
    rarity: "uncommon",
  },
  {
    id: "turn-ember",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "ember",
    name: "Dust Ignition",
    description: "A quick burst of ember-bright Dust ignites beneath your token.",
    price: 50,
    rarity: "uncommon",
  },
  {
    id: "turn-frost",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "frost",
    name: "Frost Ring",
    description: "A crystalline frost ring flashes outward before cracking away.",
    price: 50,
    rarity: "uncommon",
  },
  {
    id: "turn-lightning",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "lightning",
    name: "Voltage Surge",
    description: "Electric arcs snap around your token the instant initiative reaches you.",
    price: 50,
    rarity: "rare",
  },
  {
    id: "turn-shadow",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "shadow",
    name: "Shadow Bloom",
    description: "Dark violet smoke blooms outward and collapses back into your token.",
    price: 50,
    rarity: "rare",
  },
  {
    id: "turn-rose",
    type: "turn-start-effect",
    slot: "turnStart",
    effect: "rose",
    name: "Rose Entrance",
    description: "A sweeping ring of crimson petals marks the beginning of your turn.",
    price: 50,
    rarity: "legendary",
  },

] as const;

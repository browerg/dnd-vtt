// 5e sheet rules: ability modifiers, skills, and the character data shape.

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export const ABILITIES: { key: AbilityKey; name: string }[] = [
  { key: "str", name: "Strength" },
  { key: "dex", name: "Dexterity" },
  { key: "con", name: "Constitution" },
  { key: "int", name: "Intelligence" },
  { key: "wis", name: "Wisdom" },
  { key: "cha", name: "Charisma" },
];

export const SKILLS: { key: string; name: string; ability: AbilityKey }[] = [
  { key: "acrobatics", name: "Acrobatics", ability: "dex" },
  { key: "animal-handling", name: "Animal Handling", ability: "wis" },
  { key: "arcana", name: "Arcana", ability: "int" },
  { key: "athletics", name: "Athletics", ability: "str" },
  { key: "deception", name: "Deception", ability: "cha" },
  { key: "history", name: "History", ability: "int" },
  { key: "insight", name: "Insight", ability: "wis" },
  { key: "intimidation", name: "Intimidation", ability: "cha" },
  { key: "investigation", name: "Investigation", ability: "int" },
  { key: "medicine", name: "Medicine", ability: "wis" },
  { key: "nature", name: "Nature", ability: "int" },
  { key: "perception", name: "Perception", ability: "wis" },
  { key: "performance", name: "Performance", ability: "cha" },
  { key: "persuasion", name: "Persuasion", ability: "cha" },
  { key: "religion", name: "Religion", ability: "int" },
  { key: "sleight-of-hand", name: "Sleight of Hand", ability: "dex" },
  { key: "stealth", name: "Stealth", ability: "dex" },
  { key: "survival", name: "Survival", ability: "wis" },
];

export const CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
];

export interface InventoryItem {
  id: string;
  name: string;
  qty: number;
  weight: number;
  equipped: boolean;
  description?: string;
  imageUrl?: string;
}

export interface SpellEntry {
  id: string;
  name: string;
  level: number; // 0 = cantrip
  notes: string;
}

export interface CharacterData {
  race: string;
  class: string;
  level: number;
  abilities: Record<AbilityKey, number>;
  profBonus: number;
  maxHp: number;
  hp: number;
  tempHp: number;
  ac: number;
  speed: number;
  hitDiceType: string;
  hitDiceRemaining: number;
  skillProfs: string[];
  saveProfs: string[];
  conditions: string[];
  exhaustion: number;
  gold: number;
  inventory: InventoryItem[];
  spellSlots: { max: number; used: number }[];
  concentratingOn: string;
  spells: SpellEntry[];
  languages: string;
  proficiencies: string;
  backstory: string;
  notes: string;
}

export interface Character {
  id: number;
  campaignId: number;
  ownerId: number;
  ownerName: string;
  name: string;
  data: CharacterData;
  portraitUrl: string;
  updatedAt: string;
  isNpc?: boolean;
  playerControllable?: boolean;
  assignedPlayerIds?: number[];
}

export interface CharacterSummary {
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
  summary: string;
  portraitUrl: string;
  hp: number;
  maxHp: number;
  isNpc?: boolean;
  playerControllable?: boolean;
  assignedPlayerIds?: number[];
}

export const abilityMod = (score: number) => Math.floor((score - 10) / 2);

export const fmtMod = (mod: number) => (mod >= 0 ? `+${mod}` : `${mod}`);

export const skillMod = (data: CharacterData, skillKey: string): number => {
  const skill = SKILLS.find((s) => s.key === skillKey)!;
  const base = abilityMod(data.abilities[skill.ability]);
  return base + (data.skillProfs.includes(skillKey) ? data.profBonus : 0);
};

export const saveMod = (data: CharacterData, ability: AbilityKey): number =>
  abilityMod(data.abilities[ability]) + (data.saveProfs.includes(ability) ? data.profBonus : 0);

// d20 + modifier as a roll formula the server understands.
export const d20Formula = (mod: number) => (mod === 0 ? "1d20" : mod > 0 ? `1d20+${mod}` : `1d20${mod}`);

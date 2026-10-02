import type { User } from "./api.js";
import { decodeDiceCustomization } from "./diceCustomization.js";
import { MYTHIC_DICE } from "../../shared/mythicDice.js";

export interface DicePreset { id: number; name: string; theme: string }
export interface CollectionItem {
  id: string; name: string; description: string; rarity: string; type: string;
  effect: string; slot?: string; owned: boolean; theme?: string; preset?: DicePreset;
}
export interface CollectionShop {
  items: CollectionItem[]; equipped: Record<string, string>; ownedDiceThemes?: string[];
  specialDice?: { theme: string; owned: boolean }[];
  previewCharacter?: { name: string; imageUrl: string } | null;
}
export const CATEGORIES = [
  { id: "dice", name: "Dice sets", description: "Your collection, ready for the next roll." },
  { id: "dice-trail", name: "Dice trails", description: "Leave your signature on every roll." },
  { id: "nat20-effect", name: "Nat 20 effects", description: "Make the perfect roll unforgettable." },
  { id: "nat1-effect", name: "Nat 1 effects", description: "Even a bad roll deserves a good entrance." },
  { id: "turn-start-effect", name: "Turn start", description: "Your moment in the initiative order." },
  { id: "token-border", name: "Token borders", description: "A finishing touch for your character." },
  { id: "profile", name: "Profile", description: "Your name, your colors, your story." },
  { id: "table", name: "Table backdrop", description: "Set the scene. Saved on this device." },
] as const;
export type Category = typeof CATEGORIES[number]["id"];
const STARTERS = [
  ["white", "Ivory"], ["black", "Obsidian"], ["radiant", "Radiant"], ["fire", "Fire"],
  ["ice", "Ice"], ["lightning", "Lightning"], ["poison", "Poison"], ["bloodmoon", "Blood Moon"],
  ["pinkdreams", "Pink Dreams"], ["astralsea", "Astral Sea"], ["glitterparty", "Glitter Party"], ["dragons", "Dragons"],
];
export function diceCollection(shop: CollectionShop | null, presets: DicePreset[], user: User | null): CollectionItem[] {
  const owned = new Set(shop?.ownedDiceThemes ?? shop?.specialDice?.filter(dice => dice.owned).map(dice => dice.theme) ?? []);
  const items: CollectionItem[] = MYTHIC_DICE.filter(dice => owned.has(dice.theme)).map(dice => ({
    id: dice.unlockId, theme: dice.theme, effect: dice.theme, name: dice.name, rarity: "mythic", type: "dice", owned: true,
    description: "An exclusive dice set earned through Vivid Cache.",
  }));
  items.push(...presets.map(preset => ({ id: `preset-${preset.id}`, theme: preset.theme, effect: preset.theme, preset,
    name: preset.name, rarity: "custom", type: "dice", owned: true, description: "Your own design. Edit it, equip it, or make something new." })));
  const current = user?.diceTheme;
  if (current && decodeDiceCustomization(current) && !presets.some(preset => preset.theme === current)) items.push({
    id: "current-custom", theme: current, effect: current, name: "Current custom dice", rarity: "custom", type: "dice", owned: true,
    description: "Your equipped design. Save it to keep a copy in your collection.",
  });
  items.push(...STARTERS.map(([theme, name]) => ({ id: `starter-${theme}`, theme, effect: theme, name, rarity: "starter", type: "dice", owned: true, description: "A classic dice set, included with your account." })));
  return items;
}

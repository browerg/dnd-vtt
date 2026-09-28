export const SPECIAL_CRITICALS = [
  { id: "crit20-void-collapse", effect: "void-collapse", name: "Void Collapse", description: "A violet singularity pulls the stars inward, then tears open around your natural 20.", rarity: "epic" as const },
  { id: "crit20-heavens-lance", effect: "heavens-lance", name: "Heaven’s Lance", description: "A celestial spear strikes through a radiant winged seal.", rarity: "epic" as const },
  { id: "crit20-chronobreak", effect: "chronobreak", name: "Chronobreak", description: "Time winds backward, holds its breath, then fractures into flying clockwork.", rarity: "epic" as const },
];
export type SpecialCriticalStyle = typeof SPECIAL_CRITICALS[number]["effect"];
export const isCacheCritical = (id: string) => SPECIAL_CRITICALS.some(effect => effect.id === id);

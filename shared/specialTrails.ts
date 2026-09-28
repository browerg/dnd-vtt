export const SPECIAL_TRAILS = [
  { id: "trail-riftwake", effect: "riftwake", name: "Riftwake", description: "Violet portals open across your path, turn inside out and pinch shut.", rarity: "legendary" as const },
  { id: "trail-astral-script", effect: "astral-script", name: "Astral Script", description: "Golden runes write themselves in the air, surrounded by rising starlight.", rarity: "legendary" as const },
  { id: "trail-prism-shatter", effect: "prism-shatter", name: "Prism Shatter", description: "Two streams of iridescent crystal fragments tumble away from every throw.", rarity: "legendary" as const },
];
export const isCacheTrail = (id: string) => SPECIAL_TRAILS.some(trail => trail.id === id);

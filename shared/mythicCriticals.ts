/** Cache-exclusive Mythic RWBY-inspired spectacles. Price is a gated sentinel. */
export const MYTHIC_CRITICALS = [
  { id: "crit20-silver-requiem", effect: "silver-requiem", name: "Silver-Eyed Requiem", description: "A crimson scythe cleaves the moon into rose petals. Silver wings awaken around your natural 20.", rarity: "mythic", price: 1 },
  { id: "crit20-winter-verdict", effect: "winter-verdict", name: "Winter’s Verdict", description: "Three summoning glyphs align. A spectral greatsword descends, breaking the frozen floor beneath your natural 20.", rarity: "mythic", price: 1 },
  { id: "crit20-emberheart", effect: "emberheart", name: "Emberheart Overdrive", description: "Twin shotgun gauntlets prime, fire and recoil. One final punch shatters an aura shield and ignites your natural 20.", rarity: "mythic", price: 1 },
] as const;
export type MythicCriticalStyle = typeof MYTHIC_CRITICALS[number]["effect"];
export const isMythicCritical = (id: string) => MYTHIC_CRITICALS.some(item => item.id === id);

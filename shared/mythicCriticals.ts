/** Cache-exclusive Mythic RWBY-inspired spectacles. Price is a gated sentinel. */
export const MYTHIC_CRITICALS = [
  { id: "crit20-silver-requiem", effect: "silver-requiem", name: "Silver-Eyed Requiem", description: "A crimson scythe cleaves the moon into rose petals. Silver wings awaken around your natural 20.", rarity: "mythic", price: 1 },
  { id: "crit20-winter-verdict", effect: "winter-verdict", name: "Winter’s Verdict", description: "Three summoning glyphs align. A spectral greatsword descends, breaking the frozen floor beneath your natural 20.", rarity: "mythic", price: 1 },
  { id: "crit20-emberheart", effect: "emberheart", name: "Emberheart Overdrive", description: "Twin shotgun gauntlets prime, fire and recoil. One final punch shatters an aura shield and ignites your natural 20.", rarity: "mythic", price: 1 },
] as const;
export const MYTHIC_FAILURES = [
  { id: "crit1-aura-break", effect: "aura-break", name: "Aura Break", description: "Three impacts overload your aura. The shield fractures, its last light drains away, and your natural 1 falls through.", rarity: "mythic", price: 1 },
  { id: "crit1-nevermore", effect: "nevermore", name: "Nevermore’s Omen", description: "A bone-masked raven eclipses your roll. Its wings close, red eyes watch, and a single pale feather marks your natural 1.", rarity: "mythic", price: 1 },
  { id: "crit1-shadow-snare", effect: "shadow-snare", name: "Shadow Snare", description: "Your shadow decoy escapes in a cloud of ink. Its weapon ribbon catches your natural 1 and pulls the knot tight.", rarity: "mythic", price: 1 },
] as const;
export type MythicCriticalStyle = typeof MYTHIC_CRITICALS[number]["effect"] | typeof MYTHIC_FAILURES[number]["effect"];
export const isMythicCritical = (id: string) => [...MYTHIC_CRITICALS, ...MYTHIC_FAILURES].some(item => item.id === id);

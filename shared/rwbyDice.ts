/** Legendary sets: shown openly in Mystery dice with free preview rolls, bought for
 * the Legendary price or won in Vivid Cache. Previews never grant ownership. */
export const RWBY_DICE_PREVIEWS = true;
export const RWBY_DICE = [
  { theme: "silver-eyed-eclipse", unlockId: "dice-silver-eyed-eclipse", name: "Silver-Eyed Eclipse", rarity: "legendary", description: "Crimson lacquer and silver scythe engravings. Petals orbit a silver awakening beneath every face." },
  { theme: "winters-reliquary", unlockId: "dice-winters-reliquary", name: "Winter’s Reliquary", rarity: "legendary", description: "Porcelain set into midnight crystal. Counter-rotating summoning glyphs awaken beneath frost-cut silver edges." },
  { theme: "emberheart-reactor", unlockId: "dice-emberheart-reactor", name: "Emberheart Reactor", rarity: "legendary", description: "Gunmetal armor around a caged amber core. Brass heat vents charge in sequence, then discharge a golden shockwave." },
] as const;
export const canPreviewRwbyDice = (theme: string) => RWBY_DICE_PREVIEWS && RWBY_DICE.some(dice => dice.theme === theme);

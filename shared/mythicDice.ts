import { RWBY_DICE } from "./rwbyDice.js";
/** Stable entitlement IDs shared by the catalogue, reward store and equip gate.
 * Every set here needs an unlock to equip; `rarity` says how it is obtained
 * (Mythic = Vivid Cache only, Legendary = Cache or bought in the Emporium). */
export const MYTHIC_DICE = [
  ...RWBY_DICE,
  { theme: "first-flame", unlockId: "dice-first-flame", name: "Relic of the First Flame", rarity: "mythic" },
  { theme: "event-horizon", unlockId: "dice-event-horizon", name: "Event Horizon", rarity: "mythic" },
  { theme: "chronos-engine", unlockId: "dice-chronos-engine", name: "Chronos Engine", rarity: "mythic" },
  { theme: "prismatic-echo", unlockId: "dice-prismatic-echo", name: "Prismatic Echo", rarity: "mythic" },
] as const;
export const mythicDiceForTheme = (theme: string) => MYTHIC_DICE.find(dice => dice.theme === theme);

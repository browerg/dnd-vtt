/** Stable entitlement IDs shared by the catalogue, reward store and equip gate. */
export const MYTHIC_DICE = [
  { theme: "first-flame", unlockId: "dice-first-flame", name: "Relic of the First Flame" },
  { theme: "event-horizon", unlockId: "dice-event-horizon", name: "Event Horizon" },
  { theme: "chronos-engine", unlockId: "dice-chronos-engine", name: "Chronos Engine" },
  { theme: "prismatic-echo", unlockId: "dice-prismatic-echo", name: "Prismatic Echo" },
] as const;
export const mythicDiceForTheme = (theme: string) => MYTHIC_DICE.find(dice => dice.theme === theme);

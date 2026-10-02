// Damage and healing for map tokens, following the Huntsman's Handbook.
//
// - Aura absorbs hits first (Ch. 5). When a hit empties it, the target is
//   Aura Broken and the rest of that hit spills into HP — the Aura Core called
//   shot is written as the exception ("no HP bleedthrough even if Aura
//   breaks"), so spill-over is the normal case. Flip AURA_OVERFLOW_TO_HP if the
//   table rules otherwise.
// - Armor (Grimm stat blocks) is flat reduction before HP loss (Ch. 12). It
//   only applies to damage that reaches HP; the GM can skip it for weak-point
//   called shots or a Tactician's Expose.
// - 5e characters lose temporary HP before HP.
// Everything situational (minimum damage, Thick Hide, Iron Will, Brace…) is
// left to the GM, who types the number that actually lands.

export const AURA_OVERFLOW_TO_HP = true;
export const AURA_BROKEN = "Aura Broken";

export interface Vitals {
  hp: number | null;
  maxHp: number | null;
  aura: number | null;
  auraMax: number | null;
  tempHp: number;
  conditions: string[];
}

export interface VitalsChange {
  next: Vitals;
  armorBlocked: number;
  toTempHp: number;
  toAura: number;
  toHp: number;
  auraBroke: boolean;
  reachedZeroHp: boolean;
}

const hasAura = (v: Vitals) => v.auraMax != null && v.auraMax > 0 && v.aura != null;
const clean = (n: unknown) => (Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : 0);
const withCondition = (list: string[], name: string) => (list.includes(name) ? list : [...list, name]);

export function applyDamage(
  current: Vitals,
  amountInput: unknown,
  options: { armor?: number; ignoreArmor?: boolean; overflowToHp?: boolean } = {}
): VitalsChange {
  const amount = clean(amountInput);
  const next: Vitals = { ...current, conditions: [...current.conditions] };
  let remaining = amount;
  let toAura = 0;
  let auraBroke = false;

  if (hasAura(next) && (next.aura as number) > 0) {
    toAura = Math.min(next.aura as number, remaining);
    next.aura = (next.aura as number) - toAura;
    remaining -= toAura;
    if (next.aura === 0) {
      auraBroke = true;
      next.conditions = withCondition(next.conditions, AURA_BROKEN);
      if (!(options.overflowToHp ?? AURA_OVERFLOW_TO_HP)) remaining = 0;
    }
  }

  const armor = options.ignoreArmor ? 0 : clean(options.armor);
  const armorBlocked = Math.min(armor, remaining);
  remaining -= armorBlocked;

  const toTempHp = Math.min(next.tempHp, remaining);
  next.tempHp -= toTempHp;
  remaining -= toTempHp;

  let toHp = 0;
  let reachedZeroHp = false;
  if (next.hp != null && remaining > 0) {
    toHp = Math.min(next.hp, remaining);
    next.hp -= toHp;
    reachedZeroHp = next.hp === 0 && toHp > 0;
  }

  return { next, armorBlocked, toTempHp, toAura, toHp, auraBroke, reachedZeroHp };
}

export function applyHeal(current: Vitals, amountInput: unknown): Vitals {
  const amount = clean(amountInput);
  if (current.hp == null) return current;
  const cap = current.maxHp ?? Number.POSITIVE_INFINITY;
  return { ...current, hp: Math.min(cap, current.hp + amount) };
}

/** Aura comes back from focus rounds, Intercept, rests… and lifts Aura Broken. */
export function restoreAura(current: Vitals, amountInput: unknown): Vitals {
  const amount = clean(amountInput);
  if (!hasAura(current)) return current;
  const aura = Math.min(current.auraMax as number, (current.aura as number) + amount);
  return {
    ...current,
    aura,
    conditions: aura > 0 ? current.conditions.filter((c) => c !== AURA_BROKEN) : current.conditions,
  };
}

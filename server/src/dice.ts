import { randomInt } from "node:crypto";

// Server-authoritative dice. Clients only ever see results — nobody can
// fake a natural 20 from the browser console.

export interface DieGroup {
  count: number;
  sides: number;
  results: number[];
  // Edge/Setback (Remnant): the per-die discarded rolls for the affected group.
  droppedResults?: number[];
}

export interface RollResult {
  groups: DieGroup[];
  modifier: number;
  total: number;
}

export interface RollDetail {
  mode: "normal" | "advantage" | "disadvantage" | "edge" | "setback";
  kept: RollResult;
  dropped?: RollResult; // the other roll when advantage/disadvantage
  manual?: boolean; // physical dice at the table — total entered by hand
  // Set by the server when the roll is made: which critical cosmetic (if
  // any) it earns under the campaign's system. Absent on older rolls.
  critical?: CriticalKind | null;
}

export type CriticalKind = "nat20" | "nat1";

/**
 * Which critical cosmetic a roll earns. D&D: a d20 showing 20 or 1.
 * Remnant has no natural crits in its rules (a critical hit is beating
 * Defense by 8+), so for the cosmetics its core 2d10 stands in: double 10s
 * (which shows 20) or double 1s, whatever the attribute die rolled.
 */
export function criticalOf(detail: RollDetail, system: string): CriticalKind | null {
  if (detail.manual) return null;
  const { groups } = detail.kept;
  if (system === "remnant") {
    const core = groups.find((g) => g.sides === 10 && g.count === 2);
    if (!core) return null;
    if (core.results.every((face) => face === 10)) return "nat20";
    if (core.results.every((face) => face === 1)) return "nat1";
    return null;
  }
  const d20 = groups.filter((g) => g.sides === 20).flatMap((g) => g.results);
  if (d20.includes(20)) return "nat20";
  if (d20.includes(1)) return "nat1";
  return null;
}

const MAX_DICE = 100;
const MAX_SIDES = 1000;

interface ParsedFormula {
  groups: { count: number; sides: number }[];
  modifier: number;
}

export function parseFormula(formula: string): ParsedFormula {
  const cleaned = formula.toLowerCase().replace(/\s+/g, "");
  if (!cleaned) throw new DiceError("Enter a roll, like 2d6+4.");
  // Split into signed terms: 2d6, +4, -1d4 …
  const terms = cleaned.match(/[+-]?[^+-]+/g) ?? [];
  const groups: { count: number; sides: number }[] = [];
  let modifier = 0;
  let totalDice = 0;

  for (const term of terms) {
    const sign = term.startsWith("-") ? -1 : 1;
    const body = term.replace(/^[+-]/, "");
    const dieMatch = body.match(/^(\d*)d(\d+)$/);
    if (dieMatch) {
      if (sign < 0) throw new DiceError("Subtracting dice isn't supported — subtract a number instead.");
      const count = dieMatch[1] ? parseInt(dieMatch[1], 10) : 1;
      const sides = parseInt(dieMatch[2], 10);
      if (count < 1 || sides < 2) throw new DiceError(`"${body}" isn't a valid die.`);
      totalDice += count;
      if (totalDice > MAX_DICE) throw new DiceError(`That's too many dice (max ${MAX_DICE}).`);
      if (sides > MAX_SIDES) throw new DiceError(`Dice can have at most ${MAX_SIDES} sides.`);
      groups.push({ count, sides });
    } else if (/^\d+$/.test(body)) {
      modifier += sign * parseInt(body, 10);
    } else {
      throw new DiceError(`Couldn't read "${body}" — try something like 2d6+4.`);
    }
  }
  if (groups.length === 0) throw new DiceError("A roll needs at least one die, like 1d20.");
  return { groups, modifier };
}

function rollOnce(parsed: ParsedFormula): RollResult {
  const groups: DieGroup[] = parsed.groups.map((g) => ({
    count: g.count,
    sides: g.sides,
    results: Array.from({ length: g.count }, () => randomInt(1, g.sides + 1)),
  }));
  const total =
    groups.reduce((sum, g) => sum + g.results.reduce((a, b) => a + b, 0), 0) + parsed.modifier;
  return { groups, modifier: parsed.modifier, total };
}

export function roll(formula: string, mode: RollDetail["mode"]): RollDetail {
  const parsed = parseFormula(formula);
  const first = rollOnce(parsed);
  if (mode === "normal") return { mode, kept: first };

  // Remnant's Edge/Setback: only the final die group (the attribute die) is
  // rolled twice per die, keep higher/lower — the 2d10 bell curve stays intact.
  if (mode === "edge" || mode === "setback") {
    const last = first.groups[first.groups.length - 1];
    const keepHigher = mode === "edge";
    const dropped: number[] = [];
    last.results = last.results.map((r) => {
      const other = randomInt(1, last.sides + 1);
      const keep = keepHigher ? Math.max(r, other) : Math.min(r, other);
      dropped.push(keep === r ? other : r);
      return keep;
    });
    last.droppedResults = dropped;
    first.total =
      first.groups.reduce((sum, g) => sum + g.results.reduce((a, b) => a + b, 0), 0) +
      first.modifier;
    return { mode, kept: first };
  }

  const second = rollOnce(parsed);
  const keepHigher = mode === "advantage";
  const [kept, dropped] =
    (first.total >= second.total) === keepHigher ? [first, second] : [second, first];
  return { mode, kept, dropped };
}

export class DiceError extends Error {}

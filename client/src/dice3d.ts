import DiceBox from "@3d-dice/dice-box-threejs";
import type { RollDetail } from "./api";

// 3D dice are pure theater: the server already decided the results, and the
// notation's "@" suffix forces the dice to land on exactly those faces.

const SUPPORTED_SIDES = new Set([2, 4, 6, 8, 10, 12, 20, 100]);
const MAX_ANIMATED_DICE = 20;
const LINGER_MS = 1800;
const CRITICAL_EVENT = "tabletop:critical-roll";

type CriticalRollKind = "nat20" | "nat1";

interface RollAnimationMeta {
  userName?: string;
  label?: string;
}

interface QueueEntry {
  notation: string;
  theme: string;
  critical: CriticalRollKind | null;
  meta: RollAnimationMeta;
  onLanded: () => void;
}

let box: DiceBox | null = null;
let ready: Promise<void> | null = null;
let running = false;
let currentTheme = "white";
const queue: QueueEntry[] = [];

function ensureBox(): Promise<void> {
  if (!ready) {
    box = new DiceBox("#dice-overlay", {
      assetPath: "/assets/dice/",
      sounds: true,
      volume: 60,
      theme_surface: "green-felt",
      theme_colorset: "white",
      theme_material: "plastic",
      shadows: true,
      light_intensity: 0.9,
      gravity_multiplier: 400,
      baseScale: 100,
    });
    ready = box.initialize();
  }
  return ready;
}

export function notationFor(detail: RollDetail): string | null {
  const { groups } = detail.kept;
  if (groups.some((group) => !SUPPORTED_SIDES.has(group.sides))) return null;
  // A d100 renders as a percentile pair (tens die + units die), so it costs two dice.
  const diceCount = groups.reduce(
    (count, group) => count + group.count * (group.sides === 100 ? 2 : 1),
    0
  );
  if (diceCount === 0 || diceCount > MAX_ANIMATED_DICE) return null;

  // The library applies forced values to dice in spawn order and silently
  // ignores values that aren't a legal face (a d100 tens die only has faces
  // 10..90 and 00). It also merges same-type notation sets, which would
  // scramble value order -- so emit exactly one set per die type ourselves.
  const faces = new Map<number, number[]>();
  const push = (sides: number, value: number) => {
    if (!faces.has(sides)) faces.set(sides, []);
    faces.get(sides)!.push(value);
  };

  for (const group of groups) {
    for (const result of group.results) {
      if (group.sides === 100) {
        const units = result % 10;
        push(100, result - units);
        push(10, units);
      } else {
        push(group.sides, result);
      }
    }
  }

  const sets = [...faces.entries()]
    .map(([sides, values]) => `${values.length}d${sides}`)
    .join("+");
  const forced = [...faces.values()].flat().join(",");
  return `${sets}@${forced}`;
}

function criticalFor(detail: RollDetail): CriticalRollKind | null {
  if (detail.manual) return null;

  const d20Results = detail.kept.groups
    .filter((group) => group.sides === 20)
    .flatMap((group) => group.results);

  if (d20Results.includes(20)) return "nat20";
  if (d20Results.includes(1)) return "nat1";
  return null;
}

function announceCritical(entry: QueueEntry) {
  if (!entry.critical) return;
  window.dispatchEvent(
    new CustomEvent(CRITICAL_EVENT, {
      detail: {
        kind: entry.critical,
        userName: entry.meta.userName,
        label: entry.meta.label,
      },
    })
  );
}

// Resolves once this roll's dice have landed and stand still (callers hold
// the feed entry back until then). Resolves immediately when the roll won't
// animate -- hidden tab, unsupported dice, or a busy table.
// `theme` is the roller's colorset, so everyone sees Susy roll HER dice.
export function animateRoll(
  detail: RollDetail,
  theme?: string,
  meta: RollAnimationMeta = {}
): Promise<void> {
  if (document.hidden) return Promise.resolve();

  const notation = notationFor(detail);
  if (!notation) return Promise.resolve();

  const entry: QueueEntry = {
    notation,
    theme: theme || "white",
    critical: criticalFor(detail),
    meta,
    onLanded: () => {},
  };

  if (queue.length >= 3) {
    announceCritical(entry);
    return Promise.resolve();
  }

  return new Promise((onLanded) => {
    queue.push({ ...entry, onLanded });
    if (!running) void drain();
  });
}

// Customize page: throw a themed set with random results, just to look at.
export function previewDice(theme: string): Promise<void> {
  if (document.hidden) return Promise.resolve();
  if (queue.length >= 3) return Promise.resolve();

  return new Promise((onLanded) => {
    queue.push({
      notation: "2d10+1d6",
      theme: theme || "white",
      critical: null,
      meta: {},
      onLanded,
    });
    if (!running) void drain();
  });
}

async function drain(): Promise<void> {
  running = true;
  try {
    await ensureBox();
    let entry: QueueEntry | undefined;

    while ((entry = queue.shift())) {
      try {
        if (entry.theme !== currentTheme) {
          await box!.updateConfig({ theme_colorset: entry.theme });
          currentTheme = entry.theme;
        }

        // If the tab loses visibility mid-roll the physics stalls; don't let
        // one stuck animation wedge the queue forever.
        await Promise.race([
          box!.roll(entry.notation),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("animation timeout")), 15000)
          ),
        ]);

        announceCritical(entry);
        entry.onLanded();
        await new Promise((resolve) => setTimeout(resolve, LINGER_MS));
      } catch (error) {
        console.error("dice animation failed", error);
        announceCritical(entry);
        entry.onLanded();
      }

      box!.clearDice();
    }
  } finally {
    running = false;
  }
}

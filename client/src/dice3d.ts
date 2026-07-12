import DiceBox from "@3d-dice/dice-box-threejs";
import type { RollDetail } from "./api";

// 3D dice are pure theater: the server already decided the results, and the
// notation's "@" suffix forces the dice to land on exactly those faces.

const SUPPORTED_SIDES = new Set([2, 4, 6, 8, 10, 12, 20, 100]);
const MAX_ANIMATED_DICE = 20;
const LINGER_MS = 1800;

let box: DiceBox | null = null;
let ready: Promise<void> | null = null;
let running = false;
let currentTheme = "white";
const queue: { notation: string; theme: string; onLanded: () => void }[] = [];

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
  if (groups.some((g) => !SUPPORTED_SIDES.has(g.sides))) return null;
  // A d100 renders as a percentile pair (tens die + units die), so it costs two dice.
  const diceCount = groups.reduce((n, g) => n + g.count * (g.sides === 100 ? 2 : 1), 0);
  if (diceCount === 0 || diceCount > MAX_ANIMATED_DICE) return null;

  // The library applies forced values to dice in spawn order and silently
  // ignores values that aren't a legal face (a d100 tens die only has faces
  // 10..90 and 00). It also merges same-type notation sets, which would
  // scramble value order — so emit exactly one set per die type ourselves.
  const faces = new Map<number, number[]>();
  const push = (sides: number, value: number) => {
    if (!faces.has(sides)) faces.set(sides, []);
    faces.get(sides)!.push(value);
  };
  for (const g of groups) {
    for (const r of g.results) {
      if (g.sides === 100) {
        const units = r % 10;
        push(100, r - units); // 0 and 100 both map to the "00" face
        push(10, units); // 0 maps to the "0" face
      } else {
        push(g.sides, r);
      }
    }
  }
  const sets = [...faces.entries()].map(([sides, vals]) => `${vals.length}d${sides}`).join("+");
  const forced = [...faces.values()].flat().join(",");
  return `${sets}@${forced}`;
}

// Resolves once this roll's dice have landed and stand still (callers hold
// the feed entry back until then). Resolves immediately when the roll won't
// animate — hidden tab, unsupported dice, or a busy table.
// `theme` is the roller's colorset, so everyone sees Susy roll HER dice.
export function animateRoll(detail: RollDetail, theme?: string): Promise<void> {
  // Hidden tabs get no animation frames, so the physics would stall forever.
  if (document.hidden) return Promise.resolve();
  const notation = notationFor(detail);
  if (!notation) return Promise.resolve();
  if (queue.length >= 3) return Promise.resolve(); // table's busy
  return new Promise((onLanded) => {
    queue.push({ notation, theme: theme || "white", onLanded });
    if (!running) void drain();
  });
}

// Customize page: throw a themed set with random results, just to look at.
export function previewDice(theme: string): Promise<void> {
  if (document.hidden) return Promise.resolve();
  if (queue.length >= 3) return Promise.resolve();
  return new Promise((onLanded) => {
    queue.push({ notation: "2d10+1d6", theme: theme || "white", onLanded });
    if (!running) void drain();
  });
}

async function drain(): Promise<void> {
  running = true;
  try {
    await ensureBox();
    let entry: (typeof queue)[number] | undefined;
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
          new Promise((_, reject) => setTimeout(() => reject(new Error("animation timeout")), 15000)),
        ]);
        entry.onLanded();
        await new Promise((r) => setTimeout(r, LINGER_MS));
      } catch (e) {
        console.error("dice animation failed", e);
        entry.onLanded();
      }
      box!.clearDice();
    }
  } finally {
    running = false;
  }
}

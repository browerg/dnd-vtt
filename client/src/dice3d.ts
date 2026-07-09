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
const queue: string[] = [];

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
  const diceCount = groups.reduce((n, g) => n + g.count, 0);
  if (diceCount === 0 || diceCount > MAX_ANIMATED_DICE) return null;
  const sets = groups.map((g) => `${g.count}d${g.sides}`).join("+");
  const values = groups.flatMap((g) => g.results).join(",");
  return `${sets}@${values}`;
}

export function animateRoll(detail: RollDetail): void {
  // Hidden tabs get no animation frames, so the physics would stall forever.
  // The feed already has the result; skip the theater.
  if (document.hidden) return;
  const notation = notationFor(detail);
  if (!notation) return;
  if (queue.length >= 3) return; // table's busy — feed still shows everything
  queue.push(notation);
  if (!running) void drain();
}

async function drain(): Promise<void> {
  running = true;
  try {
    await ensureBox();
    let notation: string | undefined;
    while ((notation = queue.shift())) {
      try {
        // If the tab loses visibility mid-roll the physics stalls; don't let
        // one stuck animation wedge the queue forever.
        await Promise.race([
          box!.roll(notation),
          new Promise((_, reject) => setTimeout(() => reject(new Error("animation timeout")), 15000)),
        ]);
        await new Promise((r) => setTimeout(r, LINGER_MS));
      } catch (e) {
        console.error("dice animation failed", e);
      }
      box!.clearDice();
    }
  } finally {
    running = false;
  }
}

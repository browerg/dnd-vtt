// Cosmetic presentation only. The winner is already committed by the server.
export const CACHE_WINNER_INDEX = 58;
export const CACHE_SPIN_DURATION_MS = 11000;
export function buildCacheReel<T extends { weight: number }>(pool: T[], winner: T, random = Math.random): T[] {
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  if (!pool.length || total <= 0) throw new Error("Empty cache pool");
  return Array.from({ length: CACHE_WINNER_INDEX + 7 }, (_, index) => {
    if (index === CACHE_WINNER_INDEX) return winner;
    let ticket = random() * total;
    return pool.find(item => (ticket -= item.weight) < 0) ?? pool[pool.length - 1];
  });
}

/**
 * The spin's motion, as one curve.
 *
 * The strip used to be a single CSS ease with the tick sounds driven off the
 * animation's own progress. That coupled them only as long as the effect-level
 * easing stayed the timing function, which a wind-up or a settle would break.
 * Sampling one function here instead gives the strip its keyframes and the
 * ticks their timestamps from the same numbers, so they cannot drift apart.
 *
 * Shape: a short pull back against the launch, a hard decelerating run, and a
 * drift a quarter-tile past the winner that eases back onto it.
 */
export const CACHE_SPIN_SAMPLES = 160;
const WINDUP_FRACTION = 0.035;
const WINDUP_TILES = 0.55;
const OVERSHOOT_TILES = 0.25;
const DECAY = 3.4;

/** Tile index under the pointer at `t`, where t is 0..1 of the spin. */
export function spinPosition(t: number, winnerIndex = CACHE_WINNER_INDEX, start = 2): number {
  if (t <= 0) return start;
  if (t >= 1) return winnerIndex;
  if (t < WINDUP_FRACTION) return start - WINDUP_TILES * Math.sin((t / WINDUP_FRACTION) * Math.PI);
  const u = (t - WINDUP_FRACTION) / (1 - WINDUP_FRACTION);
  const eased = 1 - Math.pow(1 - u, DECAY);
  return start + (winnerIndex - start) * eased + OVERSHOOT_TILES * Math.sin(Math.PI * Math.pow(u, 6));
}

export interface SpinPath {
  /** Tile indices to hand the animation as evenly spaced keyframes. */
  positions: number[];
  /** Milliseconds from the start at which a tile crosses the pointer. */
  tickTimes: number[];
  /** Milliseconds at which the strip drops below `slowTiles` remaining. */
  settleAt: number;
}

export function buildSpinPath(
  duration = CACHE_SPIN_DURATION_MS,
  winnerIndex = CACHE_WINNER_INDEX,
  samples = CACHE_SPIN_SAMPLES,
  slowTiles = 5,
): SpinPath {
  const positions: number[] = [];
  const tickTimes: number[] = [];
  let settleAt = duration;
  let crossed = Math.floor(spinPosition(0, winnerIndex));
  let settled = false;

  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const index = spinPosition(t, winnerIndex);
    positions.push(index);
    // One tick per tile boundary the strip passes, so they thin out as it slows.
    while (crossed < Math.floor(index)) {
      crossed++;
      tickTimes.push(t * duration);
    }
    if (!settled && winnerIndex - index <= slowTiles) {
      settleAt = t * duration;
      settled = true;
    }
  }
  return { positions, tickTimes, settleAt };
}

// Cosmetic presentation only. The winner is already committed by the server.
export const CACHE_WINNER_INDEX = 58;
export const CACHE_SPIN_DURATION_MS = 11000;
export const CACHE_SHOWCASE_SLOTS = [12, 28, 42, 51];
export function buildCacheReel<T extends { weight: number; rarity?: string }>(pool: T[], winner: T, random = Math.random): T[] {
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  if (!pool.length || total <= 0) throw new Error("Empty cache pool");
  const reel = Array.from({ length: CACHE_WINNER_INDEX + 7 }, (_, index) => {
    if (index === CACHE_WINNER_INDEX) return winner;
    let ticket = random() * total;
    return pool.find(item => (ticket -= item.weight) < 0) ?? pool[pool.length - 1];
  });
  // Everything below is theatre. The winner at CACHE_WINNER_INDEX was chosen
  // by the server before this runs, and none of it touches that slot.
  //
  // Mythics are shown passing the pointer throughout the run, slowest last.
  const mythics = pool.filter(item => item.rarity === "mythic");
  for (let i = mythics.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [mythics[i], mythics[j]] = [mythics[j], mythics[i]];
  }
  if (mythics.length) CACHE_SHOWCASE_SLOTS.forEach((slot, i) => { reel[slot] = mythics[i % mythics.length]; });
  const highlights = pool.filter(item => item.rarity === "epic" || item.rarity === "legendary");
  if (highlights.length) for (const slot of [7, 21, 36, 47, 54]) reel[slot] = highlights[Math.floor(random() * highlights.length)];
  // About half the time, something big sits right beside the winner: one
  // tile before it crawls under the pointer during the final approach, or
  // one tile after it is where the reel stops just short. That near miss is
  // the moment the whole spin exists for. Skipped when the win is a mythic.
  const big = pool.filter(item => item.rarity === "mythic" || item.rarity === "legendary");
  if (winner.rarity !== "mythic" && big.length && random() < 0.55) {
    const slot = random() < 0.5 ? CACHE_WINNER_INDEX - 1 : CACHE_WINNER_INDEX + 1;
    reel[slot] = big[Math.floor(random() * big.length)];
  }
  return reel;
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
export const CACHE_SPIN_SAMPLES = 240;

/** Tile index under the pointer at `t`, where t is 0..1 of the spin. */
export function spinPosition(t: number, winnerIndex = CACHE_WINNER_INDEX, start = 2): number {
  if (t <= 0) return start;
  if (t >= 1) return winnerIndex;
  // Matching Hermite velocities connect the spring, launch, run and final brake.
  const distance = winnerIndex - start;
  const knots = [[0, 0, 0], [.045, -.65, 0], [.16, distance * .16, 100],
    [.45, distance * .70, 70], [.75, distance - 3, 18], [.94, distance + .08, 0], [1, distance, 0]];
  const index = knots.findIndex(knot => knot[0] >= t);
  const [a, x, speedA] = knots[index - 1];
  const [b, y, speedB] = knots[index];
  const u = (t - a) / (b - a);
  return start + (2 * u ** 3 - 3 * u ** 2 + 1) * x
    + (u ** 3 - 2 * u ** 2 + u) * (b - a) * speedA
    + (-2 * u ** 3 + 3 * u ** 2) * y + (u ** 3 - u ** 2) * (b - a) * speedB;
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

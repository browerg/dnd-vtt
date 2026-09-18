// Cosmetic presentation only. The winner is already committed by the server.
export const CACHE_WINNER_INDEX = 32;
export function buildCacheReel<T extends { weight: number }>(pool: T[], winner: T, random = Math.random): T[] {
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  if (!pool.length || total <= 0) throw new Error("Empty cache pool");
  return Array.from({ length: 39 }, (_, index) => {
    if (index === CACHE_WINNER_INDEX) return winner;
    let ticket = random() * total;
    return pool.find(item => (ticket -= item.weight) < 0) ?? pool[pool.length - 1];
  });
}

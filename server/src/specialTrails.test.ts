import assert from "node:assert/strict";
import { test } from "node:test";
import { createSpecialTrail, isSpecialTrail } from "../../client/src/specialTrails.js";
import { SPECIAL_TRAILS, isCacheTrail } from "../../shared/specialTrails.js";
import { CACHE_REWARDS } from "./vividCacheStore.js";
import { COSMETICS, equipAllowed, isCacheExclusive } from "./shopCatalog.js";

function recordingContext() {
  let depth = 0, saves = 0;
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, name) => name === "save" ? () => { depth++; saves++; }
      : name === "restore" ? () => { depth--; assert.ok(depth >= 0); }
      : () => {},
    set: () => true,
  });
  return { context, depth: () => depth, saves: () => saves };
}

test("special trails have matching renderers, shop entitlements and Legendary rewards", () => {
  for (const trail of SPECIAL_TRAILS) {
    assert.ok(isSpecialTrail(trail.effect)); assert.ok(isCacheTrail(trail.id));
    assert.ok(COSMETICS.some(item => item.id === trail.id && item.effect === trail.effect));
    const reward = CACHE_REWARDS.find(item => item.id === trail.effect)!;
    assert.equal(reward.rarity, "legendary"); assert.equal(reward.weight, 315);
    assert.deepEqual(reward.unlockIds, [trail.id]);
  }
  assert.equal(isSpecialTrail("ember"), false);
  assert.equal(isCacheTrail("trail-ember"), false);
});

test("trail particles expire, clean their canvas state and stop after disposal", () => {
  for (const style of ["riftwake", "astral-script", "prism-shatter", "first-flame"] as const) {
    const trail = createSpecialTrail(style);
    const { context, depth } = recordingContext();
    const die = {};
    assert.equal(trail.draw(context, 0), false);
    trail.sample(die, { x: 20, y: 50 }, 0);
    trail.sample(die, { x: 80, y: 70 }, 50);
    assert.equal(trail.draw(context, 300), true); assert.equal(depth(), 0);
    assert.equal(trail.draw(context, 1200), false);
    trail.sample(die, { x: 200, y: 100 }, 1300); trail.clear();
    assert.equal(trail.draw(context, 1400), false);
  }
});

test("stationary dice do not accumulate effects, and fast rolls have a bounded particle budget", () => {
  const trail = createSpecialTrail("riftwake"), die = {};
  for (let i = 0; i < 1000; i++) trail.sample(die, { x: 10, y: 10 }, 0);
  const quiet = recordingContext(); trail.draw(quiet.context, 200);
  assert.equal(quiet.saves(), 1);
  for (let i = 0; i < 1000; i++) trail.sample(die, { x: i * 50, y: 10 }, 0);
  const fast = recordingContext(); trail.draw(fast.context, 200);
  assert.equal(fast.saves(), 96);
});
test("cache-only cosmetics can't be equipped through the GM bypass, only won", () => {
  const byId = (id: string) => COSMETICS.find(item => item.id === id)!;
  for (const id of ["trail-riftwake", "crit20-void-collapse", "crit1-first-flame"]) {
    const item = byId(id);
    assert.ok(item, id);
    assert.equal(isCacheExclusive(item), true, id);
    assert.equal(equipAllowed(item, true, false), false, `${id}: bypass alone must not unlock it`);
    assert.equal(equipAllowed(item, false, true), true, `${id}: winning it does`);
  }
  // Ordinary Emporium cosmetics keep the GM bypass.
  const ordinary = COSMETICS.find(item => item.type === "nat20-effect" && !isCacheExclusive(item) && item.price > 0)!;
  assert.equal(equipAllowed(ordinary, true, false), true);
  assert.equal(equipAllowed(ordinary, false, false), false);
});

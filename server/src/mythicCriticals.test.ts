import { test } from "node:test";
import assert from "node:assert/strict";
import { MYTHIC_CRITICALS } from "../../shared/mythicCriticals.js";
import { COSMETICS, equipAllowed, isCacheExclusive } from "./shopCatalog.js";
import { CACHE_REWARDS } from "./vividCacheStore.js";

test("Mythic spectacles require a Cache win even with GM bypass", () => {
  for (const effect of MYTHIC_CRITICALS) {
    const item = COSMETICS.find(item => item.id === effect.id)!;
    assert.ok(item);
    assert.equal(item.rarity, "mythic");
    assert.equal(item.type, "nat20-effect");
    assert.ok(item.price > 0);
    assert.equal(isCacheExclusive(item), true);
    assert.equal(equipAllowed(item, false, false), false);
    assert.equal(equipAllowed(item, false, true), true);
    assert.equal(equipAllowed(item, true, false), false);
    const reward = CACHE_REWARDS.find(reward => reward.id === item.effect)!;
    assert.ok(reward);
    assert.equal(reward.rarity, "mythic");
    assert.deepEqual(reward.unlockIds, [item.id]);
    assert.equal(reward.diceTheme, undefined, "critical effects are not presented as dice sets");
  }
});

test("existing Cache exclusivity and unique catalogue IDs stay intact", () => {
  for (const item of COSMETICS.filter(item => item.rarity === "mythic" && item.effect === "first-flame")) {
    assert.equal(isCacheExclusive(item), true);
    assert.equal(equipAllowed(item, true, false), false);
    assert.equal(equipAllowed(item, false, true), true);
  }
  assert.equal(new Set(COSMETICS.map(item => item.id)).size, COSMETICS.length);
});

test("seven equal Mythics share 0.2 percent without changing other reward probabilities", () => {
  const mythics = CACHE_REWARDS.filter(reward => reward.rarity === "mythic");
  const total = CACHE_REWARDS.reduce((sum, reward) => sum + reward.weight, 0);
  assert.equal(mythics.length, 7);
  for (const reward of mythics) assert.equal(total / reward.weight, 3500);
  assert.equal(mythics.reduce((sum, reward) => sum + reward.weight, 0) / total, .002);
  assert.equal(CACHE_REWARDS.find(reward => reward.id === "ember")!.weight / total, .35);
});

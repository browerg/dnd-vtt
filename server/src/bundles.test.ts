import test from "node:test";
import assert from "node:assert/strict";
import { BUNDLES, COSMETICS, bundlesNewestFirst } from "./shop.js";

// COSMETICS is a literal-typed array; widen so a bundle id can be checked.
const ids = new Set<string>(COSMETICS.map((item) => item.id));

test("every included feature that names a cosmetic names a real one", () => {
  for (const bundle of BUNDLES) {
    for (const feature of bundle.features) {
      if (feature.status !== "included" || !feature.cosmeticId) continue;
      assert.ok(
        ids.has(feature.cosmeticId),
        `${bundle.id} → "${feature.title}" points at missing cosmetic ${feature.cosmeticId}`
      );
    }
  }
});

test("upcoming features never claim a cosmetic", () => {
  // An upcoming row is a teaser for a type that does not exist. Attaching a
  // cosmetic to one would sell something the buyer does not receive.
  for (const bundle of BUNDLES) {
    for (const feature of bundle.features) {
      if (feature.status !== "upcoming") continue;
      assert.equal(
        feature.cosmeticId,
        undefined,
        `${bundle.id} → "${feature.title}" is upcoming but claims ${feature.cosmeticId}`
      );
    }
  }
});

test("bundles carry the copy the front page needs", () => {
  for (const bundle of BUNDLES) {
    for (const field of ["name", "kicker", "quote", "tagline"] as const) {
      assert.ok(bundle[field].trim().length > 0, `${bundle.id} is missing ${field}`);
    }
    assert.ok(bundle.features.length > 0, `${bundle.id} has no features`);
    assert.match(bundle.releasedAt, /^\d{4}-\d{2}-\d{2}$/, `${bundle.id} has a malformed releasedAt`);
  }
});

test("the newest bundle leads", () => {
  const sorted = bundlesNewestFirst();
  assert.equal(sorted.length, BUNDLES.length);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(
      sorted[i - 1].releasedAt >= sorted[i].releasedAt,
      "bundlesNewestFirst returned an out-of-order list"
    );
  }
});

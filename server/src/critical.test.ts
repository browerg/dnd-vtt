import { test } from "node:test";
import assert from "node:assert/strict";
import { criticalOf, type DieGroup, type RollDetail } from "./dice.js";

const detail = (groups: DieGroup[], extra: Partial<RollDetail> = {}): RollDetail => ({
  mode: "normal",
  kept: { groups, modifier: 0, total: groups.flatMap((g) => g.results).reduce((a, b) => a + b, 0) },
  ...extra,
});
const g = (sides: number, results: number[]): DieGroup => ({ count: results.length, sides, results });

test("Remnant: double 10s on the core 2d10 is a nat 20, whatever the attribute die shows", () => {
  assert.equal(criticalOf(detail([g(10, [10, 10]), g(8, [3])]), "remnant"), "nat20");
  assert.equal(criticalOf(detail([g(10, [10, 10]), g(12, [12])]), "remnant"), "nat20");
});

test("Remnant: double 1s is a nat 1", () => {
  assert.equal(criticalOf(detail([g(10, [1, 1]), g(6, [6])]), "remnant"), "nat1");
});

test("Remnant: anything else is not a critical", () => {
  assert.equal(criticalOf(detail([g(10, [10, 9]), g(8, [8])]), "remnant"), null);
  assert.equal(criticalOf(detail([g(10, [1, 2]), g(4, [1])]), "remnant"), null);
  // A lone d20 in Remnant isn't the core roll.
  assert.equal(criticalOf(detail([g(20, [20])]), "remnant"), null);
  // Damage dice alone never trigger it.
  assert.equal(criticalOf(detail([g(10, [10])]), "remnant"), null);
});

test("D&D: a d20 showing 20 or 1, unchanged", () => {
  assert.equal(criticalOf(detail([g(20, [20])]), "dnd5e"), "nat20");
  assert.equal(criticalOf(detail([g(20, [1]), g(4, [4])]), "dnd5e"), "nat1");
  assert.equal(criticalOf(detail([g(20, [12])]), "dnd5e"), null);
  // 2d10 damage in D&D is just damage.
  assert.equal(criticalOf(detail([g(10, [10, 10])]), "dnd5e"), null);
});

test("Manual (physical dice) rolls never trigger cosmetics", () => {
  assert.equal(criticalOf(detail([g(10, [10, 10])], { manual: true }), "remnant"), null);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDamage, applyHeal, restoreAura, type Vitals } from "./tokenVitals.js";

const huntsman = (over: Partial<Vitals> = {}): Vitals => ({
  hp: 18, maxHp: 18, aura: 10, auraMax: 55, tempHp: 0, conditions: [], ...over,
});
const grimm = (over: Partial<Vitals> = {}): Vitals => ({
  hp: 40, maxHp: 40, aura: null, auraMax: null, tempHp: 0, conditions: [], ...over,
});

test("Aura absorbs a hit completely while it lasts", () => {
  const r = applyDamage(huntsman(), 6);
  assert.equal(r.next.aura, 4);
  assert.equal(r.next.hp, 18);
  assert.equal(r.auraBroke, false);
  assert.deepEqual(r.next.conditions, []);
});

test("a hit that empties Aura breaks it and spills the rest into HP", () => {
  const r = applyDamage(huntsman({ aura: 4 }), 10);
  assert.equal(r.next.aura, 0);
  assert.equal(r.toAura, 4);
  assert.equal(r.toHp, 6);
  assert.equal(r.next.hp, 12);
  assert.equal(r.auraBroke, true);
  assert.deepEqual(r.next.conditions, ["Aura Broken"]);
});

test("the no-spill reading keeps HP untouched on the breaking hit", () => {
  const r = applyDamage(huntsman({ aura: 4 }), 10, { overflowToHp: false });
  assert.equal(r.next.aura, 0);
  assert.equal(r.next.hp, 18);
});

test("Grimm armor reduces damage before HP, and can be ignored", () => {
  assert.equal(applyDamage(grimm(), 6, { armor: 3 }).next.hp, 37);
  assert.equal(applyDamage(grimm(), 2, { armor: 3 }).next.hp, 40, "armor can absorb a weak hit entirely");
  assert.equal(applyDamage(grimm(), 6, { armor: 3, ignoreArmor: true }).next.hp, 34);
});

test("HP stops at 0 and reports reaching it", () => {
  const r = applyDamage(huntsman({ aura: 0, hp: 3, conditions: ["Aura Broken"] }), 9);
  assert.equal(r.next.hp, 0);
  assert.equal(r.reachedZeroHp, true);
  assert.deepEqual(r.next.conditions, ["Aura Broken"], "no duplicate condition");
});

test("5e temporary HP goes first", () => {
  const r = applyDamage(grimm({ tempHp: 5 }), 8);
  assert.equal(r.next.tempHp, 0);
  assert.equal(r.next.hp, 37);
});

test("healing caps at max and restoring Aura lifts Aura Broken", () => {
  assert.equal(applyHeal(huntsman({ hp: 10 }), 50).hp, 18);
  const restored = restoreAura(huntsman({ aura: 0, conditions: ["Aura Broken", "Burning"] }), 7);
  assert.equal(restored.aura, 7);
  assert.deepEqual(restored.conditions, ["Burning"]);
  assert.equal(restoreAura(grimm(), 5).aura, null, "no Aura to restore on Grimm");
});

test("junk amounts do nothing", () => {
  assert.equal(applyDamage(huntsman(), "lots").next.aura, 10);
  assert.equal(applyDamage(huntsman(), -5).next.aura, 10);
});

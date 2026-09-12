import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readRulerCalibration, rulerLabel, rulerPixels, validateRulerCalibration } from "../../shared/mapRuler.js";
import { canRelayRuler } from "./mapRulerRelay.js";

const segment = (length: number) => ({ x1: 50, y1: 70, x2: 50 + length, y2: 70 });

test("calibration rejects missing, nonfinite, tiny and out-of-order distances", () => {
  for (const v of [null, {}, {kind:"bands",close:20,mid:10,long:30}, {kind:"bands",close:10,mid:10,long:30},
    {kind:"bands",close:1,mid:10,long:20}, {kind:"scale",pixels:0,distance:5},
    {kind:"scale",pixels:50,distance:0}, {kind:"scale",pixels:Infinity,distance:5},
    {kind:"scale",pixels:50,distance:"5"}, {kind:"scale",pixels:50,distance:NaN}]) {
    assert.throws(() => validateRulerCalibration(v));
    assert.equal(readRulerCalibration(v), null);
  }
  assert.equal(readRulerCalibration("broken json"), null);
  assert.deepEqual(readRulerCalibration('{"kind":"scale","pixels":100,"distance":5}'), {kind:"scale",pixels:100,distance:5});
});

test("range bands honor the exact drawn boundaries without relying on grid size", () => {
  const c = validateRulerCalibration({kind:"bands",close:120,mid:480,long:900});
  for (const [distance, label] of [[0,"Close"],[120,"Close"],[120.1,"Mid"],[480,"Mid"],[480.1,"Long"],[900,"Long"],[900.1,"Extreme"]] as const) {
    assert.equal(rulerLabel(segment(distance), c), label);
  }
  assert.equal(rulerLabel(segment(100), null), "GM calibration required");
});

test("known-distance calibration uses image coordinates and diagonal lengths", () => {
  const c = validateRulerCalibration({kind:"scale",pixels:100,distance:5});
  assert.equal(rulerPixels({x1:0,y1:0,x2:60,y2:80}), 100);
  assert.equal(rulerLabel({x1:0,y1:0,x2:60,y2:80}, c), "5 ft");
  assert.equal(rulerLabel(segment(250), c), "12.5 ft");
  // A screen drag converted back from either zoom yields the same map span.
  for (const zoom of [.25, .8, 1, 2]) assert.equal(rulerLabel(segment(250 * zoom / zoom), c), "12.5 ft");
});

test("server relays only calibrated active maps belonging to the requested campaign", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE maps (id INTEGER, campaign_id INTEGER, active INTEGER, ruler_calibration TEXT DEFAULT NULL); INSERT INTO maps(id,campaign_id,active) VALUES (1,1,1),(2,1,0),(3,2,1)");
    assert.equal(canRelayRuler(db,1,1,segment(10)), false);
    const saved = JSON.stringify({kind:"bands",close:100,mid:300,long:600});
    db.prepare("UPDATE maps SET ruler_calibration=?").run(saved);
    assert.equal(canRelayRuler(db,1,1,segment(10)), true);
    assert.equal(canRelayRuler(db,1,2,segment(10)), false);
    assert.equal(canRelayRuler(db,1,3,segment(10)), false);
    assert.equal(canRelayRuler(db,1,99,segment(10)), false);
    assert.equal(canRelayRuler(db,1,1,segment(NaN)), false);
    assert.equal(canRelayRuler(db,1,1,segment(Infinity)), false);
    assert.equal(canRelayRuler(db,1,1,segment(1e9)), false);
    db.prepare("UPDATE maps SET ruler_calibration='{}' WHERE id=1").run();
    assert.equal(canRelayRuler(db,1,1,segment(10)), false);
  } finally { db.close(); }
});

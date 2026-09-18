import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDiceBoxCustomization, DEFAULT_DICE_CUSTOMIZATION } from "../../client/src/diceCustomization.js";
import { applyDiceCosmetic, FIRST_FLAME, flameEmission, cosmeticIntensity } from "../../client/src/diceCosmetics.js";

// Model Three r143's shared Source and the engine's cached face textures.
class Source { constructor(public data: unknown) {} }
class Texture {
  source: Source;
  needsUpdate = false;
  disposed = false;
  constructor(image: unknown) { this.source = new Source(image); }
  get image() { return this.source.data; }
  set image(value: unknown) { this.source.data = value; }
  clone() { const clone = new Texture(this.image); clone.source = this.source; return clone; }
  dispose() { this.disposed = true; }
}

test("emission lights orange seams and gold digits but leaves obsidian dark", () => {
  assert.equal(flameEmission(16, 14, 19), 0);
  assert.equal(flameEmission(30, 30, 33), 0);
  assert.ok(flameEmission(255, 140, 40) > 0.9);
  assert.ok(flameEmission(255, 230, 160) > 0.6);
  assert.ok(flameEmission(255, 211, 106) > 0.3);
  assert.ok(flameEmission(255, 211, 106) < 0.6, "digits remain readable during the flare");
});

test("rolling intensifies, landing settles, nat20 flares once, reduced motion stays constant", () => {
  const intensity = (state: "idle" | "rolling" | "landed" | "nat20", age = 0, reduced = false) =>
    cosmeticIntensity(FIRST_FLAME, state, 0, age, reduced);
  assert.ok(intensity("rolling") > intensity("idle"));
  assert.equal(intensity("landed"), intensity("rolling"));
  assert.ok(Math.abs(intensity("landed", 2) - intensity("idle")) < 0.001);
  assert.ok(intensity("nat20", 0.3) > intensity("rolling"));
  assert.ok(Math.abs(intensity("nat20", 2) - intensity("idle")) < 0.001);
  for (const state of ["idle", "rolling", "landed", "nat20"] as const) {
    assert.equal(intensity(state, 0.3, true), FIRST_FLAME.emissiveIntensityIdle);
  }
});

test("per-box glow preserves artwork, renders landing, cleans up, and leaves other themes intact", async () => {
  const saved = new Map(["document", "window", "requestAnimationFrame", "cancelAnimationFrame"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const face = { width: 1, height: 1 };
  const texture = new Texture(face);
  const makeMaterial = () => ({ map: texture, emissive: { setHex() {} }, emissiveIntensity: 0, emissiveMap: undefined as Texture | undefined });
  const factory = { createMaterials: () => [makeMaterial()] };
  let renders = 0;
  const box = { updateConfig: async () => {}, DiceFactory: factory, renderer: { render() { renders++; } } };
  Object.assign(globalThis, {
    document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ({
      drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([255, 140, 40, 255]) }), putImageData() {},
    }) }) },
    window: { matchMedia: () => ({ matches: false }) },
    requestAnimationFrame: (fn: FrameRequestCallback) => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  const step = (time: number) => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); };
  try {
    const animation = await applyDiceCosmetic(box, { ...FIRST_FLAME, id: "test-flame", createTexture: () => face as HTMLCanvasElement });
    const materials = [factory.createMaterials()[0], factory.createMaterials()[0]];
    for (const material of materials) {
      assert.equal(material.map.image, face);
      assert.notEqual(material.emissiveMap?.source, texture.source);
    }
    assert.equal(materials[0].emissiveMap, materials[1].emissiveMap, "mask reused for identical cached face");
    animation.setState("rolling"); step(performance.now());
    assert.ok(materials[0].emissiveIntensity > 0.7);
    assert.equal(renders, 0, "no second WebGL render while physics renders");
    animation.setState("landed"); step(performance.now() + 650);
    assert.equal(renders, 1);
    assert.ok(materials[0].emissiveIntensity < 0.5);
    const other = { createMaterials: () => [makeMaterial()] };
    await applyDiceBoxCustomization({ updateConfig: async () => {}, DiceFactory: other }, DEFAULT_DICE_CUSTOMIZATION);
    assert.equal(other.createMaterials()[0].emissiveMap, undefined, "live preview must not inherit flame");
    animation.dispose(); animation.dispose();
    assert.equal(frames.size, 0);
    assert.equal(materials[0].emissiveMap?.disposed, true);
    assert.equal(texture.disposed, false);
    assert.equal(factory.createMaterials()[0].emissiveMap, undefined, "next ordinary theme has no flame map");
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

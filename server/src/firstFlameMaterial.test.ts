import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDiceBoxCustomization, DEFAULT_DICE_CUSTOMIZATION, setFirstFlameMode } from "../../client/src/diceCustomization.js";

// Model Three's shared texture Source: cloning a texture does not copy its image.
class Source { constructor(public data: unknown) {} }
class Texture {
  source: Source;
  needsUpdate = false;
  constructor(image: unknown) { this.source = new Source(image); }
  get image() { return this.source.data; }
  set image(value: unknown) { this.source.data = value; }
  clone() { const clone = new Texture(this.image); clone.source = this.source; return clone; }
}
test("glow masks preserve cached face artwork across multiple dice", async () => {
  const originalDocument = globalThis.document;
  const face = { width: 1, height: 1 };
  const texture = new Texture(face);
  const materials = Array.from({ length: 3 }, () => ({ map: texture.clone(), emissiveMap: undefined as Texture | undefined }));
  let index = 0;
  const factory = { createMaterials: () => [materials[index++]] };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([255, 211, 106, 255]) }), putImageData() {},
  }) }) } as unknown as Document;
  setFirstFlameMode(true);
  try {
    await applyDiceBoxCustomization({ updateConfig: async () => {}, DiceFactory: factory }, DEFAULT_DICE_CUSTOMIZATION);
    for (const material of materials) {
      factory.createMaterials();
      assert.equal(material.map.image, face, "the diffuse face must retain its artwork");
      assert.notEqual(material.emissiveMap?.source, texture.source, "glow must own a separate image source");
      assert.notEqual(material.emissiveMap?.image, face);
    }
    assert.equal(texture.image, face, "the cached original must survive every die");
  } finally {
    setFirstFlameMode(false);
    if (originalDocument === undefined) Reflect.deleteProperty(globalThis, "document");
    else globalThis.document = originalDocument;
  }
});

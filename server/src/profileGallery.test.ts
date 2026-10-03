import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROFILE_GALLERY, PROFILE_BANNERS, defaultFraming, readProfileGallery, validateProfileGallery } from "../../shared/profileGallery.js";

test("only approved built-in banners are accepted and only for the cover", () => {
  for (const banner of PROFILE_BANNERS) {
    const coverPath = `preset:${banner.id}`;
    assert.equal(validateProfileGallery({ ...DEFAULT_PROFILE_GALLERY, coverPath }).coverPath, coverPath);
    assert.throws(() => validateProfileGallery({ ...DEFAULT_PROFILE_GALLERY, characterImage: coverPath }));
  }
  assert.throws(() => validateProfileGallery({ ...DEFAULT_PROFILE_GALLERY, coverPath: "preset:unowned" }));
});

test("gallery settings preserve deliberately hidden sections and trim captions", () => {
  const gallery = validateProfileGallery({ ...DEFAULT_PROFILE_GALLERY, sections: [], characterImage: "/uploads/abc-12.webp", memoryCaption: "  Our first victory.  " });
  assert.deepEqual(gallery.sections, []);
  assert.equal(gallery.memoryCaption, "Our first victory.");
  assert.equal(gallery.characterImage, "/uploads/abc-12.webp");
});
test("gallery images cannot embed external resources, traversal, or executable uploads", () => {
  for (const coverPath of ["https://example.com/a.png", "/uploads/../secret.png", "/uploads/a.svg", "/uploads/a.png?x=1", "/assets/profile-gallery/portrait.png", 42]) {
    assert.throws(() => validateProfileGallery({ ...DEFAULT_PROFILE_GALLERY, coverPath }));
  }
});
test("gallery rejects malformed layouts and oversized fields", () => {
  for (const patch of [{ sections: ["badges", "badges"] }, { sections: ["admin"] }, { accent: "neon" }, { badgesFirst: "yes" }, { memoryCaption: "x".repeat(281) }]) {
    assert.throws(() => validateProfileGallery({ ...DEFAULT_PROFILE_GALLERY, ...patch }));
  }
});
test("legacy and corrupt gallery records become independent empty defaults", () => {
  const first = readProfileGallery("broken"); first.sections.pop();
  assert.deepEqual(readProfileGallery(undefined), DEFAULT_PROFILE_GALLERY);
  assert.deepEqual(readProfileGallery("{}"), DEFAULT_PROFILE_GALLERY);
  assert.equal(readProfileGallery("{}", true).accent, "profile", "existing profile palette survives migration");
  assert.equal(readProfileGallery(JSON.stringify(DEFAULT_PROFILE_GALLERY), true).accent, "copper", "explicit gallery accent is preserved");
});

test("photo framing is kept, clamped to its frame, and defaults for older galleries", () => {
  const { framing: _framing, coverHeight: _height, ...legacy } = DEFAULT_PROFILE_GALLERY;
  const old = validateProfileGallery(legacy);
  assert.deepEqual(old.framing, defaultFraming(), "galleries saved before framing keep the original crop");
  assert.equal(old.coverHeight, "standard");

  const framed = validateProfileGallery({
    ...DEFAULT_PROFILE_GALLERY,
    coverHeight: "tall",
    framing: { cover: { x: 20, y: 80.456, zoom: 1.75 }, character: { x: -40, y: 400, zoom: 99 }, memory: "nonsense", portrait: { x: "left" } },
  });
  assert.equal(framed.coverHeight, "tall");
  assert.deepEqual(framed.framing.cover, { x: 20, y: 80.46, zoom: 1.75 });
  assert.deepEqual(framed.framing.character, { x: 0, y: 100, zoom: 3 }, "out-of-range values clamp instead of failing the save");
  assert.deepEqual(framed.framing.memory, defaultFraming().memory);
  assert.deepEqual(framed.framing.portrait, defaultFraming().portrait);
  assert.equal(validateProfileGallery({ ...DEFAULT_PROFILE_GALLERY, coverHeight: "giant" }).coverHeight, "standard");
});

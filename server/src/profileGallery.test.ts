import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROFILE_GALLERY, PROFILE_BANNERS, PROFILE_STARTER_ART, profileGalleryArtwork, defaultFraming, readProfileGallery, validateProfileGallery } from "../../shared/profileGallery.js";

test("starter artwork fills empty slots without changing saved settings", () => {
  const gallery = readProfileGallery(undefined);
  assert.deepEqual(profileGalleryArtwork(gallery), {
    banner: PROFILE_STARTER_ART.cover, character: PROFILE_STARTER_ART.character, memory: PROFILE_STARTER_ART.memory,
  });
  assert.equal(gallery.coverPath, "");
  const custom = { ...gallery, coverPath: "preset:forest", characterImage: "/uploads/my-character.png", memoryImage: "/uploads/my-memory.webp", sections: [] };
  assert.deepEqual(profileGalleryArtwork(custom), {
    banner: "preset:forest", character: "/uploads/my-character.png", memory: "/uploads/my-memory.webp",
  });
  assert.deepEqual(custom.sections, []);
});

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

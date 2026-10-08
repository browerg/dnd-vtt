export const GALLERY_SECTIONS = ["character", "dice", "badges", "memory"] as const;
export type GallerySection = typeof GALLERY_SECTIONS[number];
export const GALLERY_ACCENTS = ["copper", "rose", "jade", "ice", "profile"] as const;
export const PROFILE_BANNERS = [
  { id: "citadel", name: "Lakeside Citadel", image: "/assets/profile-gallery/example/banner.webp" },
  { id: "midnight", name: "Midnight", image: "" },
  { id: "ember", name: "Ember", image: "" },
  { id: "forest", name: "Forest", image: "" },
] as const;
/** Photos the owner can reposition and zoom inside their frame. */
export const FRAMED_IMAGES = ["cover", "character", "memory", "portrait"] as const;
export type FramedImage = typeof FRAMED_IMAGES[number];
/** Focal point in percent of the picture, and zoom (1 = just fills the frame). */
export interface ImageFraming { x: number; y: number; zoom: number }
export const MAX_IMAGE_ZOOM = 3;
export const COVER_HEIGHTS = ["short", "standard", "tall", "xtall"] as const;
export type CoverHeight = typeof COVER_HEIGHTS[number];
export const defaultFraming = (): Record<FramedImage, ImageFraming> => ({
  cover: { x: 50, y: 50, zoom: 1 },
  character: { x: 60, y: 30, zoom: 1 },
  memory: { x: 50, y: 50, zoom: 1 },
  portrait: { x: 50, y: 50, zoom: 1 },
});
export const profileBanner = (value: string) => PROFILE_BANNERS.find(banner => value === `preset:${banner.id}`);
export interface ProfileGallery {
  coverPath: string;
  characterImage: string;
  characterName: string;
  memoryImage: string;
  memoryCaption: string;
  signatureDice: string;
  accent: typeof GALLERY_ACCENTS[number];
  sections: GallerySection[];
  badgesFirst: boolean;
  framing: Record<FramedImage, ImageFraming>;
  coverHeight: CoverHeight;
}
export const DEFAULT_PROFILE_GALLERY: ProfileGallery = {
  coverPath: "", characterImage: "", characterName: "", memoryImage: "", memoryCaption: "",
  signatureDice: "", accent: "copper", sections: [...GALLERY_SECTIONS], badgesFirst: false,
  framing: defaultFraming(), coverHeight: "standard",
};

/** Starter artwork is displayed, not written over a player's saved gallery. */
export const PROFILE_STARTER_ART = {
  cover: "/assets/profile-gallery/defaults/academy.webp",
  character: "/assets/profile-gallery/defaults/silhouette.webp",
  memory: "/assets/profile-gallery/defaults/initiation.webp",
} as const;
export function profileGalleryArtwork(gallery: ProfileGallery) {
  return {
    banner: gallery.coverPath || PROFILE_STARTER_ART.cover,
    character: gallery.characterImage || PROFILE_STARTER_ART.character,
    memory: gallery.memoryImage || PROFILE_STARTER_ART.memory,
  };
}

/** Only uploaded rasters are accepted for personal pictures. */
function imagePath(value: unknown): string {
  if (typeof value !== "string") throw new Error("Choose a valid gallery image.");
  if (value === "") return "";
  if (!/^\/uploads\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(png|jpe?g|webp)$/i.test(value)) throw new Error("Choose an uploaded PNG, JPEG, or WebP image.");
  return value;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max) throw new Error(`Gallery text must be ${max} characters or fewer.`);
  return value.trim();
}
const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value * 100) / 100)) : fallback;
/** Framing is cosmetic, so bad or missing values fall back instead of failing a save. */
function framingOf(value: unknown): Record<FramedImage, ImageFraming> {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
  const defaults = defaultFraming();
  return Object.fromEntries(FRAMED_IMAGES.map((id) => {
    const item = input[id] && typeof input[id] === "object" ? input[id] : {};
    return [id, { x: clamp(item.x, 0, 100, defaults[id].x), y: clamp(item.y, 0, 100, defaults[id].y), zoom: clamp(item.zoom, 1, MAX_IMAGE_ZOOM, 1) }];
  })) as Record<FramedImage, ImageFraming>;
}
export function validateProfileGallery(value: unknown): ProfileGallery {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid gallery settings.");
  const input = value as Record<string, unknown>;
  if (!GALLERY_ACCENTS.includes(input.accent as ProfileGallery["accent"])) throw new Error("Choose a valid gallery accent.");
  if (!Array.isArray(input.sections) || input.sections.length > 4 || new Set(input.sections).size !== input.sections.length || input.sections.some(section => !GALLERY_SECTIONS.includes(section))) throw new Error("Choose valid gallery sections.");
  if (typeof input.badgesFirst !== "boolean") throw new Error("Choose a valid gallery layout.");
  return {
    coverPath: typeof input.coverPath === "string" && profileBanner(input.coverPath) ? input.coverPath : imagePath(input.coverPath), characterImage: imagePath(input.characterImage),
    characterName: text(input.characterName, 60), memoryImage: imagePath(input.memoryImage),
    memoryCaption: text(input.memoryCaption, 280), signatureDice: text(input.signatureDice, 600),
    accent: input.accent as ProfileGallery["accent"], sections: [...input.sections] as GallerySection[], badgesFirst: input.badgesFirst,
    framing: framingOf(input.framing),
    coverHeight: COVER_HEIGHTS.includes(input.coverHeight as CoverHeight) ? input.coverHeight as CoverHeight : "standard",
  };
}
export function readProfileGallery(raw: unknown, preserveProfilePalette = false): ProfileGallery {
  try { return validateProfileGallery(typeof raw === "string" ? JSON.parse(raw) : raw); }
  catch { return { ...DEFAULT_PROFILE_GALLERY, accent: preserveProfilePalette ? "profile" : "copper", sections: [...GALLERY_SECTIONS], framing: defaultFraming() }; }
}

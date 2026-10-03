export const GALLERY_SECTIONS = ["character", "dice", "badges", "memory"] as const;
export type GallerySection = typeof GALLERY_SECTIONS[number];
export const GALLERY_ACCENTS = ["copper", "rose", "jade", "ice", "profile"] as const;
export const PROFILE_BANNERS = [
  { id: "citadel", name: "Lakeside Citadel", image: "/assets/profile-gallery/example/banner.webp" },
  { id: "midnight", name: "Midnight", image: "" },
  { id: "ember", name: "Ember", image: "" },
  { id: "forest", name: "Forest", image: "" },
] as const;
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
}
export const DEFAULT_PROFILE_GALLERY: ProfileGallery = {
  coverPath: "", characterImage: "", characterName: "", memoryImage: "", memoryCaption: "",
  signatureDice: "", accent: "copper", sections: [...GALLERY_SECTIONS], badgesFirst: false,
};

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
  };
}
export function readProfileGallery(raw: unknown, preserveProfilePalette = false): ProfileGallery {
  try { return validateProfileGallery(typeof raw === "string" ? JSON.parse(raw) : raw); }
  catch { return { ...DEFAULT_PROFILE_GALLERY, accent: preserveProfilePalette ? "profile" : "copper", sections: [...GALLERY_SECTIONS] }; }
}

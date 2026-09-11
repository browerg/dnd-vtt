export type DiceFinish = "matte" | "glossy" | "metallic";
export type DicePattern =
  | "none"
  | "marble"
  | "cloudy_2"
  | "glitter"
  | "stars"
  | "stainedglass"
  | "ice"
  | "water"
  | "astral"
  | "dragon"
  | "fire"
  | "speckles";
export type DiceNumberStyle = "clean" | "outlined";

export interface DiceCustomization {
  baseColor: string;
  textColor: string;
  edgeColor: string;
  outlineColor: string;
  numberStyle: DiceNumberStyle;
  finish: DiceFinish;
  pattern: DicePattern;
  patternStrength: number;
  patternScale: number;
}

export const DEFAULT_DICE_CUSTOMIZATION: DiceCustomization = {
  baseColor: "#f2f2f2",
  textColor: "#16131d",
  edgeColor: "#f2f2f2",
  outlineColor: "#16131d",
  numberStyle: "clean",
  finish: "matte",
  pattern: "none",
  patternStrength: 0.8,
  patternScale: 1,
};

export const DICE_FINISH_OPTIONS: { value: DiceFinish; label: string }[] = [
  { value: "matte", label: "Matte" },
  { value: "glossy", label: "Glossy / Glass" },
  { value: "metallic", label: "Metallic" },
];

export const DICE_PATTERN_OPTIONS: { value: DicePattern; label: string }[] = [
  { value: "none", label: "None" },
  { value: "marble", label: "Marble" },
  { value: "cloudy_2", label: "Clouds" },
  { value: "glitter", label: "Glitter" },
  { value: "stars", label: "Stars" },
  { value: "stainedglass", label: "Stained Glass" },
  { value: "ice", label: "Ice Crystal" },
  { value: "water", label: "Water Glass" },
  { value: "astral", label: "Astral" },
  { value: "dragon", label: "Dragon Scale" },
  { value: "fire", label: "Fire" },
  { value: "speckles", label: "Speckles" },
];

export const DICE_NUMBER_STYLE_OPTIONS: { value: DiceNumberStyle; label: string }[] = [
  { value: "clean", label: "Clean" },
  { value: "outlined", label: "Outlined" },
];

const CUSTOM_THEME_V1_RE =
  /^custom:v1:(#[0-9a-f]{6}):(#[0-9a-f]{6}):(matte|glossy|metallic)$/i;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const PATTERN_SET = new Set<DicePattern>(DICE_PATTERN_OPTIONS.map((option) => option.value));
const FINISH_SET = new Set<DiceFinish>(DICE_FINISH_OPTIONS.map((option) => option.value));

const MATERIAL_BY_FINISH: Record<DiceFinish, "none" | "glass" | "metal"> = {
  matte: "none",
  glossy: "glass",
  metallic: "metal",
};

type DiceBoxCustomizationTarget = {
  updateConfig: (config: Record<string, unknown>) => Promise<void>;
  DiceFactory?: unknown;
};

type InternalDiceFactory = {
  dice_texture?: unknown;
  dice_material?: string;
  materials_cache?: Record<string, unknown>;
  createMaterials?: (...args: unknown[]) => unknown;
  __vividGlassWrapped?: boolean;
};

/* ------------------------------------------------------------------ *
 * TEMPORARY — glass material experiment
 *
 * The library's "glass" preset is { roughness: 0.1, metalness: 0 } with no
 * transparency at all, which is why the glossy finish reads as polished
 * plastic rather than glass. This lets a few treatments be compared on real
 * rolls before deciding whether to build anything on top of them.
 *
 * Delete this block, GLASS_TEST_MODES and the setGlassTestMode export once a
 * look is chosen.
 * ------------------------------------------------------------------ */

export type GlassTestMode = "off" | "tinted" | "transmission" | "ruby";

export const GLASS_TEST_MODES: { value: GlassTestMode; label: string; blurb: string }[] = [
  { value: "off", label: "A · Current", blurb: "Today's glossy finish, untouched" },
  { value: "tinted", label: "B · Tinted resin", blurb: "Simple opacity — works on any material" },
  { value: "transmission", label: "C · Deep glass", blurb: "Real light transmission through the die" },
  { value: "ruby", label: "D · Ruby glass", blurb: "Thick crimson transmission" },
];

let glassTestMode: GlassTestMode = "off";
// The library sets envMapIntensity = 0 on every non-plastic material, which is
// why glass and metal look so dark — those finishes get nearly all their
// brightness from environment reflections. This puts it back, adjustably.
let glassTestBrightness = 1;
// Emissive strength applied through the face texture, so the numbers light up
// rather than the whole die washing out. 0 disables it.
let glassTestGlow = 0;

export function setGlassTestMode(mode: GlassTestMode): void {
  glassTestMode = mode;
}

export function getGlassTestMode(): GlassTestMode {
  return glassTestMode;
}

export function setGlassTestBrightness(value: number): void {
  glassTestBrightness = Math.max(0, Math.min(4, Number(value) || 0));
}

export function setGlassTestGlow(value: number): void {
  glassTestGlow = Math.max(0, Math.min(3, Number(value) || 0));
}

type MutableMaterial = Record<string, unknown> & { needsUpdate?: boolean };

/** Applies the selected treatment to one built die material, in place. */
function applyGlassTest(material: unknown): void {
  if (!material || typeof material !== "object") return;
  const m = material as MutableMaterial;

  // Transmission only exists on MeshPhysicalMaterial. Detecting it at runtime
  // avoids caring which class the minified bundle actually uses.
  const supportsTransmission = "transmission" in m;

  switch (glassTestMode) {
    case "tinted":
      m.transparent = true;
      m.opacity = 0.65;
      m.roughness = 0.08;
      break;

    case "transmission":
      if (supportsTransmission) {
        m.transmission = 0.9;
        m.thickness = 0.5;
        m.ior = 1.5;
        m.roughness = 0.05;
        m.transparent = true;
      } else {
        // Graceful fallback so the button still shows something.
        m.transparent = true;
        m.opacity = 0.55;
        m.roughness = 0.05;
      }
      break;

    case "ruby":
      if (supportsTransmission) {
        m.transmission = 0.85;
        m.thickness = 1.4;
        m.ior = 1.77; // roughly ruby
        m.roughness = 0.03;
        m.transparent = true;
      } else {
        m.transparent = true;
        m.opacity = 0.6;
        m.roughness = 0.03;
      }
      // Tint the body without touching the number faces.
      if (m.color && typeof (m.color as { setHex?: unknown }).setHex === "function") {
        (m.color as { setHex: (hex: number) => void }).setHex(0x9b111e);
      }
      break;

    case "off":
    default:
      break;
  }

  // Brightness and glow apply to every mode, including the untouched baseline,
  // so the current finish can be brightened without going translucent at all.
  m.envMapIntensity = glassTestBrightness;

  if (glassTestGlow > 0) {
    // m.map is the composited face texture — body colour plus the number
    // glyphs. Using it as the emissive map means the light parts of the face
    // emit, so pale numbers on a dark die glow while the body stays dim.
    if (m.map) m.emissiveMap = m.map;
    const emissive = m.emissive as { setHex?: (hex: number) => void } | undefined;
    if (emissive && typeof emissive.setHex === "function") emissive.setHex(0xffffff);
    m.emissiveIntensity = glassTestGlow;
  }

  m.needsUpdate = true;
}

/**
 * Wraps the factory's material builder once, so every die built afterwards
 * passes through the experiment. Materials are created per die, so patching
 * here catches them all without needing scene access.
 */
function wrapGlassTest(factory: InternalDiceFactory): void {
  if (factory.__vividGlassWrapped || typeof factory.createMaterials !== "function") return;
  const original = factory.createMaterials.bind(factory);
  factory.createMaterials = (...args: unknown[]) => {
    const built = original(...args);
    // Runs for every mode, because brightness and glow are worth testing
    // against the untouched finish too.
    if (Array.isArray(built)) built.forEach(applyGlassTest);
    else applyGlassTest(built);
    return built;
  };
  factory.__vividGlassWrapped = true;
}

type TextureEntry = {
  name?: string;
  composite?: string;
  texture?: unknown;
  bump?: unknown;
  material?: string;
  [key: string]: unknown;
};

function normalizeHex(value: string, fallback: string): string {
  return HEX_RE.test(value) ? value.toLowerCase() : fallback;
}

function clampStep(value: number, min: number, max: number, step: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const clamped = Math.min(max, Math.max(min, value));
  return Math.round(clamped / step) * step;
}

export function normalizeDiceCustomization(value: DiceCustomization): DiceCustomization {
  const finish: DiceFinish = FINISH_SET.has(value.finish)
    ? value.finish
    : DEFAULT_DICE_CUSTOMIZATION.finish;
  const pattern: DicePattern = PATTERN_SET.has(value.pattern)
    ? value.pattern
    : DEFAULT_DICE_CUSTOMIZATION.pattern;
  const numberStyle: DiceNumberStyle = value.numberStyle === "outlined" ? "outlined" : "clean";

  return {
    baseColor: normalizeHex(value.baseColor, DEFAULT_DICE_CUSTOMIZATION.baseColor),
    textColor: normalizeHex(value.textColor, DEFAULT_DICE_CUSTOMIZATION.textColor),
    edgeColor: normalizeHex(value.edgeColor, value.baseColor || DEFAULT_DICE_CUSTOMIZATION.edgeColor),
    outlineColor: normalizeHex(value.outlineColor, DEFAULT_DICE_CUSTOMIZATION.outlineColor),
    numberStyle,
    finish,
    pattern,
    patternStrength: clampStep(value.patternStrength, 0.25, 1, 0.05, DEFAULT_DICE_CUSTOMIZATION.patternStrength),
    patternScale: clampStep(value.patternScale, 0.5, 2.5, 0.1, DEFAULT_DICE_CUSTOMIZATION.patternScale),
  };
}

export function encodeDiceCustomization(value: DiceCustomization): string {
  const normalized = normalizeDiceCustomization(value);
  const outline = normalized.numberStyle === "outlined" ? normalized.outlineColor : "none";
  const strength = Math.round(normalized.patternStrength * 100);
  const scale = Math.round(normalized.patternScale * 100);
  return [
    "custom",
    "v2",
    normalized.baseColor,
    normalized.textColor,
    normalized.edgeColor,
    outline,
    normalized.finish,
    normalized.pattern,
    String(strength),
    String(scale),
  ].join(":");
}

export function decodeDiceCustomization(theme: string | undefined): DiceCustomization | null {
  const value = theme ?? "";
  const legacy = CUSTOM_THEME_V1_RE.exec(value);
  if (legacy) {
    const baseColor = legacy[1].toLowerCase();
    return {
      ...DEFAULT_DICE_CUSTOMIZATION,
      baseColor,
      textColor: legacy[2].toLowerCase(),
      edgeColor: baseColor,
      finish: legacy[3].toLowerCase() as DiceFinish,
    };
  }

  const parts = value.split(":");
  if (parts.length !== 10 || parts[0] !== "custom" || parts[1] !== "v2") return null;

  const baseColor = parts[2].toLowerCase();
  const textColor = parts[3].toLowerCase();
  const edgeColor = parts[4].toLowerCase();
  const outlineToken = parts[5].toLowerCase();
  const finish = parts[6].toLowerCase() as DiceFinish;
  const pattern = parts[7].toLowerCase() as DicePattern;
  const strength = Number(parts[8]);
  const scale = Number(parts[9]);

  if (!HEX_RE.test(baseColor) || !HEX_RE.test(textColor) || !HEX_RE.test(edgeColor)) return null;
  if (outlineToken !== "none" && !HEX_RE.test(outlineToken)) return null;
  if (!FINISH_SET.has(finish) || !PATTERN_SET.has(pattern)) return null;
  if (!Number.isInteger(strength) || strength < 25 || strength > 100 || strength % 5 !== 0) return null;
  if (!Number.isInteger(scale) || scale < 50 || scale > 250 || scale % 10 !== 0) return null;

  return normalizeDiceCustomization({
    baseColor,
    textColor,
    edgeColor,
    outlineColor: outlineToken === "none" ? DEFAULT_DICE_CUSTOMIZATION.outlineColor : outlineToken,
    numberStyle: outlineToken === "none" ? "clean" : "outlined",
    finish,
    pattern,
    patternStrength: strength / 100,
    patternScale: scale / 100,
  });
}

export function diceBoxAppearanceConfig(value: DiceCustomization): Record<string, unknown> {
  const normalized = normalizeDiceCustomization(value);
  const outline = normalized.numberStyle === "outlined" ? normalized.outlineColor : "none";

  // DiceColors caches custom colorsets by name. Every setting that changes the
  // final face must participate in the name so live editing never reuses an old
  // texture canvas. Finish stays out of the library's texture object itself;
  // applyDiceBoxCustomization applies it safely after DiceBox loads the pattern.
  const name = [
    "vivid2",
    normalized.baseColor.slice(1),
    normalized.textColor.slice(1),
    normalized.edgeColor.slice(1),
    outline === "none" ? "clean" : outline.slice(1),
    normalized.finish,
    normalized.pattern,
    Math.round(normalized.patternStrength * 100),
    Math.round(normalized.patternScale * 100),
  ].join("-");

  return {
    theme_customColorset: {
      name,
      foreground: normalized.textColor,
      background: normalized.baseColor,
      edge: normalized.edgeColor,
      outline,
      texture: normalized.pattern,
    },
  };
}

function imageDimensions(source: unknown): { width: number; height: number } | null {
  if (!source || typeof source !== "object") return null;
  const image = source as {
    naturalWidth?: number;
    naturalHeight?: number;
    videoWidth?: number;
    videoHeight?: number;
    width?: number;
    height?: number;
  };
  const width = Number(image.naturalWidth || image.videoWidth || image.width || 0);
  const height = Number(image.naturalHeight || image.videoHeight || image.height || 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function makePatternCanvas(source: unknown, strength: number, scale: number): unknown {
  if (typeof document === "undefined") return source;
  const dimensions = imageDimensions(source);
  if (!dimensions) return source;

  const canvas = document.createElement("canvas");
  const size = 512;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return source;

  // Scale 1.0 matches DiceBox's normal one-image-per-face behavior. Higher
  // values repeat the pattern more tightly; lower values make the pattern feel
  // larger by cropping a centered oversized tile.
  const tileSize = Math.max(48, Math.round(size / scale));
  const start = tileSize >= size ? Math.round((size - tileSize) / 2) : 0;
  context.globalAlpha = strength;

  for (let y = start; y < size; y += tileSize) {
    for (let x = start; x < size; x += tileSize) {
      try {
        context.drawImage(source as CanvasImageSource, x, y, tileSize, tileSize);
      } catch {
        return source;
      }
    }
  }

  context.globalAlpha = 1;
  return canvas;
}

function cloneTextureEntry(
  entry: unknown,
  material: string,
  pattern: DicePattern,
  strength: number,
  scale: number
): unknown {
  if (!entry || typeof entry !== "object") return entry;
  const source = entry as TextureEntry;
  const clone: TextureEntry = { ...source, material };

  if (pattern !== "none") {
    clone.texture = makePatternCanvas(source.texture, strength, scale);
    clone.bump = makePatternCanvas(source.bump, Math.max(0.35, strength), scale);
  }

  return clone;
}

function isolateTextureState(
  texture: unknown,
  material: string,
  pattern: DicePattern,
  strength: number,
  scale: number
): unknown {
  if (Array.isArray(texture)) {
    return texture.map((entry) => cloneTextureEntry(entry, material, pattern, strength, scale));
  }
  return cloneTextureEntry(texture, material, pattern, strength, scale);
}

export async function applyDiceBoxCustomization(
  box: DiceBoxCustomizationTarget,
  value: DiceCustomization
): Promise<void> {
  const normalized = normalizeDiceCustomization(value);
  await box.updateConfig(diceBoxAppearanceConfig(normalized));

  // @3d-dice/dice-box-threejs returns built-in texture records by reference.
  // Never attach finish or our transformed pattern canvases to those shared
  // records. Clone the active state, then let the next die mesh build from it.
  const factory = box.DiceFactory as InternalDiceFactory | undefined;
  if (!factory) return;

  const material = MATERIAL_BY_FINISH[normalized.finish];
  factory.dice_texture = isolateTextureState(
    factory.dice_texture,
    material,
    normalized.pattern,
    normalized.patternStrength,
    normalized.patternScale
  );
  factory.dice_material = material;
  factory.materials_cache = {};

  // TEMPORARY — see the glass experiment block above.
  wrapGlassTest(factory);
}

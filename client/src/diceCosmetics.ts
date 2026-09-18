import { applyDiceBoxCustomization, DEFAULT_DICE_CUSTOMIZATION } from "./diceCustomization.js";

export interface DiceCosmetic {
  id: string;
  label: string;
  baseColor: string;
  numberColor: string;
  edgeColor: string;
  emissiveColor: number;
  emissiveIntensityIdle: number;
  emissiveIntensityRolling: number;
  pulseSpeedIdle: number;
  pulseSpeedRolling: number;
  trailId: string;
  nat20EffectId: string;
  createTexture: () => HTMLCanvasElement;
  emissionStrength: (r: number, g: number, b: number) => number;
}

export const FIRST_FLAME: DiceCosmetic = {
  id: "first-flame",
  label: "Relic of the First Flame",
  baseColor: "#100e13",
  numberColor: "#ffd36a",
  edgeColor: "#56351b",
  emissiveColor: 0xffb52e,
  emissiveIntensityIdle: 0.4,
  emissiveIntensityRolling: 0.85,
  pulseSpeedIdle: 1.5,
  pulseSpeedRolling: 3,
  trailId: "first-flame",
  nat20EffectId: "first-flame",
  createTexture: createObsidianTexture,
  emissionStrength: flameEmission,
};

export const DICE_COSMETICS: Readonly<Record<string, DiceCosmetic>> = {
  [FIRST_FLAME.id]: FIRST_FLAME,
};

export type CosmeticState = "idle" | "rolling" | "landed" | "nat20";

// Speckle and branching seams are deterministic and generated only once.
function createObsidianTexture(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  let ctx = canvas.getContext("2d")!;
  ctx.fillStyle = FIRST_FLAME.baseColor;
  ctx.fillRect(0, 0, 512, 512);
  let seed = 17;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 6000; i++) {
    const level = 12 + Math.floor(random() * 18);
    ctx.fillStyle = `rgb(${level}, ${level}, ${level + 3})`;
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 3, 1 + random() * 3);
  }
  const stone = ctx;
  const seams = document.createElement("canvas");
  seams.width = seams.height = 512;
  ctx = seams.getContext("2d")!;
  for (let branch = 0; branch < 3; branch++) {
    ctx.beginPath();
    let x = (branch * 197 + 19) % 512;
    ctx.moveTo(x, 0);
    for (let y = 40; y <= 560; y += 40) {
      x += Math.sin(branch * 7 + y * 0.08) * 38;
      ctx.lineTo(x, y);
      if (y % 120 === 0) {
        ctx.lineTo(x + 32, y + 16);
        ctx.lineTo(x + 46, y + 47);
        ctx.moveTo(x, y);
      }
    }
    ctx.strokeStyle = "#ff8c28";
    ctx.shadowColor = "#ff961e";
    ctx.shadowBlur = 9;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffe6a0";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // Leave a softly faded quiet area behind the numbers, rather than letting
  // bright seams cross their strokes on small d12/d20 faces.
  ctx.globalCompositeOperation = "destination-out";
  const quiet = ctx.createRadialGradient(256, 256, 65, 256, 256, 175);
  quiet.addColorStop(0, "rgba(0,0,0,1)");
  quiet.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = quiet;
  ctx.fillRect(0, 0, 512, 512);
  stone.drawImage(seams, 0, 0);
  return canvas;
}

interface Texture {
  image: CanvasImageSource;
  source?: { constructor: new (image: unknown) => unknown };
  clone: () => Texture;
  needsUpdate: boolean;
  dispose: () => void;
}
interface Material {
  map?: Texture;
  emissiveMap?: Texture;
  emissive?: { setHex: (hex: number) => void };
  emissiveIntensity: number;
  roughness?: number;
  metalness?: number;
  needsUpdate?: boolean;
}
interface Factory {
  createMaterials: (...args: unknown[]) => Material[];
  dice_texture?: unknown;
  materials_cache?: Record<string, unknown>;
  __vividCosmeticActive?: boolean;
}
interface CosmeticBox {
  updateConfig: (config: Record<string, unknown>) => Promise<void>;
  DiceFactory?: unknown;
  renderer?: { render: (scene: unknown, camera: unknown) => void };
  scene?: unknown;
  camera?: unknown;
}

// Classify the final composited face so the engine's rotated d4 labels and
// forced-outcome face swaps retain their own correctly aligned glow mask.
export function flameEmission(r: number, g: number, b: number): number {
  const warm = Math.max(0, Math.min(1, (r - b - 20) / 100)) * (r / 255);
  const glyph = Math.max(0, 1 - Math.hypot(r - 255, g - 211, b - 106) / 55);
  return warm * (1 - glyph * 0.55);
}

function emissionMask(map: Texture, config: DiceCosmetic): Texture {
  const source = map.image as HTMLCanvasElement;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const level = Math.round(255 * config.emissionStrength(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]));
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = level;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const mask = map.clone();
  // Texture.clone shares Source in Three r143. Never mutate the diffuse image.
  if (map.source) Object.assign(mask, { source: new map.source.constructor(canvas) });
  else mask.image = canvas;
  mask.needsUpdate = true;
  return mask;
}

export function cosmeticIntensity(config: DiceCosmetic, state: CosmeticState, seconds: number, sinceLanding: number, reduced: boolean): number {
  if (reduced) return config.emissiveIntensityIdle;
  const idle = config.emissiveIntensityIdle + Math.sin(seconds * config.pulseSpeedIdle) * 0.06;
  const rolling = config.emissiveIntensityRolling + Math.sin(seconds * config.pulseSpeedRolling) * 0.12;
  if (state === "rolling") return rolling;
  if (state === "idle") return idle;
  const settle = Math.exp(-sinceLanding * 6);
  const flare = state === "nat20" && sinceLanding < 0.65
    ? Math.sin(Math.PI * sinceLanding / 0.65) * 0.8 : 0;
  return idle + (rolling - idle) * settle + flare;
}

export interface CosmeticAnimation {
  setState: (state: CosmeticState) => void;
  dispose: () => void;
}
const hooks = new WeakMap<Factory, { active?: (materials: Material[]) => void }>();
const textures = new Map<string, HTMLCanvasElement>();

/** One controller per visible roll; no global mode can leak into preview boxes. */
export async function applyDiceCosmetic(box: CosmeticBox, config: DiceCosmetic): Promise<CosmeticAnimation> {
  await applyDiceBoxCustomization(box, {
    ...DEFAULT_DICE_CUSTOMIZATION,
    baseColor: config.baseColor, textColor: config.numberColor,
    edgeColor: config.edgeColor, outlineColor: "#030204",
    numberStyle: "outlined", finish: "metallic",
  });
  await box.updateConfig({ light_intensity: 0.9 });
  const factory = box.DiceFactory as Factory;
  if (!factory?.createMaterials) throw new Error("Dice engine material factory unavailable");
  if (!textures.has(config.id)) textures.set(config.id, config.createTexture());
  factory.dice_texture = {
    name: `${config.id}-procedural-v2`, texture: textures.get(config.id),
    bump: "", composite: "source-over", material: "metal",
  };
  factory.materials_cache = {};
  let hook = hooks.get(factory);
  if (!hook) {
    hook = {};
    hooks.set(factory, hook);
    const original = factory.createMaterials.bind(factory);
    const installedHook = hook;
    factory.createMaterials = (...args) => {
      const built = original(...args);
      installedHook.active?.(built);
      return built;
    };
  }
  const materials = new Set<Material>();
  const masks = new Map<Texture, Texture>();
  let state: CosmeticState = "idle";
  let landedAt = 0;
  let frame = 0;
  let disposed = false;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  factory.__vividCosmeticActive = true;
  hook.active = (built) => {
    for (const material of built) {
      if (!material.map || !material.emissive) continue;
      if (!masks.has(material.map)) masks.set(material.map, emissionMask(material.map, config));
      material.emissiveMap = masks.get(material.map);
      material.emissive.setHex(config.emissiveColor);
      material.emissiveIntensity = config.emissiveIntensityIdle;
      material.roughness = 0.82;
      material.metalness = 0.22;
      material.needsUpdate = true;
      materials.add(material);
    }
  };
  const tick = (now: number) => {
    if (disposed) return;
    const intensity = cosmeticIntensity(config, state, now / 1000, Math.max(0, (now - landedAt) / 1000), motion.matches);
    for (const material of materials) material.emissiveIntensity = intensity;
    // Physics already renders rolling frames; 0.0.12 stops rendering at rest.
    if (state !== "rolling" && !document.hidden) box.renderer?.render(box.scene, box.camera);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return {
    setState(next) {
      state = next;
      landedAt = performance.now();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      hook.active = undefined;
      factory.__vividCosmeticActive = false;
      // Only dispose textures we created, never engine-owned face textures.
      for (const mask of masks.values()) mask.dispose();
      masks.clear();
      materials.clear();
    },
  };
}

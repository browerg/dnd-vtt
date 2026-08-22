import DiceBox from "@3d-dice/dice-box-threejs";
import type { RollDetail } from "./api";
import { applyDiceBoxCustomization, decodeDiceCustomization } from "./diceCustomization";

// 3D dice are pure theater: the server already decided the results, and the
// notation's "@" suffix forces the dice to land on exactly those faces.

const SUPPORTED_SIDES = new Set([2, 4, 6, 8, 10, 12, 20, 100]);
const MAX_ANIMATED_DICE = 20;
const LINGER_MS = 700;
const ANIMATION_TIMEOUT_MS = 6000;
const CRITICAL_EVENT = "tabletop:critical-roll";

type CriticalRollKind = "nat20" | "nat1";

interface RollAnimationMeta {
  userName?: string;
  label?: string;
}

interface QueueEntry {
  notation: string;
  theme: string;
  critical: CriticalRollKind | null;
  meta: RollAnimationMeta;
  onLanded: () => void;
}

let box: DiceBox | null = null;
let ready: Promise<void> | null = null;
let running = false;
let currentAppearance = "white";
const queue: QueueEntry[] = [];
interface DiceTrailPoint {
  x: number;
  y: number;
  bornAt: number;
}

interface DiceTrailDie {
  position?: { x: number; y: number; z: number };
}

interface DiceTrailMatrix {
  elements?: number[];
}

interface DiceTrailCamera {
  projectionMatrix?: DiceTrailMatrix;
  matrixWorldInverse?: DiceTrailMatrix;
}

interface DiceTrailRenderer {
  domElement?: HTMLCanvasElement;
}

interface DiceBoxTrailInternals {
  diceList?: DiceTrailDie[];
  camera?: DiceTrailCamera;
  renderer?: DiceTrailRenderer;
}

export type DiceTrailStyle =
  | "aura"
  | "ember"
  | "frost"
  | "shadow"
  | "lightning"
  | "petals";

const TRAIL_STYLE_STORAGE_KEY = "vivid:diceTrailStyle";
const TRAIL_LIFETIME_MS = 620;
const TRAIL_MAX_POINTS = 28;
const TRAIL_SAMPLE_MS = 18;

const TRAIL_LABELS: Record<DiceTrailStyle, string> = {
  aura: "Aura Glow",
  ember: "Ember",
  frost: "Frost",
  shadow: "Shadow",
  lightning: "Lightning",
  petals: "Rose Petals",
};

const TRAIL_COLORS: Record<DiceTrailStyle, { core: string; glow: string }> = {
  aura: { core: "235, 252, 255", glow: "116, 231, 255" },
  ember: { core: "255, 238, 190", glow: "255, 105, 45" },
  frost: { core: "240, 250, 255", glow: "120, 200, 255" },
  shadow: { core: "210, 180, 255", glow: "120, 70, 185" },
  lightning: { core: "255, 255, 255", glow: "155, 210, 255" },
  petals: { core: "255, 210, 225", glow: "220, 45, 95" },
};
const TRAIL_SPRITE_URLS: Partial<Record<DiceTrailStyle, string[]>> = {
  aura: [
    "/assets/dice-vfx/aura_magic.png",
    "/assets/dice-vfx/aura_glow.png",
  ],
  ember: [
    "/assets/dice-vfx/ember_fire.png",
    "/assets/dice-vfx/ember_flame.png",
  ],
  frost: [
    "/assets/dice-vfx/frost_star.png",
    "/assets/dice-vfx/frost_glow.png",
  ],
  shadow: [
    "/assets/dice-vfx/shadow_smoke_small.png",
    "/assets/dice-vfx/shadow_smoke_large.png",
  ],
  lightning: [
    "/assets/dice-vfx/lightning_bolt.png",
    "/assets/dice-vfx/lightning_arc.png",
  ],
};

interface TrailSpriteParticle {
  image: HTMLImageElement | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornAt: number;
  life: number;
  size: number;
  rotation: number;
  spin: number;
  opacity: number;
  style: DiceTrailStyle;
}

const trailImageCache = new Map<string, HTMLImageElement>();

function trailImage(url: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  const cached = trailImageCache.get(url);
  if (cached) return cached;

  const image = new Image();
  image.src = url;
  trailImageCache.set(url, image);
  return image;
}

function warmTrailImages(): void {
  Object.values(TRAIL_SPRITE_URLS).forEach((urls) => {
    urls?.forEach((url) => trailImage(url));
  });
}

warmTrailImages();

function isTrailStyle(value: string | null): value is DiceTrailStyle {
  return !!value && value in TRAIL_LABELS;
}

export function getDiceTrailStyle(): DiceTrailStyle {
  const saved = localStorage.getItem(TRAIL_STYLE_STORAGE_KEY);
  return isTrailStyle(saved) ? saved : "aura";
}

export function setDiceTrailStyle(style: DiceTrailStyle): void {
  localStorage.setItem(TRAIL_STYLE_STORAGE_KEY, style);
  window.dispatchEvent(new CustomEvent("tabletop:dice-trail-style", { detail: { style } }));
}

export function getDiceTrailOptions(): { value: DiceTrailStyle; label: string }[] {
  return Object.entries(TRAIL_LABELS).map(([value, label]) => ({
    value: value as DiceTrailStyle,
    label,
  }));
}

function multiplyMat4Vec4(
  m: number[],
  x: number,
  y: number,
  z: number,
  w: number
): [number, number, number, number] {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w,
  ];
}

function projectTrailPoint(
  die: DiceTrailDie,
  camera: DiceTrailCamera,
  viewport: DOMRect,
  overlayRect: DOMRect
): { x: number; y: number } | null {
  const p = die.position;
  const view = camera.matrixWorldInverse?.elements;
  const projection = camera.projectionMatrix?.elements;
  if (!p || !view || !projection || view.length < 16 || projection.length < 16) return null;

  const cameraSpace = multiplyMat4Vec4(view, p.x, p.y, p.z, 1);
  const clip = multiplyMat4Vec4(
    projection,
    cameraSpace[0],
    cameraSpace[1],
    cameraSpace[2],
    cameraSpace[3]
  );

  if (!Number.isFinite(clip[3]) || Math.abs(clip[3]) < 0.00001 || clip[3] <= 0) return null;

  const ndcX = clip[0] / clip[3];
  const ndcY = clip[1] / clip[3];
  if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return null;

  const screenX = viewport.left + (ndcX * 0.5 + 0.5) * viewport.width;
  const screenY = viewport.top + (-ndcY * 0.5 + 0.5) * viewport.height;

  return {
    x: screenX - overlayRect.left,
    y: screenY - overlayRect.top,
  };
}

function getTrailCanvas(): HTMLCanvasElement | null {
  const host = document.querySelector<HTMLElement>("#dice-overlay");
  if (!host) return null;

  let canvas = host.querySelector<HTMLCanvasElement>("#dice-trail-overlay");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "dice-trail-overlay";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "2";
    canvas.style.mixBlendMode = "screen";
    host.appendChild(canvas);
  }
  return canvas;
}

function sizeTrailCanvas(canvas: HTMLCanvasElement): number {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return dpr;
}

function drawSegment(
  context: CanvasRenderingContext2D,
  style: DiceTrailStyle,
  a: DiceTrailPoint,
  b: DiceTrailPoint,
  alpha: number
): void {
  const palette = TRAIL_COLORS[style];

  let ax = a.x;
  let ay = a.y;
  let bx = b.x;
  let by = b.y;

  if (style === "lightning") {
    const jitter = 5 * alpha;
    ax += (Math.random() - 0.5) * jitter;
    ay += (Math.random() - 0.5) * jitter;
    bx += (Math.random() - 0.5) * jitter;
    by += (Math.random() - 0.5) * jitter;
  }

  context.beginPath();
  context.moveTo(ax, ay);
  context.lineTo(bx, by);
  context.lineCap = "round";
  context.lineWidth = style === "shadow" ? 11 * alpha + 2 : 8 * alpha + 1.5;
  context.strokeStyle = `rgba(${palette.glow}, ${0.18 * alpha})`;
  context.shadowColor = `rgba(${palette.glow}, ${0.95 * alpha})`;
  context.shadowBlur = style === "shadow" ? 24 : 18;
  context.stroke();

  context.beginPath();
  context.moveTo(ax, ay);
  context.lineTo(bx, by);
  context.lineWidth = style === "lightning" ? 1.4 * alpha + 0.7 : 2.2 * alpha + 0.5;
  context.strokeStyle = `rgba(${palette.core}, ${0.9 * alpha})`;
  context.shadowBlur = style === "lightning" ? 12 : 8;
  context.stroke();
}

function spawnTrailSprites(
  style: DiceTrailStyle,
  point: Pick<DiceTrailPoint, "x" | "y">,
  now: number,
  particles: TrailSpriteParticle[]
): void {
  if (style === "petals") {
    const count = Math.random() < 0.72 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      particles.push({
        image: null,
        x: point.x + (Math.random() - 0.5) * 8,
        y: point.y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 28,
        vy: 18 + Math.random() * 32,
        bornAt: now,
        life: 620 + Math.random() * 260,
        size: 5 + Math.random() * 4,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 5,
        opacity: 0.9,
        style,
      });
    }
    return;
  }

  const urls = TRAIL_SPRITE_URLS[style];
  if (!urls?.length) return;

  const chance =
    style === "shadow" ? 0.62 :
    style === "ember" ? 0.78 :
    style === "frost" ? 0.55 :
    style === "lightning" ? 0.42 :
    0.45;

  if (Math.random() > chance) return;

  const count = style === "ember" && Math.random() < 0.25 ? 2 : 1;

  for (let i = 0; i < count; i++) {
    const url = urls[Math.floor(Math.random() * urls.length)];
    const image = trailImage(url);

    let size = 24;
    let life = 450;
    let vx = (Math.random() - 0.5) * 22;
    let vy = (Math.random() - 0.5) * 22;
    let opacity = 0.8;

    if (style === "aura") {
      size = 24 + Math.random() * 20;
      life = 360 + Math.random() * 180;
      opacity = 0.62;
    } else if (style === "ember") {
      size = 18 + Math.random() * 22;
      life = 380 + Math.random() * 260;
      vx = (Math.random() - 0.5) * 35;
      vy = -18 - Math.random() * 40;
      opacity = 0.9;
    } else if (style === "frost") {
      size = 13 + Math.random() * 19;
      life = 520 + Math.random() * 300;
      vx = (Math.random() - 0.5) * 24;
      vy = 5 + Math.random() * 18;
      opacity = 0.78;
    } else if (style === "shadow") {
      size = 32 + Math.random() * 34;
      life = 650 + Math.random() * 320;
      vx = (Math.random() - 0.5) * 18;
      vy = -8 - Math.random() * 16;
      opacity = 0.46;
    } else if (style === "lightning") {
      size = 25 + Math.random() * 34;
      life = 160 + Math.random() * 170;
      vx = (Math.random() - 0.5) * 14;
      vy = (Math.random() - 0.5) * 14;
      opacity = 0.92;
    }

    particles.push({
      image,
      x: point.x + (Math.random() - 0.5) * 7,
      y: point.y + (Math.random() - 0.5) * 7,
      vx,
      vy,
      bornAt: now,
      life,
      size,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * (style === "shadow" ? 1.3 : 3.2),
      opacity,
      style,
    });
  }

  if (particles.length > 420) {
    particles.splice(0, particles.length - 420);
  }
}

function drawTrailSprites(
  context: CanvasRenderingContext2D,
  now: number,
  particles: TrailSpriteParticle[]
): boolean {
  let visible = false;

  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    const age = now - particle.bornAt;

    if (age >= particle.life) {
      particles.splice(i, 1);
      continue;
    }

    visible = true;
    const t = age / particle.life;
    const fade = Math.sin(Math.PI * Math.min(1, t));
    const x = particle.x + particle.vx * (age / 1000);
    const y = particle.y + particle.vy * (age / 1000);
    const rotation = particle.rotation + particle.spin * (age / 1000);

    let scale = 1;
    if (particle.style === "shadow") scale = 0.75 + t * 0.9;
    else if (particle.style === "ember") scale = 1 - t * 0.35;
    else if (particle.style === "frost") scale = 0.75 + t * 0.25;
    else if (particle.style === "lightning") scale = 1 - t * 0.2;
    else if (particle.style === "aura") scale = 0.72 + t * 0.45;

    const size = particle.size * Math.max(0.25, scale);

    context.save();
    context.globalAlpha = particle.opacity * fade;
    context.translate(x, y);
    context.rotate(rotation);

    if (particle.style === "petals") {
      context.fillStyle = "rgb(235, 70, 115)";
      context.shadowColor = "rgba(255, 110, 155, .7)";
      context.shadowBlur = 8;
      context.beginPath();
      context.ellipse(0, 0, size * 0.65, size * 0.3, 0, 0, Math.PI * 2);
      context.fill();
    } else if (particle.image?.complete && particle.image.naturalWidth > 0) {
      if (particle.style === "aura" || particle.style === "lightning") {
        context.globalCompositeOperation = "screen";
      }
      context.drawImage(particle.image, -size / 2, -size / 2, size, size);
    }

    context.restore();
  }

  return visible;
}
function startDiceTrail(diceBox: DiceBox): () => void {
  const style = getDiceTrailStyle();
  const internals = diceBox as unknown as DiceBoxTrailInternals;
  const canvas = getTrailCanvas();
  const rendererCanvas = internals.renderer?.domElement;
  const camera = internals.camera;
  if (!canvas || !rendererCanvas || !camera) return () => {};

  const context = canvas.getContext("2d");
  if (!context) return () => {};

  const trails = new Map<DiceTrailDie, DiceTrailPoint[]>();
  const particles: TrailSpriteParticle[] = [];
  let active = true;
  let lastSampleAt = 0;

  const drawFrame = (now: number) => {
    const dpr = sizeTrailCanvas(canvas);
    const overlayRect = canvas.getBoundingClientRect();
    const viewport = rendererCanvas.getBoundingClientRect();

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, overlayRect.width, overlayRect.height);

    const dice = internals.diceList || [];

    if (active && now - lastSampleAt >= TRAIL_SAMPLE_MS) {
      lastSampleAt = now;

      for (const die of dice) {
        const projected = projectTrailPoint(die, camera, viewport, overlayRect);
        if (!projected) continue;

        const points = trails.get(die) || [];
        const previous = points.at(-1);

        if (!previous || Math.hypot(projected.x - previous.x, projected.y - previous.y) >= 1.25) {
          points.push({ ...projected, bornAt: now });
          while (points.length > TRAIL_MAX_POINTS) points.shift();
          trails.set(die, points);
          spawnTrailSprites(style, projected, now, particles);
        }
      }
    }

    let hasVisibleTrail = false;

    for (const [die, points] of trails) {
      while (points.length && now - points[0].bornAt > TRAIL_LIFETIME_MS) points.shift();
      if (points.length < 2) {
        if (!points.length) trails.delete(die);
        continue;
      }

      hasVisibleTrail = true;

      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const alpha = Math.max(0, 1 - (now - b.bornAt) / TRAIL_LIFETIME_MS);
        if (alpha <= 0) continue;

        // Sprite-driven effects carry most of the look now. Keep a subtle
        // connecting ribbon for readability at high dice speeds.
        drawSegment(context, style, a, b, alpha * (style === "shadow" ? 0.38 : 0.62));
      }
    }

    context.shadowBlur = 0;
    const hasVisibleSprites = drawTrailSprites(context, now, particles);

    if (active || hasVisibleTrail || hasVisibleSprites) {
      requestAnimationFrame(drawFrame);
    } else {
      context.clearRect(0, 0, overlayRect.width, overlayRect.height);
    }
  };

  requestAnimationFrame(drawFrame);
  return () => { active = false; };
}
function ensureBox(): Promise<void> {
  if (!ready) {
    box = new DiceBox("#dice-overlay", {
      assetPath: "/assets/dice/",
      sounds: true,
      volume: 60,
      theme_surface: "green-felt",
      theme_colorset: "white",
      theme_material: "plastic",
      shadows: true,
      light_intensity: 0.9,
      gravity_multiplier: 400,
      baseScale: 100,
    });
    ready = box.initialize();
  }
  return ready;
}
export function preloadDice(): Promise<void> {
  return ensureBox();
}

export async function animateRollAt(
  detail: RollDetail,
  serverStartAt: number | undefined,
  serverClockOffsetMs: number,
  theme?: string,
  meta: RollAnimationMeta = {}
): Promise<void> {
  if (serverStartAt && Number.isFinite(serverStartAt)) {
    const localStartAt = serverStartAt - serverClockOffsetMs;
    const waitMs = localStartAt - Date.now();
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  return animateRoll(detail, theme, meta);
}

export function notationFor(detail: RollDetail): string | null {
  const { groups } = detail.kept;
  if (groups.some((group) => !SUPPORTED_SIDES.has(group.sides))) return null;
  // A d100 renders as a percentile pair (tens die + units die), so it costs two dice.
  const diceCount = groups.reduce(
    (count, group) => count + group.count * (group.sides === 100 ? 2 : 1),
    0
  );
  if (diceCount === 0 || diceCount > MAX_ANIMATED_DICE) return null;

  // The library applies forced values to dice in spawn order and silently
  // ignores values that aren't a legal face (a d100 tens die only has faces
  // 10..90 and 00). It also merges same-type notation sets, which would
  // scramble value order -- so emit exactly one set per die type ourselves.
  const faces = new Map<number, number[]>();
  const push = (sides: number, value: number) => {
    if (!faces.has(sides)) faces.set(sides, []);
    faces.get(sides)!.push(value);
  };

  for (const group of groups) {
    for (const result of group.results) {
      if (group.sides === 100) {
        const units = result % 10;
        push(100, result - units);
        push(10, units);
      } else {
        push(group.sides, result);
      }
    }
  }

  const sets = [...faces.entries()]
    .map(([sides, values]) => `${values.length}d${sides}`)
    .join("+");
  const forced = [...faces.values()].flat().join(",");
  return `${sets}@${forced}`;
}

function criticalFor(detail: RollDetail): CriticalRollKind | null {
  if (detail.manual) return null;

  const d20Results = detail.kept.groups
    .filter((group) => group.sides === 20)
    .flatMap((group) => group.results);

  if (d20Results.includes(20)) return "nat20";
  if (d20Results.includes(1)) return "nat1";
  return null;
}

function announceCritical(entry: QueueEntry) {
  if (!entry.critical) return;
  window.dispatchEvent(
    new CustomEvent(CRITICAL_EVENT, {
      detail: {
        kind: entry.critical,
        userName: entry.meta.userName,
        label: entry.meta.label,
      },
    })
  );
}

// Resolves once this roll's dice have landed and stand still (callers hold
// the feed entry back until then). Resolves immediately when the roll won't
// animate -- hidden tab, unsupported dice, or a busy table.
// `theme` is the roller's colorset, so everyone sees Susy roll HER dice.
export function animateRoll(
  detail: RollDetail,
  theme?: string,
  meta: RollAnimationMeta = {}
): Promise<void> {
  if (document.hidden) return Promise.resolve();

  const notation = notationFor(detail);
  if (!notation) return Promise.resolve();

  const entry: QueueEntry = {
    notation,
    theme: theme || "white",
    critical: criticalFor(detail),
    meta,
    onLanded: () => {},
  };

  if (queue.length >= 3) {
    announceCritical(entry);
    return Promise.resolve();
  }

  return new Promise((onLanded) => {
    queue.push({ ...entry, onLanded });
    if (!running) void drain();
  });
}

// Customize page: throw a themed set with random results, just to look at.
export function previewDice(theme: string): Promise<void> {
  if (document.hidden) return Promise.resolve();
  if (queue.length >= 3) return Promise.resolve();

  return new Promise((onLanded) => {
    queue.push({
      notation: "2d10+1d6",
      theme: theme || "white",
      critical: null,
      meta: {},
      onLanded,
    });
    if (!running) void drain();
  });
}

async function drain(): Promise<void> {
  running = true;
  try {
    await ensureBox();
    let entry: QueueEntry | undefined;

    while ((entry = queue.shift())) {
      try {
        if (entry.theme !== currentAppearance) {
          const customization = decodeDiceCustomization(entry.theme);
          if (customization) {
            await applyDiceBoxCustomization(box!, customization);
          } else {
            await box!.updateConfig({
              theme_customColorset: null,
              theme_colorset: entry.theme || "white",
            });
          }
          currentAppearance = entry.theme;
        }

        // If the tab loses visibility mid-roll the physics stalls; don't let
        // one stuck animation wedge the queue forever.
        const rollPromise = box!.roll(entry.notation);
        const stopTrail = startDiceTrail(box!);

        try {
          await Promise.race([
            rollPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("animation timeout")), ANIMATION_TIMEOUT_MS)
            ),
          ]);
        } finally {
          stopTrail();
        }

        announceCritical(entry);
        entry.onLanded();
        await new Promise((resolve) => setTimeout(resolve, LINGER_MS));
      } catch (error) {
        console.error("dice animation failed", error);
        announceCritical(entry);
        entry.onLanded();
      }

      box!.clearDice();
    }
  } finally {
    running = false;
  }
}






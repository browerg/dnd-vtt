import type { DiceCosmetic } from "./diceCosmetics.js";

export type GrimmDiceSurface = "grimm-awakening";

// Every face wears a Grimm mask: a bone brow above the number with two eye
// holes the shader lights. Pale bone lights itself (the glyph guard treats it
// as ink); the eye holes, red markings and black stone carry the moving light.
// Canvas y runs down while UV y runs up, so "above the number" is negative y here.
function grimmTexture(): HTMLCanvasElement {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#060407"; c.fillRect(0, 0, 512, 512);
  c.translate(256, 256);
  let seed = 41;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  // Ember-dark speckle so the stone is not a flat fill.
  for (let i = 0; i < 320; i++) {
    const a = random() * Math.PI * 2, r = 20 + random() * 250;
    c.fillStyle = i % 5 === 0 ? "#3a0a10" : "#161017";
    c.fillRect(Math.cos(a) * r, Math.sin(a) * r, 2, 2);
  }
  // The mask: a crested brow that sweeps down into cheek spikes beside the number.
  c.beginPath();
  c.moveTo(-178, -40);
  c.lineTo(-150, -118); c.lineTo(-176, -170); c.lineTo(-120, -160);
  c.lineTo(-96, -226); c.lineTo(-60, -182); c.lineTo(-30, -248); c.lineTo(0, -196);
  c.lineTo(30, -248); c.lineTo(60, -182); c.lineTo(96, -226); c.lineTo(120, -160);
  c.lineTo(176, -170); c.lineTo(150, -118); c.lineTo(178, -40);
  c.lineTo(124, -78); c.quadraticCurveTo(70, -104, 30, -96); c.lineTo(0, -112); c.lineTo(-30, -96);
  c.quadraticCurveTo(-70, -104, -124, -78); c.closePath();
  const bone = c.createLinearGradient(0, -248, 0, -40);
  bone.addColorStop(0, "#a69c8f"); bone.addColorStop(.45, "#e8e1d4"); bone.addColorStop(1, "#b4ab9e");
  c.fillStyle = bone; c.fill();
  c.strokeStyle = "#1a0b0f"; c.lineWidth = 4; c.stroke();
  // Red Grimm markings: a forehead spike and claws sweeping off each eye.
  c.strokeStyle = "#8c0c1b"; c.lineCap = "round"; c.lineJoin = "round";
  c.lineWidth = 7; c.beginPath(); c.moveTo(0, -128); c.lineTo(-12, -170); c.lineTo(0, -214); c.lineTo(12, -170); c.closePath(); c.stroke();
  for (const side of [-1, 1]) {
    c.lineWidth = 6;
    c.beginPath(); c.moveTo(side * 126, -160); c.quadraticCurveTo(side * 150, -160, side * 166, -136); c.stroke();
    c.lineWidth = 4;
    c.beginPath(); c.moveTo(side * 118, -128); c.quadraticCurveTo(side * 140, -104, side * 150, -70); c.stroke();
    // Almond eye hole, slanted down toward the centre.
    c.save(); c.translate(side * 78, -150); c.rotate(side * -.32);
    c.beginPath(); c.ellipse(0, 0, 50, 21, 0, 0, Math.PI * 2);
    c.fillStyle = "#14030a"; c.fill(); c.strokeStyle = "#2b0910"; c.lineWidth = 3; c.stroke();
    c.restore();
  }
  // Hairline cracks so the bone reads as old, not plastic.
  c.strokeStyle = "#7a7064"; c.lineWidth = 1.2;
  for (let k = 0; k < 9; k++) {
    const x = (random() - .5) * 260, y = -120 - random() * 90;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + (random() - .5) * 22, y - 8 - random() * 16); c.lineTo(x + (random() - .5) * 30, y - 20 - random() * 12); c.stroke();
  }
  const quiet = c.createRadialGradient(0, 0, 52, 0, 0, 116);
  quiet.addColorStop(0, "#060407"); quiet.addColorStop(1, "transparent");
  c.fillStyle = quiet; c.fillRect(-256, -256, 512, 512);
  return canvas;
}

export const GRIMM_DICE: DiceCosmetic = {
  id: "grimm-awakening", label: "Grimm Awakening", surface: "grimm-awakening",
  baseColor: "#0a0709", numberColor: "#f3ede3", edgeColor: "#5a121c", roughness: .4, metalness: .45,
  emissiveColor: 0xff2236, emissiveIntensityIdle: .3, emissiveIntensityRolling: .95, pulseSpeedIdle: .9, pulseSpeedRolling: 3.4,
  trailId: "grimm", signatureTrail: true, nat20EffectId: "",
  createTexture: grimmTexture,
  // Only the red markings feed the base emissive pulse; bone and stone stay put.
  emissionStrength: (r, g, b) => Math.max(0, (r - Math.max(g, b) - 40) / 160),
};

interface Mark { x: number; y: number; born: number; angle: number; seed: number }
interface Burst { x: number; y: number; born: number; seed: number }
const MARK_LIFE = 1050;
const BURST_LIFE = 900;

/** Grimm dissolve: the path sheds black flakes and smoke, with eyes that blink
 * open inside it. Deterministic per mark (no per-frame randomness), bounded. */
export function createGrimmTrail() {
  const marks: Mark[] = [];
  const bursts: Burst[] = [];
  const previous = new Map<object, { x: number; y: number }>();
  let sequence = 0;
  const flake = (ctx: CanvasRenderingContext2D, size: number, heat: number) => {
    ctx.beginPath(); ctx.moveTo(-size, -size * .3); ctx.lineTo(-size * .2, -size); ctx.lineTo(size, -size * .2);
    ctx.lineTo(size * .3, size * .8); ctx.closePath();
    ctx.fillStyle = "#0c070a"; ctx.fill();
    ctx.strokeStyle = `rgba(255, 40, 60, ${.35 + heat * .6})`; ctx.shadowColor = "#ff1f3d"; ctx.shadowBlur = 6 * heat; ctx.lineWidth = 1.1; ctx.stroke();
  };
  const eyes = (ctx: CanvasRenderingContext2D, open: number, scale: number) => {
    ctx.fillStyle = "#ff3347"; ctx.shadowColor = "#ff0a2a"; ctx.shadowBlur = 10 * open;
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(side * 7 * scale, 0); ctx.rotate(side * .38);
      ctx.beginPath(); ctx.ellipse(0, 0, 6 * scale, (.4 + open * 2.6) * scale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  };
  return {
    sample(die: object, point: { x: number; y: number }, now: number) {
      const last = previous.get(die);
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < 18) return;
      marks.push({ ...point, born: now, angle: last ? Math.atan2(point.y - last.y, point.x - last.x) : 0, seed: sequence++ });
      previous.set(die, point);
      if (marks.length > 120) marks.splice(0, marks.length - 120);
    },
    /** Final resting positions: each die lands with a crimson shockwave. */
    land(points: { x: number; y: number }[], now: number) {
      for (const point of points.slice(0, 8)) bursts.push({ ...point, born: now, seed: sequence++ });
    },
    draw(ctx: CanvasRenderingContext2D, now: number) {
      while (marks.length && now - marks[0].born >= MARK_LIFE) marks.shift();
      while (bursts.length && now - bursts[0].born >= BURST_LIFE) bursts.shift();
      for (const mark of marks) {
        const t = Math.max(0, (now - mark.born) / MARK_LIFE);
        const fade = Math.min(1, t * 10) * (1 - t) ** .8;
        const heat = Math.max(0, 1 - t * 1.6);
        ctx.save(); ctx.translate(mark.x, mark.y); ctx.globalAlpha = fade;
        // A curl of Grimm smoke lifting off the path, lit red from inside.
        const curl = (mark.seed % 2 ? 1 : -1);
        ctx.save(); ctx.rotate(mark.angle + Math.PI);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.bezierCurveTo(10, curl * (6 + t * 18), 22, -curl * (4 + t * 10), 30 + t * 14, curl * t * 22);
        ctx.strokeStyle = "rgba(18, 6, 10, .85)"; ctx.lineWidth = 9 * (1 - t) + 2; ctx.lineCap = "round";
        ctx.shadowColor = "rgba(255, 20, 50, .9)"; ctx.shadowBlur = 12 * heat; ctx.stroke();
        ctx.restore();
        // Flakes peel away and drift upward as the Grimm come apart.
        for (let k = 0; k < 3; k++) {
          const spread = ((mark.seed * 7 + k * 13) % 11) / 11 - .5;
          const dir = mark.angle + Math.PI + spread * 2.2;
          const distance = t * (22 + ((mark.seed + k * 5) % 7) * 6);
          ctx.save();
          ctx.translate(Math.cos(dir) * distance, Math.sin(dir) * distance - t * t * 46);
          ctx.rotate(mark.seed + k + t * (3 + k));
          flake(ctx, (4 + ((mark.seed + k) % 3) * 2) * (1 - t * .4), heat);
          ctx.restore();
        }
        // Every fifth mark, a pair of eyes opens in the smoke and closes again.
        if (mark.seed % 5 === 0) {
          ctx.save(); ctx.translate(0, -14 - t * 26);
          eyes(ctx, Math.sin(Math.min(1, t * 1.4) * Math.PI), .9);
          ctx.restore();
        }
        ctx.restore();
      }
      for (const burst of bursts) {
        // rAF timestamps can trail performance.now(), so clamp the first frame.
        const t = Math.min(1, Math.max(0, (now - burst.born) / BURST_LIFE));
        const ease = 1 - (1 - t) ** 3;
        ctx.save(); ctx.translate(burst.x, burst.y);
        ctx.globalAlpha = (1 - t) ** 1.5;
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 30 + ease * 50);
        glow.addColorStop(0, "rgba(255, 30, 60, .45)"); glow.addColorStop(1, "rgba(255, 30, 60, 0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 30 + ease * 50, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#ff3a4f"; ctx.shadowColor = "#ff0a2a"; ctx.shadowBlur = 16;
        ctx.lineWidth = 3.5 * (1 - t) + .5;
        ctx.beginPath(); ctx.ellipse(0, 0, 14 + ease * 78, (14 + ease * 78) * .55, 0, 0, Math.PI * 2); ctx.stroke();
        for (let k = 0; k < 10; k++) {
          const a = k * Math.PI / 5 + burst.seed;
          ctx.save(); ctx.translate(Math.cos(a) * ease * 64, Math.sin(a) * ease * 40 - t * t * 30);
          ctx.rotate(a + t * 4); flake(ctx, 5 * (1 - t * .5), 1 - t);
          ctx.restore();
        }
        ctx.restore();
      }
      return marks.length > 0 || bursts.length > 0;
    },
    clear() { marks.length = 0; bursts.length = 0; previous.clear(); },
  };
}

export const GRIMM_SURFACE_GLSL: Record<GrimmDiceSurface, string> = {
  "grimm-awakening": `
    float r = length(p);
    // Throw energy, plus a short surge the moment the dice come to rest.
    float surge = exp(-vividLand * 3.2);
    float energy = clamp(vividRoll + surge * 1.1, 0.0, 1.6);
    // Grimm red; a natural 20 floods it with silver-eyed light.
    vec3 deep = mix(vec3(.55, .0, .03), vec3(.35, .45, .7), vividCrit);
    vec3 hot = mix(vec3(1.0, .05, .09), vec3(.85, .93, 1.0), vividCrit);
    vec3 core = mix(vec3(1.0, .5, .4), vec3(1.0), vividCrit);
    // Like First Flame's fissures: three warped crack families split the black
    // stone into plates, and red light flows through every seam on the face.
    vec2 rock = p * 7.5;
    float warp = sin(rock.x * .61 - rock.y * .43) * .7;
    float seamA = abs(sin(rock.x * .9 + warp));
    float seamB = abs(sin(rock.y - warp * .8));
    float seamC = abs(sin((rock.x - rock.y) * .7 + 2.3));
    float gap = min(seamA, min(seamB, seamC)) * .5;
    float crack = 1.0 - smoothstep(.02, .15, gap);
    // A slow heartbeat: two quick pulses, then rest — sped up while rolling.
    float beatTime = vividTime * (1.1 + energy * 1.6);
    float beat = pow(max(sin(beatTime * 3.14159), 0.0), 12.0) + .6 * pow(max(sin(beatTime * 3.14159 - .9), 0.0), 12.0);
    float flow = .5 + .5 * sin(p.y * 17.0 + vividTime * 1.7 + sin(p.x * 13.0 - vividTime * .7) * 2.0);
    vividLight = mix(deep, hot, flow) * crack * (.16 + flow * .3 + beat * .55 + energy * 1.1);
    vividLight += core * pow(crack, 6.0) * (beat * .3 + energy * .6) * flow;
    vividLight += deep * exp(-abs(gap - .11) * 40.0) * (.25 + energy * .35);
    // Two eyes in the mask: narrow slits at rest, blazing wide while rolling.
    float open = mix(.18, 1.0, clamp(energy, 0.0, 1.0));
    for (int i = 0; i < 2; i++) {
      float side = float(i) * 2.0 - 1.0;
      vec2 e = p - vec2(side * .152, .293);
      float tilt = side * .32;
      e = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * e;
      vec2 shape = e / vec2(.094, .005 + .034 * open);
      float d = dot(shape, shape);
      float lit = 1.0 - smoothstep(.5, 1.0, d);
      float pupil = (1.0 - smoothstep(.0, .3, d)) * open;
      float halo = exp(-d * .3) * (.3 + energy * 1.1 + beat * .3);
      vividLight += hot * (lit * (1.6 + energy * 1.5) + halo) + core * pupil * 1.2;
    }
    // Landing: a crimson shockwave rolls out from under the number.
    float ring = .14 + min(vividLand, 1.0) * .55;
    vividLight += hot * exp(-abs(r - ring) * 55.0) * exp(-vividLand * 3.0) * 1.8;
  `,
};

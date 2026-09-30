import type { DiceCosmetic } from "./diceCosmetics.js";

export type SpecialDiceSurface = "singularity" | "clockwork" | "prism" | "first-flame";

// These are authored materials, deliberately outside the customization encoder.
// Catalogue visibility is not an entitlement or a new cache reward.
export const SPECIAL_DICE: readonly DiceCosmetic[] = [
  {
    id: "event-horizon", label: "Event Horizon", surface: "singularity",
    baseColor: "#080512", numberColor: "#f1eaff", edgeColor: "#352450",
    emissiveColor: 0x9966ff, emissiveIntensityIdle: 0.5, emissiveIntensityRolling: 0.95,
    pulseSpeedIdle: 1, pulseSpeedRolling: 2, trailId: "shadow", nat20EffectId: "",
    roughness: 0.28, metalness: 0.65,
    createTexture: () => createSpecialTexture("singularity"), emissionStrength: (r, g, b) => Math.max(0, (b - g) / 255),
  },
  {
    id: "chronos-engine", label: "Chronos Engine", surface: "clockwork",
    baseColor: "#071815", numberColor: "#fff2cc", edgeColor: "#947449",
    emissiveColor: 0x66ffcc, emissiveIntensityIdle: 0.35, emissiveIntensityRolling: 0.8,
    pulseSpeedIdle: 0.8, pulseSpeedRolling: 2.4, trailId: "aura", nat20EffectId: "",
    roughness: 0.5, metalness: 0.8,
    createTexture: () => createSpecialTexture("clockwork"), emissionStrength: (r, g, b) => Math.max(0, (g - r) / 255),
  },
  {
    id: "prismatic-echo", label: "Prismatic Echo", surface: "prism",
    baseColor: "#111329", numberColor: "#ffffff", edgeColor: "#7e92b4",
    emissiveColor: 0x99ddff, emissiveIntensityIdle: 0.4, emissiveIntensityRolling: 0.8,
    pulseSpeedIdle: 1.2, pulseSpeedRolling: 2.8, trailId: "frost", nat20EffectId: "",
    roughness: 0.3, metalness: 0.55,
    createTexture: () => createSpecialTexture("prism"), emissionStrength: (r, g, b) => Math.max(0, (Math.max(r, g, b) - Math.min(r, g, b)) / 255),
  },
];

function createSpecialTexture(kind: SpecialDiceSurface): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = kind === "clockwork" ? "#071815" : "#0b091a";
  ctx.fillRect(0, 0, 512, 512);
  ctx.translate(256, 256);
  if (kind === "singularity") {
    for (let i = 0; i < 160; i++) {
      const a = i * 2.39996;
      const r = 110 + ((i * 73) % 230);
      ctx.fillStyle = i % 4 === 0 ? "#ba9dff" : "#514878";
      ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, i % 4 === 0 ? 2 : 1, 2);
    }
    for (let i = 0; i < 13; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 126 + i * 7, 100 + i * 5, -0.4, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${260 + i * 3}, 75%, ${65 - i * 2}%, ${0.75 - i * 0.045})`;
      ctx.lineWidth = i === 0 ? 4 : 1.5;
      ctx.stroke();
    }
  } else if (kind === "clockwork") {
    for (const r of [106, 122, 170, 188, 216]) {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = r === 170 ? "#4cba98" : "#967444";
      ctx.lineWidth = r === 170 ? 3 : 1.5; ctx.stroke();
    }
    for (let i = 0; i < 60; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 30);
      ctx.fillStyle = i % 5 === 0 ? "#e3bd77" : "#568c77";
      ctx.fillRect(-1.5, -208, 3, i % 5 === 0 ? 25 : 9);
      if (i % 3 === 0) { ctx.fillStyle = "#66d7ac"; ctx.fillRect(-3, -157, 6, 13); }
      ctx.restore();
    }
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 4);
      ctx.strokeStyle = "#9c7b48"; ctx.strokeRect(-9, -244, 18, 19); ctx.restore();
    }
  } else {
    // Interlocking crystal facets; a quiet center keeps all face values readable.
    for (let y = -300; y < 300; y += 64) for (let x = -320; x < 320; x += 64) {
      const offset = ((y + 300) / 64) % 2 ? 32 : 0;
      const px = x + offset;
      ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + 32, y + 64); ctx.lineTo(px - 32, y + 64); ctx.closePath();
      ctx.fillStyle = `hsl(${((x + y) * 0.4 + 600) % 360}, 45%, 18%)`;
      ctx.fill(); ctx.strokeStyle = "#687f9f"; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  const quiet = ctx.createRadialGradient(0, 0, 48, 0, 0, 108);
  quiet.addColorStop(0, kind === "clockwork" ? "#071815" : "#0b091a");
  quiet.addColorStop(1, "transparent");
  ctx.fillStyle = quiet; ctx.fillRect(-256, -256, 512, 512);
  return canvas;
}

/** Bounded per-fragment effects; no textures allocated or repainted per frame. */
export const SPECIAL_SURFACE_GLSL: Record<SpecialDiceSurface, string> = {
  "first-flame": `
    // A fractured obsidian crust above a moving molten core. Fixed fault lines
    // keep the stone stable while convection and embers move beneath it.
    // Three warped fault families form stable irregular plates with no
    // texture sampling or per-fragment neighbor search.
    vec2 rock = p * 10.0;
    float warp = sin(rock.x*.53 + rock.y*.37)*.65;
    float seamA = abs(sin(rock.x + warp));
    float seamB = abs(sin(rock.y*.92 - warp));
    float seamC = abs(sin((rock.x+rock.y)*.64 + 1.7));
    float gap = min(seamA,min(seamB,seamC))*.5;
    float fissure = 1.0 - smoothstep(0.025,0.17,gap);
    float convection = 0.5 + 0.5*sin(p.y*19.0 - vividTime*1.4 + sin(p.x*16.0+vividTime*.6)*2.0);
    float surge = pow(0.5+0.5*sin(p.x*8.0+p.y*11.0-vividTime*2.0),5.0);
    vec3 magma = mix(vec3(.68,.045,.003),vec3(1.0,.48,.055),convection);
    vec3 whiteHeat = vec3(1.0,.88,.43) * pow(fissure,4.0) * surge;
    vividLight = magma*fissure*(.5+convection*.7) + whiteHeat*.65;
    // Thin hot edges give the black plates depth without washing them out.
    vividLight += vec3(.35,.09,.018)*exp(-abs(gap-.12)*45.0)*(.35+convection*.4);
    // Three staggered ember streams inside the face, not extra scene particles.
    for (int i=0; i<3; i++) {
      float lane=float(i);
      float phase=fract(vividTime*.19+lane*.337);
      vec2 ember=vec2(sin(lane*7.3)*.34+sin(phase*5.0+lane)*.035,phase*.9-.45);
      vec2 delta=(p-ember)*vec2(1.0,.55);
      vividLight += vec3(1.0,.53,.12)*exp(-dot(delta,delta)*9000.0)*sin(phase*3.14159)*.85;
    }
  `,

  singularity: `
    float radius = length(p);
    float angle = atan(p.y, p.x);
    float orbit = exp(-abs(radius - 0.29) * 65.0);
    float spiral = pow(0.5 + 0.5 * sin(angle * 3.0 - radius * 35.0 - vividTime * 1.6), 5.0);
    float halo = exp(-abs(radius - 0.34) * 19.0) * spiral;
    vividLight = vec3(0.43, 0.13, 1.0) * (orbit * 0.7 + halo * 0.65);
  `,
  clockwork: `
    float radius = length(p);
    float angle = atan(p.y, p.x);
    float sweep = pow(0.5 + 0.5 * cos(angle - vividTime * 1.4), 24.0);
    float dial = exp(-abs(radius - 0.335) * 90.0);
    float teeth = pow(0.5 + 0.5 * cos(angle * 20.0 + vividTime * 0.7), 8.0);
    vividLight = vec3(0.1, 0.9, 0.62) * (dial * (0.15 + sweep) + teeth * exp(-abs(radius - 0.285) * 100.0) * 0.45);
  `,
  prism: `
    float bands = sin(p.x * 24.0 + p.y * 16.0 + vividTime * 0.65);
    vec3 spectrum = 0.5 + 0.5 * cos(vec3(0.0, 2.094, 4.188) + bands * 2.0 + vividTime * 0.45);
    float facets = pow(0.5 + 0.5 * sin(p.x * 50.0 - p.y * 29.0), 18.0);
    vividLight = spectrum * (0.2 + facets * 0.65);
  `,
};

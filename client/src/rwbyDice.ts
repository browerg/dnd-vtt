import type { DiceCosmetic } from "./diceCosmetics.js";
import { RWBY_DICE } from "../../shared/rwbyDice.js";

export type RwbyDiceSurface = "silver-eclipse" | "winter-glyph" | "ember-reactor";

// Face art is authored once. Moving light lives in bounded shaders, not canvas
// repaints or scene particles; physics, numbers and all die shapes stay native.
function faceTexture(kind: RwbyDiceSurface) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!;
  const ground = kind === "silver-eclipse" ? "#270811" : kind === "winter-glyph" ? "#091a34" : "#30241a";
  c.fillStyle = ground; c.fillRect(0, 0, 512, 512); c.translate(256, 256);
  if (kind === "silver-eclipse") {
    // Six folded scythe blades and petal-shaped lacquer recesses.
    for (let i = 0; i < 6; i++) {
      c.save(); c.rotate(i * Math.PI / 3);
      c.beginPath(); c.moveTo(115,-32); c.bezierCurveTo(155,-115,230,-124,245,-30);
      c.bezierCurveTo(199,-69,166,-45,149,11); c.lineTo(131,55); c.closePath();
      c.fillStyle="#8d233c"; c.fill(); c.strokeStyle="#c5cedb"; c.lineWidth=3; c.stroke();
      c.beginPath(); c.moveTo(153,-38); c.bezierCurveTo(183,-70,205,-62,214,-47); c.strokeStyle="#f27385"; c.lineWidth=2; c.stroke();
      c.restore();
    }
  } else if (kind === "winter-glyph") {
    for (const r of [108, 125, 174, 202, 224]) { c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.strokeStyle=r===174?"#8ed7ff":"#7e9dbf"; c.lineWidth=r===174?3:1.5; c.stroke(); }
    for (let i=0;i<12;i++) {
      c.save(); c.rotate(i*Math.PI/6);
      c.beginPath(); c.moveTo(0,-238); c.lineTo(17,-207); c.lineTo(6,-183); c.lineTo(0,-139); c.lineTo(-6,-183); c.lineTo(-17,-207); c.closePath();
      c.fillStyle=i%2===0?"#e4edf5":"#819fb8"; c.fill(); c.strokeStyle="#b7def6"; c.lineWidth=2; c.stroke();
      c.beginPath();c.moveTo(-25,-148);c.lineTo(0,-169);c.lineTo(25,-148);c.stroke(); c.restore();
    }
  } else {
    for(let i=0;i<8;i++) {
      c.save();c.rotate(i*Math.PI/4);
      c.beginPath();c.moveTo(-39,-242);c.lineTo(39,-242);c.lineTo(27,-152);c.lineTo(-27,-152);c.closePath();
      c.fillStyle="#62646d";c.fill();c.strokeStyle="#e4b660";c.lineWidth=3;c.stroke();
      for(let n=0;n<5;n++){c.fillStyle=n%2?"#be6c1e":"#edb653";c.fillRect(-22,-225+n*13,44,4);}
      for(const x of [-31,31]){c.beginPath();c.arc(x,-232,3,0,Math.PI*2);c.fillStyle="#e8c781";c.fill();}
      c.restore();
    }
    c.beginPath();c.arc(0,0,132,0,Math.PI*2);c.strokeStyle="#e8b75a";c.lineWidth=4;c.stroke();
  }
  const quiet=c.createRadialGradient(0,0,50,0,0,112);quiet.addColorStop(0,ground);quiet.addColorStop(1,"transparent");c.fillStyle=quiet;c.fillRect(-256,-256,512,512);
  return canvas;
}

export const RWBY_DICE_MATERIALS: readonly DiceCosmetic[] = [
  {
    id: RWBY_DICE[0].theme, label: RWBY_DICE[0].name, surface: "silver-eclipse",
    baseColor: "#360b19", numberColor: "#f4f6ff", edgeColor: "#bac8dc", roughness: .22, metalness: .65,
    emissiveColor: 0xeb5276, emissiveIntensityIdle: .22, emissiveIntensityRolling: .7, pulseSpeedIdle: .7, pulseSpeedRolling: 2,
    trailId: "petals", nat20EffectId: "", createTexture: () => faceTexture("silver-eclipse"), emissionStrength: (r,g,b)=>Math.max(0,(r-g-b*.2)/255)*.5,
  },
  {
    id: RWBY_DICE[1].theme, label: RWBY_DICE[1].name, surface: "winter-glyph",
    baseColor: "#102445", numberColor: "#f5faff", edgeColor: "#d6e6f5", roughness: .16, metalness: .32,
    emissiveColor: 0x6cbfff, emissiveIntensityIdle: .25, emissiveIntensityRolling: .65, pulseSpeedIdle: .8, pulseSpeedRolling: 1.8,
    trailId: "frost", nat20EffectId: "", createTexture: () => faceTexture("winter-glyph"), emissionStrength: (r,g,b)=>Math.max(0,(b-r)/255)*.4,
  },
  {
    id: RWBY_DICE[2].theme, label: RWBY_DICE[2].name, surface: "ember-reactor",
    baseColor: "#45414a", numberColor: "#fff2d4", edgeColor: "#e2b75f", roughness: .35, metalness: .6,
    emissiveColor: 0xffac32, emissiveIntensityIdle: .32, emissiveIntensityRolling: .8, pulseSpeedIdle: 1.2, pulseSpeedRolling: 3.2,
    trailId: "ember", nat20EffectId: "", createTexture: () => faceTexture("ember-reactor"), emissionStrength: (r,g,b)=>Math.max(0,(r-b)/255)*.5,
  },
];

export const RWBY_SURFACE_GLSL: Record<RwbyDiceSurface,string> = {
  "silver-eclipse": `
    float r=length(p), a=atan(p.y,p.x);
    float rose=exp(-abs(r-(.31+.025*cos(a*6.0-vividTime*.35)))*90.0);
    float silver=pow(max(0.0,cos(a-vividTime*.6)),18.0)*exp(-abs(r-.39)*90.0);
    vividLight=vec3(.72,.025,.12)*rose*.6+vec3(.72,.84,1.0)*silver*.8;
    for(int i=0;i<6;i++) {
      float k=float(i), phase=vividTime*.19+k*1.0472;
      vec2 center=vec2(cos(phase),sin(phase))*(.24+.025*sin(k*2.0+vividTime));
      vec2 d=p-center;float cs=cos(phase+.7),sn=sin(phase+.7);
      d=mat2(cs,-sn,sn,cs)*d;
      float petal=exp(-dot(d*vec2(1.0,2.8),d*vec2(1.0,2.8))*2600.0);
      vividLight+=vec3(1.0,.10,.23)*petal*.8;
    }
  `,
  "winter-glyph": `
    float r=length(p),a=atan(p.y,p.x);
    float outer=exp(-abs(r-.39)*130.0),inner=exp(-abs(r-.27)*110.0);
    float runes=pow(.5+.5*cos(a*12.0-vividTime*.65),20.0);
    float summon=pow(.5+.5*cos(a*6.0+vividTime*.45),28.0);
    float spokes=pow(.5+.5*cos(a*6.0-vividTime*.12),80.0)*smoothstep(.27,.34,r)*(1.0-smoothstep(.39,.43,r));
    vividLight=vec3(.25,.62,1.0)*(outer*(.1+runes*.8)+inner*(.12+summon*.65)+spokes*.35);
    vividLight+=vec3(.75,.9,1.0)*pow(.5+.5*sin(a*18.0+r*70.0-vividTime),40.0)*exp(-abs(r-.34)*85.0)*.3;
  `,
  "ember-reactor": `
    float r=length(p),a=atan(p.y,p.x);
    float beat=fract(vividTime*.32);
    float sector=floor((a+3.14159)/.785398);
    float charge=smoothstep(sector/8.0,sector/8.0+.12,beat);
    float vent=pow(.5+.5*cos(a*8.0),12.0)*smoothstep(.29,.32,r)*(1.0-smoothstep(.42,.46,r));
    float bars=pow(.5+.5*cos(r*190.0),8.0);
    float shock=exp(-abs(r-(.18+beat*.38))*120.0)*pow(1.0-beat,2.0);
    vividLight=mix(vec3(.8,.10,.005),vec3(1.0,.65,.12),charge)*vent*bars*(.18+charge*.75);
    vividLight+=vec3(1.0,.7,.2)*shock*.65;
  `,
};

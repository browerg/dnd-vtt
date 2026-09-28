export type SpecialTrailStyle = "riftwake" | "astral-script" | "prism-shatter";
export const isSpecialTrail = (style: string): style is SpecialTrailStyle =>
  style === "riftwake" || style === "astral-script" || style === "prism-shatter";

interface Mark { x: number; y: number; born: number; angle: number; seed: number; from?: { x: number; y: number }; }
/** One bounded collection per roll, sampled by distance so slow dice stay clean. */
export function createSpecialTrail(style: SpecialTrailStyle) {
  const marks: Mark[] = [];
  const previous = new Map<object, { x: number; y: number }>();
  const life = style === "astral-script" ? 1100 : style === "riftwake" ? 900 : 800;
  let sequence = 0;
  return {
    sample(die: object, point: { x: number; y: number }, now: number) {
      const last = previous.get(die);
      const spacing = style === "prism-shatter" ? 20 : 42;
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < spacing) return;
      marks.push({ ...point, born: now, angle: last ? Math.atan2(point.y - last.y, point.x - last.x) : 0, seed: sequence++, from: last });
      previous.set(die, point);
      if (marks.length > 96) marks.splice(0, marks.length - 96);
    },
    draw(ctx: CanvasRenderingContext2D, now: number) {
      while (marks.length && now - marks[0].born >= life) marks.shift();
      for (const mark of marks) {
        const t = Math.max(0, (now - mark.born) / life);
        const fade = Math.min(1, t * 12) * (1 - t) ** .7;
        if (style === "astral-script" && mark.from && Math.hypot(mark.x - mark.from.x, mark.y - mark.from.y) < 180) {
          ctx.save(); ctx.globalAlpha = fade * .45; ctx.strokeStyle = "#9bcfff"; ctx.lineWidth = .8;
          ctx.beginPath(); ctx.moveTo(mark.from.x, mark.from.y - t * 16); ctx.lineTo(mark.x, mark.y - t * 16); ctx.stroke(); ctx.restore();
        }
        ctx.save(); ctx.translate(mark.x, mark.y); ctx.rotate(mark.angle);
        ctx.globalAlpha = fade; ctx.lineWidth = 1.6;
        if (style === "riftwake") {
          // A portal aperture opens sideways across the path, then pinches shut.
          const radius = 12 + Math.sin(t * Math.PI) * 21;
          ctx.rotate(Math.PI / 2); ctx.scale(1, .48 + .18 * Math.sin(t * 4));
          ctx.strokeStyle = "#bf83ff"; ctx.shadowColor = "#9a38ff"; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.ellipse(0, 0, radius, radius, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = "#6fffe2"; ctx.shadowBlur = 6;
          ctx.beginPath(); ctx.arc(0, 0, radius + 5, t * 5, t * 5 + Math.PI * 1.25); ctx.stroke();
          ctx.strokeStyle = "#eee1ff"; ctx.lineWidth = 1;
          for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + t * 2;
            ctx.beginPath(); ctx.moveTo(Math.cos(a) * (radius - 3), Math.sin(a) * (radius - 3));
            ctx.lineTo(Math.cos(a) * (radius + 8), Math.sin(a) * (radius + 8)); ctx.stroke();
          }
        } else if (style === "astral-script") {
          // Authored rune strokes reveal in sequence, then lift away like ink.
          ctx.translate(0, -t * 16); ctx.rotate(-mark.angle + Math.sin(mark.seed) * .3);
          ctx.strokeStyle = "#ffe19c"; ctx.shadowColor = "#ffbd49"; ctx.shadowBlur = 9;
          const rune = mark.seed % 4;
          const strokes = rune === 0 ? [[0,-15,0,15],[-10,-6,10,6],[-10,6,10,-6]]
            : rune === 1 ? [[-10,12,0,-15],[0,-15,10,12],[-6,3,6,3]]
            : rune === 2 ? [[-9,-12,9,-12],[9,-12,-9,12],[-9,12,9,12]]
            : [[0,-15,-11,0],[-11,0,0,15],[0,15,11,0],[11,0,0,-15]];
          strokes.forEach(([x,y,u,v], i) => {
            const progress = Math.max(0, Math.min(1, t * 9 - i * .5));
            ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x + (u-x)*progress,y+(v-y)*progress); ctx.stroke();
          });
          ctx.fillStyle = "#e6faff"; ctx.shadowColor = "#81dfff";
          for (let i = 0; i < 3; i++) { const a = mark.seed + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a)*23, Math.sin(a)*23, 1.6, 0, Math.PI*2); ctx.fill(); }
          ctx.strokeStyle = "#8cbbd6"; ctx.globalAlpha = fade * .35; ctx.lineWidth = .7;
          ctx.beginPath(); ctx.moveTo(-26,0); ctx.lineTo(-12,0); ctx.moveTo(12,0); ctx.lineTo(26,0); ctx.stroke();
        } else {
          // Paired fragments corkscrew outward, each drawn as two crystal faces.
          for (let side = -1; side <= 1; side += 2) {
            ctx.save(); ctx.translate(-t * 26, side * (8 + t * 38)); ctx.rotate(side * (mark.seed * .8 + t * 5));
            ctx.scale(Math.max(.2, Math.abs(Math.cos(t * 7 + mark.seed))), 1);
            const size = (8 + (mark.seed % 4) * 2) * (1 - t * .35);
            const hue = (mark.seed * 47 + t * 100) % 360;
            ctx.shadowColor = `hsl(${hue},100%,65%)`; ctx.shadowBlur = 7;
            ctx.fillStyle = `hsl(${hue},90%,63%)`; ctx.strokeStyle = "#e7faff"; ctx.lineWidth = .7;
            ctx.beginPath(); ctx.moveTo(0,-size); ctx.lineTo(size*.55,0); ctx.lineTo(0,size); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = `hsl(${(hue+55)%360},85%,82%)`;
            ctx.beginPath(); ctx.moveTo(0,-size); ctx.lineTo(-size*.4,0); ctx.lineTo(0,size); ctx.closePath(); ctx.fill();
            ctx.restore();
          }
        }
        ctx.restore();
      }
      return marks.length > 0;
    },
    clear() { marks.length = 0; previous.clear(); },
  };
}

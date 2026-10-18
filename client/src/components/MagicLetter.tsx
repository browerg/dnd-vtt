import { useEffect, useRef, useState } from "react";

/** The approved Sending study, rendered from real message text. No baked-in letters. */
export default function MagicLetter({ text, onProgress }: { text: string; onProgress?: (position: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const skip = useRef(false);
  const progress = useRef(onProgress);
  progress.current = onProgress;
  const [finished, setFinished] = useState(false);
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => { let live = true; void document.fonts.load('28px "SendingHand"').catch(() => undefined).finally(() => { if (live) setFontReady(true); }); return () => { live = false; }; }, []);
  useEffect(() => {
    if (!fontReady) return;
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    skip.current = skip.current || media.matches;
    setFinished(false);
    const font = '28px "Segoe Script", "Lucida Handwriting", "SendingHand", cursive';
    const sampler = document.createElement("canvas");
    sampler.width = 100; sampler.height = 70;
    const nib = sampler.getContext("2d", { willReadFrequently: true })!;
    const pointsFor = (ch: string, width: number) => {
      nib.clearRect(0, 0, 100, 70); nib.font = font; nib.fillText(ch, 8, 45);
      const pixels = nib.getImageData(0, 0, 100, 70).data, points: number[] = [];
      let last = 30;
      for (let x = 0; x <= Math.ceil(width); x++) {
        const ys: number[] = [];
        for (let y = 5; y < 62; y++) if (pixels[(y * 100 + x + 8) * 4 + 3] > 65) ys.push(y);
        if (ys.length) last = ys.reduce((a, b) => Math.abs(b - last) < Math.abs(a - last) ? b : a);
        points.push(last - 45);
      }
      return points;
    };
    const glyphs: { ch: string; x: number; y: number; w: number; t: number; d: number; points: number[] }[] = [];
    ctx.font = font;
    let x = 4, y = 44, time = 0;
    for (const word of text.split(/(\s+)/)) {
      if (word.includes("\n")) { for (const ch of word) if (ch === "\n") { x = 4; y += 40; time += 180; } continue; }
      if (x > 4 && x + ctx.measureText(word).width > 246) { x = 4; y += 40; time += 100; }
      for (const ch of word) {
        const w = ctx.measureText(ch).width;
        if (x > 4 && x + w > 246) { x = 4; y += 40; }
        const d = Math.max(80, w * 20);
        glyphs.push({ ch, x, y, w, t: time, d, points: pointsFor(ch, w) }); x += w; time += d;
      }
    }
    el.width = 520; el.height = Math.ceil((y + 60) * 2);
    el.style.height = `${(y + 60) * (el.clientWidth || 260) / 260}px`;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    let raf = 0, lastFrame = 0, previous = -1, complete = false;
    const began = performance.now() + 250;
    const core = "#e9fcff", glow = "#65bdff", ink = "#423b37";
    let particles: { x: number; y: number; vx: number; vy: number; life: number; decay: number; size: number; phase: number }[] = [];
    let trail: { x: number; y: number; born: number }[] = [];
    const draw = (now: number) => {
      const dt = Math.min(2, (now - (lastFrame || now - 16.67)) / 16.67); lastFrame = now;
      const elapsed = skip.current ? Infinity : Math.max(0, (now - began) * 1.8);
      ctx.clearRect(0, 0, 260, el.height / 2); ctx.font = font;
      let tip: { x: number; y: number } | null = null, all = true;
      for (const [i, g] of glyphs.entries()) {
        if (elapsed < g.t) { all = false; continue; }
        const p = Math.min(1, (elapsed - g.t) / g.d), u = p * p * (3 - 2 * p), age = elapsed - g.t - g.d;
        ctx.save(); ctx.beginPath(); ctx.rect(g.x - 5, g.y - 37, 5 + (g.w + 5) * u, 52); ctx.clip();
        ctx.fillStyle = ink; ctx.fillText(g.ch, g.x, g.y);
        if (age < 1500 && !skip.current) {
          ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age) / 1500); ctx.fillStyle = core;
          ctx.shadowColor = glow; ctx.shadowBlur = 15; ctx.fillText(g.ch, g.x, g.y); ctx.shadowBlur = 4; ctx.fillText(g.ch, g.x, g.y);
        }
        ctx.restore();
        if (p < 1) {
          all = false;
          if (g.ch.trim()) {
            tip = { x: g.x + g.w * u, y: g.y + g.points[Math.min(g.points.length - 1, Math.floor(g.w * u))] };
            if (i !== previous) { previous = i; progress.current?.((g.y + 40) * (el.clientWidth || 260) / 260); }
          }
        }
      }
      if (skip.current) { particles = []; trail = []; }
      if (tip && now >= began && !skip.current) {
        trail.push({ ...tip, born: now });
        for (let n = 0; n < Math.ceil(4 * dt); n++) {
          const a = Math.random() * Math.PI * 2, v = .35 + Math.random() * 2.1;
          particles.push({ ...tip, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.1, life: 1, decay: .009 + Math.random() * .018, size: .5 + Math.random() * 1.6, phase: Math.random() * 6 });
        }
        const aura = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 30);
        aura.addColorStop(0, core + "dd"); aura.addColorStop(.15, glow + "44"); aura.addColorStop(1, glow + "00");
        ctx.fillStyle = aura; ctx.fillRect(tip.x - 30, tip.y - 30, 60, 60);
      }
      trail = trail.filter(p => now - p.born < 650);
      ctx.save(); ctx.lineCap = "round";
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i]; if (Math.hypot(b.x - a.x, b.y - a.y) > 32) continue;
        ctx.globalAlpha = (1 - (now - b.born) / 650) * .8; ctx.strokeStyle = core; ctx.shadowColor = glow; ctx.shadowBlur = 12; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
      particles = particles.filter(p => p.life > 0);
      for (const p of particles) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx += Math.sin(now * .004 + p.phase) * .025 * dt; p.vy -= .008 * dt;
        p.life = Math.max(0, p.life - p.decay * dt); if (!p.life) continue;
        ctx.save(); ctx.globalAlpha = p.life * (.65 + .35 * Math.sin(now * .013 + p.phase)); ctx.fillStyle = glow; ctx.strokeStyle = glow; ctx.shadowColor = glow; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
        if (p.size > 1.6) { const r = 3 * p.life; ctx.beginPath(); ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r); ctx.stroke(); }
        ctx.restore();
      }
      if (tip && !skip.current) {
        ctx.save(); ctx.translate(tip.x, tip.y); ctx.rotate(-.4); ctx.shadowColor = glow; ctx.shadowBlur = 18; ctx.fillStyle = "#fffef3"; ctx.strokeStyle = glow; ctx.lineWidth = .8;
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(1.3, -1.3, 7, 0); ctx.quadraticCurveTo(1.3, 1.3, 0, 10); ctx.quadraticCurveTo(-1.3, 1.3, -7, 0); ctx.quadraticCurveTo(-1.3, -1.3, 0, -10); ctx.fill(); ctx.stroke(); ctx.restore();
        for (let k = 0; k < 2; k++) {
          ctx.save(); ctx.strokeStyle = glow; ctx.globalAlpha = .8; ctx.shadowColor = glow; ctx.shadowBlur = 6; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.bezierCurveTo(tip.x + Math.sin(now * .003 + k) * 15, tip.y - 15, tip.x - 24 + k * 12, tip.y - 25, tip.x + Math.sin(now * .002 + k) * 22, tip.y - 40 - k * 10); ctx.stroke(); ctx.restore();
        }
      }
      if (all && !complete) { complete = true; setFinished(true); }
      if (!all || particles.length || trail.length || (!skip.current && elapsed < time + 1600)) raf = requestAnimationFrame(draw);
    };
    const reduce = () => { if (media.matches) skip.current = true; };
    media.addEventListener("change", reduce);
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); media.removeEventListener("change", reduce); };
  }, [text, fontReady]);
  return <div className="sending-magic-letter"><canvas ref={canvas} aria-hidden="true" /><span className="sr-only">{text}</span>{!finished && <button type="button" className="sending-ink-button" onClick={() => { skip.current = true; }}>Reveal all</button>}</div>;
}

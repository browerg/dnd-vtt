import type { CSSProperties } from "react";
import "./JackpotSpectacle.css";

/*
 * Jackpot — a Natural 20 as a slot machine. A gold cabinet with chasing
 * bulbs spins three reels of d20 faces; they stop one by one at 1.1s, 1.55s
 * and (after a held breath) 2.3s, all on 20. A neon sign flickers on and
 * gold coins fountain out. The machine stands in for the usual numeral.
 * Timeline is 4.4s.
 */
const REELS = [
  { stop: 0.85, faces: [7, 13, 2, 18, 9, 4, 16, 11, 1, 19, 6, 14, 3, 17, 8] },
  { stop: 1.3, faces: [12, 5, 19, 1, 15, 8, 20, 3, 17, 10, 6, 14, 2, 18, 9, 13, 4, 16, 11, 7] },
  { stop: 2.05, faces: [3, 16, 9, 1, 18, 12, 6, 20, 14, 5, 19, 2, 11, 17, 8, 13, 4, 20, 15, 10, 7, 19, 1, 12, 20, 19] },
];
const BULBS = 30;

export default function JackpotSpectacle() {
  return (
    <div className="jackpot-scene" aria-hidden="true">
      <div className="jp-bg" />
      <div className="jp-spot left" />
      <div className="jp-spot right" />

      <div className="jp-neon">JACKPOT</div>

      <div className="jp-machine">
        <div className="jp-bulbs">
          {Array.from({ length: BULBS }, (_, i) => {
            // Walk the perimeter: top edge, right, bottom, left.
            const t = i / BULBS;
            const [x, y] = t < 0.35 ? [t / 0.35 * 100, 0] : t < 0.5 ? [100, (t - 0.35) / 0.15 * 100] : t < 0.85 ? [100 - (t - 0.5) / 0.35 * 100, 100] : [0, 100 - (t - 0.85) / 0.15 * 100];
            return <i key={i} style={{ "--x": `${x}%`, "--y": `${y}%`, "--i": i } as CSSProperties} />;
          })}
        </div>
        <div className="jp-reels">
          {REELS.map((reel, r) => (
            <div className="jp-window" key={r} style={{ "--stop": `${reel.stop}s`, "--count": reel.faces.length } as CSSProperties}>
              <div className="jp-strip">
                {[...reel.faces, 20].map((face, i, all) => (
                  <b key={i} className={i === all.length - 1 ? "win" : undefined}>{face}</b>
                ))}
              </div>
              <div className="jp-glass" />
            </div>
          ))}
        </div>
        <div className="jp-payline" />
      </div>

      <div className="jp-coins">
        {Array.from({ length: 36 }, (_, i) => (
          <i
            key={i}
            style={{
              "--dx": `${((i * 47) % 100) - 50}vw`,
              "--h": `${22 + ((i * 13) % 28)}vh`,
              "--d": `${2.3 + (i % 9) * 0.05}s`,
              "--spin": `${0.28 + (i % 4) * 0.07}s`,
            } as CSSProperties}
          >
            <b />
          </i>
        ))}
      </div>
    </div>
  );
}

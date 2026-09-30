import type { CSSProperties } from "react";
import "./LegendForgedSpectacle.css";

/*
 * Legend Forged — a Natural 20 hammered into being. The 20 hangs white-hot
 * over a forge; a hammer strikes it three times (0.9s, 1.5s, 2.1s), each
 * blow throwing sparks and a shockwave; then it's quenched in a burst of
 * steam (2.4s) and cools to gold inside a ring of runes. Timeline is 4.4s.
 */
const STRIKES = [0.9, 1.5, 2.1];

export default function LegendForgedSpectacle() {
  return (
    <div className="legend-forged-scene" aria-hidden="true">
      <div className="lf-bg" />
      <div className="lf-forge-glow" />
      <div className="lf-embers">
        {Array.from({ length: 30 }, (_, i) => (
          <i key={i} style={{ "--x": `${(i * 37) % 100}%`, "--d": `${(i % 10) * 0.35}s`, "--drift": `${((i * 11) % 13) - 6}vmin` } as CSSProperties} />
        ))}
      </div>

      <div className="lf-shake">
        <svg className="lf-runes" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="92" />
          <circle cx="100" cy="100" r="80" />
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} transform={`rotate(${i * 22.5} 100 100)`} d={i % 2 ? "M100 11v10m-4-7 8 4" : "M100 11v10m-4 0 4-5 4 5"} />
          ))}
        </svg>

        {STRIKES.map((at, s) => (
          <div className="lf-strike" key={s} style={{ "--at": `${at}s` } as CSSProperties}>
            <div className="lf-ring" />
            <div className="lf-sparks">
              {Array.from({ length: 16 }, (_, i) => (
                <i key={i} style={{ "--angle": `${-150 + i * 20 + s * 7}deg`, "--reach": `${10 + ((i * 7 + s * 3) % 5) * 4}vmin` } as CSSProperties} />
              ))}
            </div>
          </div>
        ))}

        <div className="lf-hammer">
          <svg viewBox="0 0 100 400" preserveAspectRatio="xMidYMin meet">
            <rect className="lf-handle" x="43" y="70" width="14" height="330" rx="6" />
            <rect className="lf-head" x="4" y="14" width="92" height="62" rx="7" />
            <rect className="lf-face" x="4" y="14" width="14" height="62" rx="4" />
            <rect className="lf-band" x="38" y="10" width="24" height="70" rx="3" />
          </svg>
        </div>

        <div className="lf-steam">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ "--dx": `${((i * 29) % 36) - 18}vmin`, "--dy": `${-10 - (i % 4) * 7}vmin`, "--s": `${14 + (i % 3) * 7}vmin`, "--d": `${2.35 + (i % 5) * 0.05}s` } as CSSProperties} />
          ))}
        </div>
      </div>
    </div>
  );
}

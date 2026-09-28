import type { CSSProperties } from "react";
import "./SeveredFateSpectacle.css";

/*
 * Severed Fate — a Natural 1 in four beats. A golden thread (the roller's
 * fate) draws taut across a loom of dark threads, a spectral blade sweeps
 * through it, and the screen itself splits along the cut to show a crimson
 * rift. The cut line is shared by the SVGs (preserveAspectRatio="none") and
 * the veil clip-paths, so every piece agrees at any aspect ratio:
 * (0, 58%) → (100%, 26%), crossing the thread at (56%, 40%).
 */
const CUT = "M0 58 L100 26";

export default function SeveredFateSpectacle() {
  return (
    <div className="severed-fate-scene" aria-hidden="true">
      <div className="sf-backdrop" />
      <div className="sf-shake">
        <svg className="sf-rift" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className="sf-rift-glow" d={CUT} />
          <path className="sf-rift-core" d={CUT} />
        </svg>
        <div className="sf-veil top" />
        <div className="sf-veil bottom" />

        <div className="sf-thread">
          <i className="sf-thread-half left" />
          <i className="sf-thread-half right" />
        </div>

        <svg className="sf-slash" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path pathLength="1" d={CUT} />
        </svg>

        <div className="sf-blade">
          {[0, 1, 2].map((ghost) => (
            <svg key={ghost} viewBox="0 0 200 200" style={{ "--ghost": ghost } as CSSProperties}>
              <path d="M100 8 A92 92 0 1 1 8 100 A86 90 0 1 0 100 8Z" />
            </svg>
          ))}
        </div>

        <div className="sf-sparks">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ "--angle": `${i * 20 + (i % 3) * 7}deg`, "--reach": `${14 + (i % 4) * 5}vmin` } as CSSProperties} />
          ))}
        </div>

        <div className="sf-embers">
          {Array.from({ length: 28 }, (_, i) => {
            const x = (i * 37) % 100;
            return (
              <i
                key={i}
                style={{
                  "--x": `${x}%`,
                  "--y": `${58 - (32 * x) / 100}%`,
                  "--drift": `${((i * 13) % 9) - 4}vmin`,
                  "--delay": `${1.15 + ((i * 7) % 10) * 0.09}s`,
                } as CSSProperties}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

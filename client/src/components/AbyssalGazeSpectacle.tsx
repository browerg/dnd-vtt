import type { CSSProperties } from "react";
import "./AbyssalGazeSpectacle.css";

/*
 * Eye of the Abyss — a Natural 1 as cosmic horror. Veins crawl in from the
 * edges, a vast eye opens around the result, darts left and right looking
 * for the roller, then locks on at 1.9s as its pupil snaps to a slit around
 * the "1". Smaller eyes open along the edges, all staring inward, and every
 * eye blinks shut together at the end. Timeline is 4.4s.
 */
const VEINS = [
  "M0 12 C18 18 26 14 38 24 S52 30 58 36",
  "M38 24 C36 30 40 34 36 40",
  "M0 70 C14 66 22 74 34 70 S46 64 52 58",
  "M160 20 C144 26 136 20 124 30 S110 36 104 40",
  "M124 30 C126 36 122 40 126 46",
  "M160 78 C146 72 138 80 126 74 S114 66 108 60",
  "M40 0 C44 10 38 16 46 24",
  "M120 0 C116 12 124 18 114 26",
  "M30 100 C34 90 28 84 38 78",
  "M132 100 C128 90 136 84 124 78",
  "M0 40 C10 42 16 38 24 44",
  "M160 50 C150 48 144 54 136 52",
];

/** x%, y%, size (vmin), tilt, opening time (s). */
const WATCHERS: [number, number, number, number, number][] = [
  [9, 14, 7, -12, 2.2], [27, 7, 5, 6, 2.62], [76, 9, 6, 10, 2.45], [92, 24, 8, -8, 2.8],
  [5, 46, 6, 4, 3.1], [95, 56, 6, -6, 2.95], [10, 84, 8, 8, 3.22], [31, 93, 5, -4, 3.35],
  [70, 92, 6, 6, 3.02], [90, 86, 7, -10, 2.55],
];

export default function AbyssalGazeSpectacle() {
  return (
    <div className="abyssal-gaze-scene" aria-hidden="true">
      <div className="ag-backdrop" />
      <div className="ag-shake">
        <svg className="ag-veins" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice">
          {VEINS.map((d, i) => <path key={i} d={d} pathLength="1" style={{ "--i": i } as CSSProperties} />)}
        </svg>

        {WATCHERS.map(([x, y, size, tilt, at], i) => (
          <div
            className="ag-watcher"
            key={i}
            style={{
              "--x": `${x}%`, "--y": `${y}%`, "--s": `${size}vmin`, "--tilt": `${tilt}deg`, "--at": `${at}s`,
              "--lx": `${x < 50 ? 22 : -22}%`, "--ly": `${y < 40 ? 16 : -16}%`,
            } as CSSProperties}
          >
            <div className="ag-watcher-lid"><i /></div>
          </div>
        ))}

        <div className="ag-eye-wrap">
          <div className="ag-eye">
            <div className="ag-bloodshot" />
            <div className="ag-iris-track">
              <div className="ag-iris"><div className="ag-pupil" /></div>
            </div>
            <div className="ag-lid-shade" />
          </div>
          <div className="ag-lock-ring" />
          <div className="ag-lock-ring second" />
        </div>
        <div className="ag-flash" />
      </div>
    </div>
  );
}

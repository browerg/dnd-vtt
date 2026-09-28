import type { CSSProperties } from "react";
import "./MimicSpectacle.css";

/*
 * It Was a Mimic — a Natural 1 as a treasure chest that bites. Two wooden
 * jaws with gold trim creak in, snap shut on the screen at 1.0s, chew twice,
 * gulp, then spring open and spit the result back out at 1.6s with a lolling
 * tongue and drool. Timeline is 4.2s.
 */
const TOP_TEETH = [7, 9, 6, 12, 8, 10, 7, 9, 10, 7, 12, 8, 10, 7];
const BOTTOM_TEETH = [6, 9, 8, 7, 11, 9, 7, 10, 8, 7, 11, 8, 9, 7, 8];

export default function MimicSpectacle() {
  return (
    <div className="mimic-scene" aria-hidden="true">
      <div className="mm-gullet" />
      <div className="mm-shake">
        <div className="mm-jaw top">
          <div className="mm-wood" />
          <div className="mm-lock"><i /></div>
          <div className="mm-trim" />
          <div className="mm-gum" />
          <div className="mm-teeth">
            {TOP_TEETH.map((h, i) => <i key={i} style={{ "--h": `${h}vmin` } as CSSProperties} />)}
          </div>
          <div className="mm-drool">
            {[18, 37, 61, 83].map((x, i) => <i key={x} style={{ "--x": `${x}%`, "--len": `${9 + (i % 3) * 5}vmin`, "--d": `${i * 0.12}s` } as CSSProperties} />)}
          </div>
        </div>

        <div className="mm-jaw bottom">
          <div className="mm-wood" />
          <div className="mm-trim" />
          <div className="mm-gum" />
          <div className="mm-teeth">
            {BOTTOM_TEETH.map((h, i) => <i key={i} style={{ "--h": `${h}vmin` } as CSSProperties} />)}
          </div>
        </div>

        <div className="mm-tongue" />
        <div className="mm-clack" />
        <div className="mm-splinters">
          {Array.from({ length: 18 }, (_, i) => (
            <i
              key={i}
              style={{
                "--x": `${(i * 29) % 100}%`,
                "--dx": `${((i * 17) % 21) - 10}vmin`,
                "--dy": `${(i % 2 ? 1 : -1) * (8 + (i % 5) * 4)}vmin`,
                "--r": `${(i * 67) % 360}deg`,
              } as CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

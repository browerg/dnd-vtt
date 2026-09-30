import type { CSSProperties } from "react";
import "./MainCharacterSpectacle.css";

/*
 * Main Character — a Natural 20 as an anime cut-in. The screen snaps to red
 * speed lines, a black slash panel slams across carrying the roller's name
 * in giant type, and the 20 stamps down on a starburst at 1.0s. A tape of
 * "CRITICAL SUCCESS" scrolls underneath. Timeline is 4.0s.
 */
const TAPE = "CRITICAL SUCCESS ★ NATURAL 20 ★ ".repeat(6);

export default function MainCharacterSpectacle({ userName }: { userName: string }) {
  const name = userName.toUpperCase();
  return (
    <div className="main-character-scene" aria-hidden="true">
      <div className="mc-bg" />
      <div className="mc-rays" />
      <div className="mc-halftone" />
      <div className="mc-streaks">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} style={{ "--y": `${6 + ((i * 37) % 88)}%`, "--d": `${(i % 5) * 0.11}s`, "--w": `${18 + (i % 4) * 9}vw` } as CSSProperties} />
        ))}
      </div>

      <div className="mc-slash" />
      <div className="mc-burst"><i /></div>

      <div className="mc-panel">
        <span className="mc-tag">THE SPOTLIGHT IS YOURS</span>
        <strong className="mc-name" style={{ "--len": Math.max(name.length, 4) } as CSSProperties}>{name}</strong>
      </div>

      <div className="mc-tape"><span>{TAPE}</span><span>{TAPE}</span></div>
      <div className="mc-flash" />
    </div>
  );
}

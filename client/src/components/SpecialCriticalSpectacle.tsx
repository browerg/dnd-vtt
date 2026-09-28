import type { CSSProperties } from "react";
import "./SpecialCriticalSpectacle.css";

export default function SpecialCriticalSpectacle({ effect }: { effect: string }) {
  if (!["void-collapse", "heavens-lance", "chronobreak"].includes(effect)) return null;
  return <div className="special-critical-scene" aria-hidden="true">
    {effect === "void-collapse" ? <>
      <div className="void-core" />
      {[0, 1, 2].map(i => <div className="void-orbit" key={i} style={{ "--i": i } as CSSProperties} />)}
      <div className="void-stars">{Array.from({ length: 32 }, (_, i) => <i key={i} style={{ "--angle": `${i * 137.5}deg`, "--i": i % 5 } as CSSProperties} />)}</div>
    </> : effect === "heavens-lance" ? <>
      <div className="celestial-lance" /><div className="celestial-seal" />
      {[-1, 1].map(side => <div className="celestial-wing" key={side} style={{ "--side": side } as CSSProperties}>
        {Array.from({ length: 9 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}
      </div>)}
    </> : <>
      <div className="chrono-dial">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--angle": `${i * 30}deg`, "--i": i } as CSSProperties}><b>{i === 0 ? 'XII' : i === 3 ? 'III' : i === 6 ? 'VI' : i === 9 ? 'IX' : ''}</b></i>)}<span /><span /></div>
      <div className="chrono-fragments">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ "--angle": `${i * 20}deg` } as CSSProperties} />)}</div>
    </>}
  </div>;
}

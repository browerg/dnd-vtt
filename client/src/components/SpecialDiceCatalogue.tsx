import { SPECIAL_DICE } from "../specialDice";
import "./SpecialDiceCatalogue.css";

export default function SpecialDiceCatalogue() {
  return <>
    <div className="special-dice-catalogue">
      {SPECIAL_DICE.map(dice => <article className="special-die" key={dice.id}>
        <div className="special-die-mystery" role="img" aria-label={`${dice.label}: appearance concealed`}>
          <svg viewBox="0 0 160 172" aria-hidden="true">
            <path d="M80 8 148 48 148 124 80 164 12 124 12 48Z" fill="#030305" stroke="#665773" strokeWidth="1.5" />
            <path d="M80 8 112 62 148 48M112 62 126 118 148 124M126 118 80 164 34 118 12 124M34 118 48 62 12 48M48 62 80 8M48 62 112 62 126 118 34 118Z" fill="none" stroke="#26202e" strokeWidth="1" />
            <text x="80" y="111" textAnchor="middle" fill="#000" fontFamily="Cinzel, Georgia, serif" fontSize="64">?</text>
          </svg>
        </div>
        <h3>{dice.label}</h3>
        <p>Mythic · Vivid Cache exclusive</p>
      </article>)}
    </div>
    <p className="special-dice-note">Win these sets through a Vivid Cache spin. Their appearance stays hidden here.</p>
  </>;
}

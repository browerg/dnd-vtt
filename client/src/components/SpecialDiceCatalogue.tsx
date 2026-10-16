import { SPECIAL_DICE } from "../specialDice";
import { DiceThumbnail } from "./CollectionDicePreview";
import { canPreviewRwbyDice, RWBY_DICE } from "../../../shared/rwbyDice";
import "./SpecialDiceCatalogue.css";

export interface SpecialDiceOffer { id: string; price: number; owned: boolean }

/** Legendary sets are shown and sold here; Mythic sets stay concealed and Cache-only. */
export default function SpecialDiceCatalogue({ onPreview, offers, balance, busyId, onBuy }: {
  onPreview: (id: string) => void;
  offers: Record<string, SpecialDiceOffer>;
  balance: number;
  busyId: string | null;
  onBuy: (theme: string) => void;
}) {
  return <>
    <div className="special-dice-catalogue">
      {SPECIAL_DICE.map(dice => {
        const offer = offers[dice.id];
        return <article className="special-die" key={dice.id}>
          {canPreviewRwbyDice(dice.id) ? <div className="special-die-mystery special-die-revealed" role="img" aria-label={dice.label}>
            <DiceThumbnail theme={dice.id} />
          </div> : <div className="special-die-mystery" role="img" aria-label={`${dice.label}: appearance concealed`}>
            <svg viewBox="0 0 160 172" aria-hidden="true">
              <path d="M80 8 148 48 148 124 80 164 12 124 12 48Z" fill="#030305" stroke="#665773" strokeWidth="1.5" />
              <path d="M80 8 112 62 148 48M112 62 126 118 148 124M126 118 80 164 34 118 12 124M34 118 48 62 12 48M48 62 80 8M48 62 112 62 126 118 34 118Z" fill="none" stroke="#26202e" strokeWidth="1" />
              <text x="80" y="111" textAnchor="middle" fill="#000" fontFamily="Cinzel, Georgia, serif" fontSize="64">?</text>
            </svg>
          </div>}
          <h3>{dice.label}</h3>
          <p>{offer ? `Legendary · ${offer.price.toLocaleString()} VCoins or Vivid Cache` : "Mythic · Vivid Cache exclusive"}</p>
          {canPreviewRwbyDice(dice.id) && <>
            <p>{RWBY_DICE.find(item => item.theme === dice.id)?.description}</p>
            <div className="special-die-actions">
              <button type="button" className="ghost" onClick={() => onPreview(dice.id)} aria-label={`Preview ${dice.label}`}>Preview roll</button>
              {offer && (offer.owned
                ? <span className="special-die-owned">Owned · equip in Customize</span>
                : <button type="button" className="primary" disabled={busyId !== null || balance < offer.price} onClick={() => onBuy(dice.id)}>
                    {busyId === offer.id ? "Buying…" : balance < offer.price ? `Need ${offer.price - balance} more` : `Buy · ${offer.price.toLocaleString()}`}
                  </button>)}
            </div>
          </>}
        </article>;
      })}
    </div>
    <p className="special-dice-note">Legendary sets can be previewed free and bought outright. Mythic sets are won only through a Vivid Cache spin, and their appearance stays hidden here.</p>
  </>;
}

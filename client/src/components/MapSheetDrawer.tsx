import { useEffect, useRef } from "react";
import SheetView from "./SheetView";
import "./MapSheetDrawer.css";

/** A character sheet that slides over the map, so nobody has to leave the board to check it. */
export default function MapSheetDrawer({ campaignId, characterId, title, onClose }: {
  campaignId: number; characterId: number; title: string; onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <aside className="map-sheet-drawer" aria-label={`${title} character sheet`}>
      <header className="map-sheet-drawer-head">
        <strong>{title}</strong>
        <button ref={closeRef} type="button" className="ghost mini" onClick={onClose} aria-label="Close the sheet">✕</button>
      </header>
      <div className="map-sheet-drawer-body">
        <SheetView key={characterId} campaignId={campaignId} characterId={characterId} />
      </div>
    </aside>
  );
}

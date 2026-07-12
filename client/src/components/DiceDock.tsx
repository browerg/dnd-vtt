import { useState } from "react";
import DicePanel from "./DicePanel";

interface Props {
  onRoll: (body: {
    formula: string;
    label: string;
    mode: string;
    visibility: string;
    manual?: boolean;
    total?: number;
  }) => Promise<void>;
  system?: string;
  /** open on first mount (hub yes, map no — keep the table clear) */
  defaultOpen?: boolean;
}

// A collapsible bottom-left dice menu — the compact, always-reachable version
// of the full Roll panel, with favorites + recents built into DicePanel. One of
// the first two floating "dock" widgets; more panels will join this pattern.
export default function DiceDock({ onRoll, system, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem("dock-dice-open");
    return saved === null ? defaultOpen : saved === "1";
  });

  const toggle = () => {
    setOpen((o) => {
      localStorage.setItem("dock-dice-open", o ? "0" : "1");
      return !o;
    });
  };

  return (
    <div className={`dock dice-dock${open ? " open" : ""}`}>
      {open ? (
        <div className="dock-body">
          <div className="dock-head">
            <h4>🎲 Dice</h4>
            <button type="button" className="dock-collapse" title="Collapse" onClick={toggle}>
              ▾
            </button>
          </div>
          <DicePanel onRoll={onRoll} system={system} />
        </div>
      ) : (
        <button type="button" className="dock-tab" title="Roll dice" onClick={toggle}>
          🎲
        </button>
      )}
    </div>
  );
}

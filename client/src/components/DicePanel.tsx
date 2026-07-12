import { useEffect, useState, type FormEvent } from "react";

const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100];

interface Favorite {
  formula: string;
  label: string;
  mode: string;
}

const FAV_KEY = "dice-favorites";
const REC_KEY = "dice-recents";

function loadFavorites(): Favorite[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function loadRecents(): Favorite[] {
  try {
    return JSON.parse(localStorage.getItem(REC_KEY) ?? "[]");
  } catch {
    return [];
  }
}

interface Props {
  onRoll: (body: {
    formula: string;
    label: string;
    mode: string;
    visibility: string;
    manual?: boolean;
    total?: number;
  }) => Promise<void>;
  system?: string; // remnant → Edge/Setback, dnd5e → Adv/Dis
}

export default function DicePanel({ onRoll, system }: Props) {
  const modeOptions: [string, string][] =
    system === "remnant"
      ? [
          ["normal", "Normal"],
          ["edge", "Edge"],
          ["setback", "Setback"],
        ]
      : [
          ["normal", "Normal"],
          ["advantage", "Adv"],
          ["disadvantage", "Dis"],
        ];
  // Remnant checks are 2d10 + attribute die; 5e lives on the d20.
  const [formula, setFormula] = useState(system === "remnant" ? "2d10" : "1d20");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState("normal");
  const [visibility, setVisibility] = useState("public");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>(loadFavorites);
  const [recents, setRecents] = useState<Favorite[]>(loadRecents);
  const [manualTotal, setManualTotal] = useState("");

  // Remember what actually got rolled, most-recent first, distinct by
  // formula+mode, capped small. Feeds the "recently used" chips.
  const pushRecent = (entry: Favorite) => {
    if (!entry.formula.trim()) return;
    setRecents((prev) =>
      [entry, ...prev.filter((r) => !(r.formula === entry.formula && r.mode === entry.mode))].slice(0, 8)
    );
  };
  const [manualDice, setManualDice] = useState("");

  // Somebody rolled physical dice at the table — post the total they read off.
  const submitManual = async () => {
    const total = Math.round(Number(manualTotal));
    if (!Number.isFinite(total) || manualTotal.trim() === "") {
      setError("Enter the total you rolled.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onRoll({
        formula: manualDice.trim() || "real dice",
        label,
        mode: "normal",
        visibility,
        manual: true,
        total,
      });
      setManualTotal("");
      setLabel("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(REC_KEY, JSON.stringify(recents));
  }, [recents]);

  const saveFavorite = () => {
    if (!formula.trim()) return;
    const fav: Favorite = { formula: formula.trim(), label: label.trim(), mode };
    setFavorites((prev) =>
      [fav, ...prev.filter((f) => !(f.formula === fav.formula && f.label === fav.label))].slice(0, 12)
    );
  };

  const rollFavorite = async (fav: Favorite) => {
    setError("");
    setBusy(true);
    try {
      await onRoll({ ...fav, visibility });
      pushRecent({ formula: fav.formula, label: fav.label, mode: fav.mode });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Clicking d20 sets 1d20; clicking it again bumps to 2d20, 3d20…
  const quick = (sides: number) => {
    const m = formula.trim().match(new RegExp(`^(\\d*)d${sides}$`));
    const count = m ? (m[1] ? parseInt(m[1], 10) : 1) + 1 : 1;
    setFormula(`${count}d${sides}`);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onRoll({ formula, label, mode, visibility });
      pushRecent({ formula: formula.trim(), label: label.trim(), mode });
      setLabel("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack dice-panel">
      <div className="quick-dice">
        {QUICK_DICE.map((sides) => (
          <button type="button" key={sides} className="die-btn" onClick={() => quick(sides)}>
            d{sides}
          </button>
        ))}
      </div>
      <div className="row-between">
        <input
          className="formula-input"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          placeholder={system === "remnant" ? "2d10+1d6" : "2d6+4"}
          aria-label="Dice formula"
        />
        <button
          type="button"
          className="ghost"
          title="Save as favorite (uses current formula, label, and mode)"
          onClick={saveFavorite}
        >
          ★
        </button>
        <button className="primary roll-btn" disabled={busy}>
          Roll
        </button>
      </div>
      {favorites.length > 0 && (
        <div className="fav-row">
          {favorites.map((f) => (
            <span key={`${f.label}|${f.formula}`} className="fav-chip">
              <button
                type="button"
                title={`${f.formula}${f.mode !== "normal" ? ` (${f.mode})` : ""}`}
                onClick={() => rollFavorite(f)}
                disabled={busy}
              >
                {f.label || f.formula}
              </button>
              <button
                type="button"
                className="fav-x"
                title="Remove favorite"
                onClick={() => setFavorites((prev) => prev.filter((x) => x !== f))}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      {recents.length > 0 && (
        <div className="fav-row recent-row">
          <span className="fav-lead muted small">Recent</span>
          {recents
            .filter((r) => !favorites.some((f) => f.formula === r.formula && f.label === r.label))
            .slice(0, 6)
            .map((r, i) => (
              <span key={`${r.mode}|${r.label}|${r.formula}|${i}`} className="fav-chip recent-chip">
                <button
                  type="button"
                  title={`${r.formula}${r.mode !== "normal" ? ` (${r.mode})` : ""}`}
                  onClick={() => rollFavorite(r)}
                  disabled={busy}
                >
                  {r.label || r.formula}
                </button>
              </span>
            ))}
        </div>
      )}
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={
          system === "remnant"
            ? "Label (optional) — e.g. Dust Channeling"
            : "Label (optional) — e.g. Fireball damage"
        }
        aria-label="Roll label"
      />
      <div className="row-between">
        <div className="seg" role="group" aria-label="Roll mode">
          {modeOptions.map(([value, text]) => (
            <button
              type="button"
              key={value}
              className={mode === value ? "seg-btn active" : "seg-btn"}
              onClick={() => setMode(value)}
            >
              {text}
            </button>
          ))}
        </div>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          aria-label="Who can see this roll"
        >
          <option value="public">Everyone</option>
          <option value="private">Only me</option>
          <option value="dm">Me + DM</option>
          <option value="blind">Blind (only DM)</option>
        </select>
      </div>
      <details className="manual-roll">
        <summary className="muted small">✍️ Rolled real dice at the table?</summary>
        <div className="row-between manual-row">
          <input
            type="number"
            className="manual-total"
            placeholder="Total"
            value={manualTotal}
            onChange={(e) => setManualTotal(e.target.value)}
            aria-label="Total you rolled"
          />
          <input
            placeholder={system === "remnant" ? "What you rolled — 2d10+d6" : "What you rolled — d20+5"}
            value={manualDice}
            onChange={(e) => setManualDice(e.target.value)}
            aria-label="What you rolled"
          />
          <button type="button" className="ghost" disabled={busy} onClick={submitManual}>
            Post
          </button>
        </div>
        <p className="muted small">Uses the label and visibility above. On your honor. 🎲</p>
      </details>
      {error && <div className="error">{error}</div>}
    </form>
  );
}

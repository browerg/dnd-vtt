import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../App";
import { previewDice } from "../dice3d";
import { BACKGROUNDS, getBackground, setBackground } from "../background";

// Curated colorsets from the 3D dice library. Swatches are approximations —
// the real judge is the preview roll.
const DICE_SETS: { key: string; name: string; from: string; to: string }[] = [
  { key: "white", name: "White", from: "#f2f2f2", to: "#c9c9c9" },
  { key: "black", name: "Black", from: "#4a4a4a", to: "#101010" },
  { key: "radiant", name: "Radiant", from: "#f9e79b", to: "#c9a24b" },
  { key: "fire", name: "Fire", from: "#f8b84f", to: "#e02c1e" },
  { key: "ice", name: "Ice", from: "#bfe6ff", to: "#2a6fb0" },
  { key: "lightning", name: "Lightning", from: "#fff29b", to: "#d9a514" },
  { key: "poison", name: "Poison", from: "#c7f464", to: "#4e8c2a" },
  { key: "bloodmoon", name: "Blood Moon", from: "#c0392b", to: "#4a0d0d" },
  { key: "pinkdreams", name: "Pink Dreams", from: "#ff007c", to: "#df73ff" },
  { key: "astralsea", name: "Astral Sea", from: "#7f9bff", to: "#1b2a6b" },
  { key: "glitterparty", name: "Glitter Party", from: "#f6c1f0", to: "#b76fd4" },
  { key: "dragons", name: "Here be Dragons", from: "#d4af37", to: "#7a1c1c" },
];

export default function CustomizePage() {
  const { user, setUser } = useAuth();
  const [selected, setSelected] = useState(user?.diceTheme || "white");
  const [bg, setBg] = useState(getBackground());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const pickBg = (key: string) => {
    setBg(key);
    setBackground(key); // applies instantly + persists (client-side)
  };

  const pick = async (key: string) => {
    setSelected(key);
    setNotice("");
    setError("");
    // Preview immediately — the save is quick, the dopamine quicker.
    void previewDice(key);
    try {
      await api("/api/auth/me/dice", { method: "PUT", body: JSON.stringify({ theme: key }) });
      if (user) setUser({ ...user, diceTheme: key });
      setNotice("Saved — these are your dice now. Everyone sees them when you roll.");
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="ghost link">
          ← Campaigns
        </Link>
        <span className="brand">🎨 Customize</span>
        <span className="spacer" />
        <Link to="/shop" className="ghost link">
          🏪 Shop
        </Link>
      </header>
      <main className="content">
        <section className="card">
          <h3>Your dice</h3>
          <p className="muted">
            Pick a set — it rides with every roll you make, so the whole table sees{" "}
            <em>your</em> dice hit the felt. Click one to preview and save.
          </p>
          <div className="dice-set-grid">
            {DICE_SETS.map((s) => (
              <button
                key={s.key}
                className={`dice-set${selected === s.key ? " selected" : ""}`}
                onClick={() => pick(s.key)}
              >
                <span
                  className="dice-swatch"
                  style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}
                />
                <span className="dice-set-name">{s.name}</span>
              </button>
            ))}
          </div>
          {notice && <p className="muted small">{notice}</p>}
          {error && <div className="error">{error}</div>}
          <p className="muted small">
            Swatches are approximate — the tumbling dice you just saw are the real thing.
          </p>
        </section>
        <section className="card">
          <h3>Table backdrop</h3>
          <p className="muted">
            A mood behind everything — set the scene for your campaign. Saved on this device.
          </p>
          <div className="bg-grid">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.key || "none"}
                className={`bg-swatch-btn${bg === b.key ? " selected" : ""}`}
                onClick={() => pickBg(b.key)}
                title={b.name}
              >
                <span
                  className="bg-swatch"
                  style={{ background: b.css || "var(--bg-well)" }}
                />
                <span className="bg-name">{b.name}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="card">
          <h3>More someday</h3>
          <p className="muted small">
            Token frames, name flair, table felts… ideas live in the <Link to="/shop">Shop</Link> —
            currently a pile of lumber and ambition.
          </p>
        </section>
      </main>
    </div>
  );
}

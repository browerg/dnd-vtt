import { useState } from "react";
import { Link } from "react-router-dom";
import { uploadImage } from "../api";
import DiceCustomizer from "../components/DiceCustomizer";
import { BACKGROUNDS, CUSTOM_PREFIX, customImageUrl, getBackground, setBackground } from "../background";

export default function CustomizePage() {
  const [bg, setBg] = useState(getBackground());
  const [error, setError] = useState("");
  const [uploadingBg, setUploadingBg] = useState(false);

  const pickBg = (value: string) => {
    setBg(value);
    setBackground(value); // applies instantly + persists (client-side)
  };

  const uploadBg = async (file: File) => {
    setUploadingBg(true);
    setError("");
    try {
      const url = await uploadImage(file);
      pickBg(CUSTOM_PREFIX + url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image upload failed");
    } finally {
      setUploadingBg(false);
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
        <Link to="/emporium" className="ghost link">
          🏪 Shop
        </Link>
      </header>
      <main className="content">
        <DiceCustomizer />

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
            <label
              className={`bg-swatch-btn${bg.startsWith(CUSTOM_PREFIX) ? " selected" : ""}`}
              title="Upload your own image"
            >
              <span
                className="bg-swatch bg-swatch-upload"
                style={customImageUrl(bg) ? { background: `center / cover url("${customImageUrl(bg)}")` } : undefined}
              >
                {!customImageUrl(bg) && <span className="bg-upload-plus">＋</span>}
              </span>
              <span className="bg-name">{uploadingBg ? "Uploading…" : "Your image"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                disabled={uploadingBg}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadBg(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {error && <div className="error" style={{ marginTop: "0.75rem" }}>{error}</div>}
        </section>

        <section className="card">
          <h3>More someday</h3>
          <p className="muted small">
            Token frames, name flair, table felts… ideas live in the <Link to="/emporium">Emporium</Link> —
            currently a pile of lumber and ambition.
          </p>
        </section>
      </main>
    </div>
  );
}

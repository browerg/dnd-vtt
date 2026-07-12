import { Link } from "react-router-dom";

// The someday-shop: earn tokens for showing up to game night, spend them on
// cosmetics. Nothing here works yet — it's a promise with a storefront.
const WARES = [
  { icon: "🎲", name: "Legendary dice sets", blurb: "Metal, glass, and stranger things" },
  { icon: "🖼️", name: "Token frames", blurb: "Gold-leaf rings for your map token" },
  { icon: "🃏", name: "Name flair", blurb: "Titles by your name in chat and rolls" },
  { icon: "🟩", name: "Table felts", blurb: "Roll your dice on something fancier" },
  { icon: "🐺", name: "Pet Grimm", blurb: "A tiny Beowolf that follows your token" },
];

export default function ShopPage() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="ghost link">
          ← Campaigns
        </Link>
        <span className="brand">🏪 The Emporium</span>
        <span className="spacer" />
        <Link to="/customize" className="ghost link">
          🎨 Customize
        </Link>
      </header>
      <main className="content">
        <section className="card shop-construction">
          <h3>🚧 Under construction 🚧</h3>
          <p className="muted">
            The plan: you earn <strong>tokens for playing</strong> — show up to game night, walk
            away richer — and spend them here on completely unnecessary, extremely important
            cosmetics. The shelves aren't built yet, but the wishlist is:
          </p>
          <ul className="shop-wares">
            {WARES.map((w) => (
              <li key={w.name} className="shop-ware">
                <span className="shop-icon">{w.icon}</span>
                <span className="shop-name">
                  {w.name}
                  <span className="muted small"> — {w.blurb}</span>
                </span>
                <span className="badge vis-badge">soon™</span>
              </li>
            ))}
          </ul>
          <p className="muted small">
            In the meantime, dice sets are free at the <Link to="/customize">Customize</Link>{" "}
            counter — opening-week special.
          </p>
        </section>
      </main>
    </div>
  );
}

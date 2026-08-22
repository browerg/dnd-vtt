import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { previewDice, setDiceTrailStyle, type DiceTrailStyle } from "../dice3d";
import "./ShopPage.css";

interface ShopItem {
  id: string;
  type: "dice-trail";
  effect: DiceTrailStyle;
  name: string;
  description: string;
  price: number;
  rarity: "starter" | "uncommon" | "rare" | "legendary";
  owned: boolean;
}

interface ShopResponse {
  wallet: {
    balance: number;
    bypass: boolean;
    bypassReason: "dev" | "gm" | null;
  };
  items: ShopItem[];
}

const RARITY_LABEL: Record<ShopItem["rarity"], string> = {
  starter: "Starter",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};
const EFFECT_ART: Partial<Record<DiceTrailStyle, string>> = {
  aura: "/assets/dice-vfx/aura_magic.png",
  ember: "/assets/dice-vfx/ember_fire.png",
  frost: "/assets/dice-vfx/frost_star.png",
  shadow: "/assets/dice-vfx/shadow_smoke_large.png",
  lightning: "/assets/dice-vfx/lightning_bolt.png",
};

export default function ShopPage() {
  const [shop, setShop] = useState<ShopResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadShop = async () => {
    const response = await api<ShopResponse>("/api/shop");
    setShop(response);
  };

  useEffect(() => {
    let cancelled = false;
    void api<ShopResponse>("/api/shop")
      .then((response) => {
        if (!cancelled) setShop(response);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not open The Emporium.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => shop?.items ?? [], [shop]);

  const preview = async (item: ShopItem) => {
    setBusyId(item.id);
    setNotice("");
    setError("");
    try {
      setDiceTrailStyle(item.effect);
      await previewDice("white");
      setNotice(`Previewed ${item.name}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview that cosmetic.");
    } finally {
      setBusyId(null);
    }
  };

  const purchase = async (item: ShopItem) => {
    setBusyId(item.id);
    setNotice("");
    setError("");
    try {
      await api("/api/shop/purchase", {
        method: "POST",
        body: JSON.stringify({ cosmeticId: item.id }),
      });
      await loadShop();
      setNotice(shop?.wallet.bypass ? `${item.name} is available to you.` : `Unlocked ${item.name}!`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not purchase that cosmetic.");
    } finally {
      setBusyId(null);
    }
  };

  const grantDevCoins = async () => {
    setNotice("");
    setError("");
    try {
      await api("/api/shop/dev/grant", {
        method: "POST",
        body: JSON.stringify({ amount: 500 }),
      });
      await loadShop();
      setNotice("Added 500 development VCoins.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not grant test VCoins.");
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="ghost link">
          â† Campaigns
        </Link>
        <span className="brand">The Emporium</span>
        <span className="spacer" />
        <Link to="/customize" className="ghost link">
          Customize Dice
        </Link>
      </header>

      <main className="content emporium-page">
        <section className="card emporium-hero">
          <div>
            <span className="emporium-kicker">VIVID REALMS COSMETICS</span>
            <h2>The Emporium</h2>
            <p className="muted">
              Earn VCoins while you play, then spend them on completely unnecessary,
              extremely important cosmetics.
            </p>
          </div>

          <div className="emporium-wallet">
            <span>YOUR BALANCE</span>
            <strong>VCoins {shop?.wallet.balance ?? 0}</strong>
            {shop?.wallet.bypass && (
              <small>
                {shop.wallet.bypassReason === "dev"
                  ? "Development mode Â· all cosmetics unlocked"
                  : "Game Master Â· all cosmetics unlocked"}
              </small>
            )}
          </div>
        </section>

        {shop?.wallet.bypassReason === "dev" && (
          <section className="emporium-devbar">
            <span>DEV ECONOMY TESTING</span>
            <button type="button" className="ghost" onClick={() => void grantDevCoins()}>
              +500 VCoins
            </button>
          </section>
        )}

        {error && <div className="notice error">{error}</div>}
        {notice && <div className="notice">{notice}</div>}

        <div className="emporium-section-heading">
          <div>
            <h3>Dice Trails</h3>
            <p className="muted small">Cosmetic VFX that follow your dice through every roll.</p>
          </div>
          <span>{items.filter((item) => item.owned).length} / {items.length} owned</span>
        </div>

        {loading ? (
          <section className="card">
            <p className="muted">Opening the shopâ€¦</p>
          </section>
        ) : (
          <section className="emporium-grid">
            {items.map((item) => {
              const busy = busyId === item.id;
              const canAfford = (shop?.wallet.balance ?? 0) >= item.price;
              return (
                <article
                  key={item.id}
                  className={`card emporium-item rarity-${item.rarity}${item.owned ? " owned" : ""}`}
                >
                  <div className="emporium-item-top">
                    <span className={`emporium-effect-preview trail-${item.effect}`} aria-hidden>
                      {EFFECT_ART[item.effect] ? (
                        <>
                          <img
                            src={EFFECT_ART[item.effect]}
                            alt=""
                            className="emporium-effect-art emporium-effect-art-main"
                          />
                          <img
                            src={EFFECT_ART[item.effect]}
                            alt=""
                            className="emporium-effect-art emporium-effect-art-ghost"
                          />
                        </>
                      ) : (
                        <span className="emporium-petal-preview">
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                        </span>
                      )}
                    </span>
                    <span className="emporium-rarity">{RARITY_LABEL[item.rarity]}</span>
                  </div>

                  <div className="emporium-item-copy">
                    <h4>{item.name}</h4>
                    <p className="muted small">{item.description}</p>
                  </div>

                  <div className="emporium-price-row">
                    {item.owned ? (
                      <span className="emporium-owned">OWNED</span>
                    ) : (
                      <strong>VCoins {item.price}</strong>
                    )}
                  </div>

                  <div className="emporium-actions">
                    <button
                      type="button"
                      className="ghost"
                      disabled={busy}
                      onClick={() => void preview(item)}
                    >
                      {busy ? "Rollingâ€¦" : "Preview"}
                    </button>

                    {item.owned ? (
                      <Link
                        to="/customize"
                        className="primary link emporium-equip-link"
                        onClick={() => setDiceTrailStyle(item.effect)}
                      >
                        Equip
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="primary"
                        disabled={busy || (!canAfford && !shop?.wallet.bypass)}
                        onClick={() => void purchase(item)}
                      >
                        {canAfford ? "Unlock" : "Need more VCoins"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section className="card emporium-coming-soon">
          <span>COMING TO THE SHELVES</span>
          <div>
            <strong>Landing Effects</strong>
            <strong>Token Frames</strong>
            <strong>Name Flair</strong>
            <strong>Table Felts</strong>
            <strong>Pet Grimm</strong>
          </div>
        </section>
      </main>
    </div>
  );
}



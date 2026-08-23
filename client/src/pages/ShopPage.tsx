import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { previewDice, setDiceTrailStyle, type DiceTrailStyle } from "../dice3d";
import "./ShopPage.css";
import "./CriticalEffectShop.css";

type CriticalSlot = "nat20" | "nat1";
type ShopItemType = "dice-trail" | "nat20-effect" | "nat1-effect";

interface ShopItem {
  id: string;
  type: ShopItemType;
  slot?: CriticalSlot;
  effect: string;
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
  equipped: Record<CriticalSlot, string>;
  equippedEffects: Record<CriticalSlot, string>;
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

function isDiceTrail(item: ShopItem): item is ShopItem & { type: "dice-trail"; effect: DiceTrailStyle } {
  return item.type === "dice-trail";
}

function criticalKind(item: ShopItem): "nat20" | "nat1" | null {
  if (item.type === "nat20-effect") return "nat20";
  if (item.type === "nat1-effect") return "nat1";
  return null;
}

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
  const diceTrails = useMemo(() => items.filter((item) => item.type === "dice-trail"), [items]);
  const nat20Effects = useMemo(() => items.filter((item) => item.type === "nat20-effect"), [items]);
  const nat1Effects = useMemo(() => items.filter((item) => item.type === "nat1-effect"), [items]);

  const isEquipped = (item: ShopItem) => {
    if (!item.slot) return false;
    return shop?.equipped[item.slot] === item.id;
  };

  const preview = async (item: ShopItem) => {
    setBusyId(item.id);
    setNotice("");
    setError("");

    try {
      if (isDiceTrail(item)) {
        setDiceTrailStyle(item.effect);
        await previewDice("white");
        setNotice(`Previewed ${item.name}.`);
      } else {
        const kind = criticalKind(item);
        if (!kind) return;
        window.dispatchEvent(
          new CustomEvent("tabletop:critical-roll", {
            detail: {
              kind,
              effect: item.effect,
              userName: "Preview",
              label: item.name,
            },
          })
        );
        setNotice(`Previewed ${item.name}.`);
      }
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

  const equip = async (item: ShopItem) => {
    setBusyId(item.id);
    setNotice("");
    setError("");

    try {
      if (isDiceTrail(item)) {
        setDiceTrailStyle(item.effect);
        setNotice(`Equipped ${item.name}.`);
      } else {
        await api("/api/shop/equip", {
          method: "POST",
          body: JSON.stringify({ cosmeticId: item.id }),
        });
        await loadShop();
        setNotice(`Equipped ${item.name}.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not equip that cosmetic.");
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

  const renderPreview = (item: ShopItem) => {
    if (isDiceTrail(item)) {
      return (
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
      );
    }

    const kind = criticalKind(item);
    return (
      <span
        className={`emporium-critical-preview ${kind ?? ""} effect-${item.effect}`}
        aria-hidden
      >
        <i className="emporium-critical-orbit" />
        <i className="emporium-critical-orbit second" />
        <strong>{kind === "nat20" ? "20" : "1"}</strong>
        <span className="emporium-critical-sparks">
          <b />
          <b />
          <b />
          <b />
        </span>
      </span>
    );
  };

  const renderSection = (
    title: string,
    description: string,
    sectionItems: ShopItem[]
  ) => (
    <section className="emporium-section-block">
      <div className="emporium-section-heading">
        <div>
          <h3>{title}</h3>
          <p className="muted small">{description}</p>
        </div>
        <span>
          {sectionItems.filter((item) => item.owned).length} / {sectionItems.length} owned
        </span>
      </div>

      <div className="emporium-grid">
        {sectionItems.map((item) => {
          const busy = busyId === item.id;
          const canAfford = (shop?.wallet.balance ?? 0) >= item.price;
          const equipped = isEquipped(item);

          return (
            <article
              key={item.id}
              className={`card emporium-item rarity-${item.rarity}${item.owned ? " owned" : ""}${equipped ? " equipped" : ""}`}
            >
              <div className="emporium-item-top">
                {renderPreview(item)}
                <span className="emporium-rarity">{RARITY_LABEL[item.rarity]}</span>
              </div>

              <div className="emporium-item-copy">
                <h4>{item.name}</h4>
                <p className="muted small">{item.description}</p>
              </div>

              <div className="emporium-price-row">
                {equipped ? (
                  <span className="emporium-equipped">EQUIPPED</span>
                ) : item.owned ? (
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
                  {busy ? "Loading…" : "Preview"}
                </button>

                {item.owned ? (
                  <button
                    type="button"
                    className="primary"
                    disabled={busy || equipped}
                    onClick={() => void equip(item)}
                  >
                    {equipped ? "Equipped" : "Equip"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary"
                    disabled={busy || (!canAfford && !shop?.wallet.bypass)}
                    onClick={() => void purchase(item)}
                  >
                    {canAfford || shop?.wallet.bypass ? "Unlock" : "Need more VCoins"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="ghost link">
          ← Campaigns
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
                  ? "Development mode · all cosmetics unlocked"
                  : "Game Master · all cosmetics unlocked"}
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

        {loading ? (
          <section className="card">
            <p className="muted">Opening the shop…</p>
          </section>
        ) : (
          <>
            {renderSection(
              "Dice Trails",
              "Cosmetic VFX that follow your dice through every roll.",
              diceTrails
            )}

            {renderSection(
              "Natural 20 Effects",
              "Equip the celebration everyone sees when you land a natural 20.",
              nat20Effects
            )}

            {renderSection(
              "Natural 1 Effects",
              "When the dice betray you, at least fail with style.",
              nat1Effects
            )}
          </>
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

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { previewDice, setDiceTrailStyle, type DiceTrailStyle } from "../dice3d";
import TurnStartEffect from "../components/TurnStartEffect";
import "./ShopPage.css";
import VividCache from "../components/VividCache";
import "./CriticalEffectShop.css";
import MusicToggle from "../components/MusicToggle";
import FeaturedBundle, { type CosmeticBundle } from "../components/FeaturedBundle";
import ShopDialog from "../components/ShopDialog";
import { emporiumDoor, emporiumMusic, EMPORIUM_MUSIC_KEY, playCoinSound, primeCoinSound } from "../emporiumAudio";
import { useBackgroundMusic } from "../useBackgroundMusic";

type CosmeticSlot = "nat20" | "nat1" | "turnStart";
type ShopItemType = "dice-trail" | "nat20-effect" | "nat1-effect" | "turn-start-effect";

interface ShopItem {
  id: string;
  type: ShopItemType;
  slot?: CosmeticSlot;
  effect: string;
  name: string;
  description: string;
  price: number;
  rarity: "starter" | "uncommon" | "rare" | "legendary" | "mythic";
  owned: boolean;
}

interface ShopResponse {
  wallet: {
    balance: number;
    bypass: boolean;
    bypassReason: "dev" | "gm" | null;
  };
  equipped: Record<CosmeticSlot, string>;
  equippedEffects: Record<CosmeticSlot, string>;
  previewCharacter: {
    id: number;
    name: string;
    imageUrl: string;
    imageKind: "token" | "portrait" | null;
  } | null;
  items: ShopItem[];
  bundles: CosmeticBundle[];
}

const RARITY_LABEL: Record<ShopItem["rarity"], string> = {
  mythic: "Mythic",
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

function isTurnStartEffect(item: ShopItem) {
  return item.type === "turn-start-effect";
}

type MerchantAnimation = "idle" | "money" | "eat";

const MERCHANT_GIFS: Record<MerchantAnimation, string> = {
  idle: "/assets/ui/emporium-goblin-idle.gif",
  money: "/assets/ui/emporium-goblin-money.gif",
  eat: "/assets/ui/emporium-goblin-eat.gif",
};

export default function ShopPage() {
  const [shop, setShop] = useState<ShopResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [turnPreview, setTurnPreview] = useState<{ effect: string; name: string; nonce: number } | null>(null);
  const [merchantAnimation, setMerchantAnimation] = useState<MerchantAnimation>("idle");
  const [merchantNonce, setMerchantNonce] = useState(0);
  const music = useBackgroundMusic(emporiumMusic, EMPORIUM_MUSIC_KEY);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [cacheOpen, setCacheOpen] = useState(false);

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

  // The door on the way in, under the music fading up behind it. Landing here
  // by refresh has no user gesture yet, so the browser refuses the sound and
  // the shop simply opens quietly — a door heard a click later would be worse
  // than no door at all.
  useEffect(() => {
    emporiumDoor.play();
    // Warm the till too, so the first purchase is not silent while its sample
    // is still decoding.
    primeCoinSound();
  }, []);

  const playMerchant = (animation: Exclude<MerchantAnimation, "idle">) => {
    setMerchantAnimation(animation);
    setMerchantNonce((nonce) => nonce + 1);
  };

  // While the shopkeeper is idle, occasionally let him snack. The random
  // animation is deliberately infrequent so the mascot stays atmospheric.
  useEffect(() => {
    if (merchantAnimation !== "idle") return;
    const delay = 15000 + Math.floor(Math.random() * 20000);
    const timer = window.setTimeout(() => {
      setMerchantAnimation("eat");
      setMerchantNonce((nonce) => nonce + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [merchantAnimation, merchantNonce]);

  // One-shot reactions return to the normal idle loop when their GIF finishes.
  useEffect(() => {
    if (merchantAnimation === "idle") return;
    const duration = merchantAnimation === "money" ? 2750 : 2050;
    const timer = window.setTimeout(() => setMerchantAnimation("idle"), duration);
    return () => window.clearTimeout(timer);
  }, [merchantAnimation, merchantNonce]);

  const merchantGif = MERCHANT_GIFS[merchantAnimation];

  const items = useMemo(() => shop?.items ?? [], [shop]);

  // The newest bundle leads the page; the server already sorts them.
  const featured = shop?.bundles?.[0] ?? null;

  const diceTrails = useMemo(() => items.filter((item) => (item.rarity !== "mythic" || item.owned) && item.type === "dice-trail"), [items]);
  const nat20Effects = useMemo(() => items.filter((item) => (item.rarity !== "mythic" || item.owned) && item.type === "nat20-effect"), [items]);
  const nat1Effects = useMemo(() => items.filter((item) => (item.rarity !== "mythic" || item.owned) && item.type === "nat1-effect"), [items]);
  const turnStartEffects = useMemo(() => items.filter((item) => (item.rarity !== "mythic" || item.owned) && item.type === "turn-start-effect"), [items]);

  // The bottom strip. Counts come straight from the catalogue, so a card can
  // never advertise a category that has nothing in it.
  const catalogue = useMemo(
    () =>
      [
        { id: "dice-trail", label: "Dice trails", caption: "Cosmetic VFX that follow every roll.", blurb: "Cosmetic VFX that follow your dice through every roll.", list: diceTrails },
        { id: "nat20-effect", label: "Nat 20 effects", caption: "The celebration everyone sees.", blurb: "Equip the celebration everyone sees when you land a natural 20.", list: nat20Effects },
        { id: "nat1-effect", label: "Nat 1 effects", caption: "Fail with some style.", blurb: "When the dice betray you, at least fail with style.", list: nat1Effects },
        { id: "turn-start-effect", label: "Turn start", caption: "Your entrance, every round.", blurb: "A short token-centered entrance that fires when initiative reaches your character.", list: turnStartEffects },
      ].filter((category) => category.list.length > 0),
    [diceTrails, nat20Effects, nat1Effects, turnStartEffects]
  );

  const categories = useMemo(
    () =>
      catalogue.map(({ id, label, caption, list }) => ({
        id,
        label,
        caption,
        owned: list.filter((item) => item.owned).length,
        total: list.length,
      })),
    [catalogue]
  );

  const shownCategory = catalogue.find((category) => category.id === openCategory) ?? null;

  // Reuse the shop's own preview paths so the panels show the real effect.
  const featuredTrail = useMemo(() => items.find((item) => item.id === "trail-first-flame"), [items]);
  const featuredCrit = useMemo(() => items.find((item) => item.id === "crit20-first-flame"), [items]);

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
      } else if (isTurnStartEffect(item)) {
        if (item.effect === "none") {
          setTurnPreview(null);
          setNotice("No Turn Effect disables the initiative animation.");
        } else {
          const preview = { effect: item.effect, name: item.name, nonce: Date.now() };
          setTurnPreview(preview);
          window.setTimeout(() => {
            setTurnPreview((current) => current?.nonce === preview.nonce ? null : current);
          }, 1500);
          setNotice(`Previewed ${item.name}.`);
        }
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
      playCoinSound();
      playMerchant("money");
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

    if (isTurnStartEffect(item)) {
      const previewCharacter = shop?.previewCharacter;
      const initials = previewCharacter?.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "PC";

      return (
        <span className="emporium-turn-start-preview" aria-hidden>
          <TurnStartEffect effect={item.effect} staticPreview />
          <i
            className={`emporium-turn-start-token${previewCharacter?.imageUrl ? ` has-image ${previewCharacter.imageKind ?? "portrait"}-image` : ""}`}
            title={previewCharacter?.name || "Character preview"}
          >
            {previewCharacter?.imageUrl ? (
              <img src={previewCharacter.imageUrl} alt="" />
            ) : (
              <span>{initials}</span>
            )}
          </i>
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
    <section
      // Anchors the featured bundle's rail and category cards jump to.
      id={`shop-${sectionItems[0]?.type ?? "default"}`}
      className={`emporium-section-block section-${sectionItems[0]?.type ?? "default"}`}
    >
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
              {/* Gilded corner brackets — four spans so each corner can be
                  mitred independently. Purely decorative. */}
              <span className="emporium-filigree" aria-hidden="true">
                <i /><i /><i /><i />
              </span>

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
                  // A brass tag on a string, hung off the shelf edge.
                  <span className="emporium-pricetag">
                    <i aria-hidden="true" />
                    <b>{item.price}</b>
                    <em>VC</em>
                  </span>
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
    <div className="shell emporium-shell">
      {turnPreview && (
        <div className="turn-start-preview-stage" role="status" aria-live="polite">
          <div
            key={turnPreview.nonce}
            className={`turn-start-preview-token${
              shop?.previewCharacter?.imageUrl
                ? ` has-image ${shop.previewCharacter.imageKind ?? "portrait"}-image`
                : ""
            }`}
          >
            <TurnStartEffect effect={turnPreview.effect} preview />
            {shop?.previewCharacter?.imageUrl ? (
              <img
                className="turn-start-preview-character-art"
                src={shop.previewCharacter.imageUrl}
                alt=""
              />
            ) : (
              <strong>
                {shop?.previewCharacter?.name
                  ?.split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("") || "PC"}
              </strong>
            )}
          </div>
        </div>
      )}
      <header className="topbar">
        <Link to="/" className="ghost link">
          ← Campaigns
        </Link>
        {/* Kept as one unit so the bar cannot wrap the shopkeeper away from
            the name he belongs to. */}
        <span className="emporium-title">
          <span className="brand">The Emporium</span>

          <span className="emporium-merchant" aria-hidden="true">
            <img
              key={`${merchantAnimation}-${merchantNonce}`}
              src={merchantGif}
              alt=""
              className={`emporium-merchant-sprite is-${merchantAnimation}`}
            />
          </span>
        </span>

        <span className="spacer" />

        <MusicToggle music={music} className="emporium-music" />

        <div className="emporium-wallet">
          <span>YOUR BALANCE</span>
          <strong>VCoins {shop?.wallet.balance ?? 0}</strong>
          {shop?.wallet.bypass && (
            <small>
              {shop.wallet.bypassReason === "dev"
                ? "Development mode · all unlocked"
                : "Game Master · all unlocked"}
            </small>
          )}
        </div>

        <Link to="/customize" className="ghost link">
          Customize Dice
        </Link>
      </header>

      <main className="content emporium-page is-single-screen">
        {loading && (
          <section className="card">
            <p className="muted">Opening the shop…</p>
          </section>
        )}

        {!loading && featured && (
          <FeaturedBundle
            bundle={featured}
            categories={categories}
            onOpenCategory={setOpenCategory}
            onOpenCache={() => setCacheOpen(true)}
            trailPreview={featuredTrail ? renderPreview(featuredTrail) : undefined}
            critPreview={featuredCrit ? renderPreview(featuredCrit) : undefined}
            onPreviewTrail={featuredTrail ? () => void preview(featuredTrail) : undefined}
            onPreviewCrit={featuredCrit ? () => void preview(featuredCrit) : undefined}
          />
        )}

        {/* Notices float over the panel: the page has no room to grow. */}
        {(error || notice) && (
          <div className="emporium-toasts" role="status">
            {error && <div className="notice error">{error}</div>}
            {notice && <div className="notice">{notice}</div>}
          </div>
        )}
      </main>

      <ShopDialog
        open={!!shownCategory}
        title={shownCategory?.label ?? ""}
        subtitle={shownCategory?.blurb}
        meta={shownCategory && `${shownCategory.list.filter((item) => item.owned).length} / ${shownCategory.list.length} owned`}
        onClose={() => setOpenCategory(null)}
      >
        {shownCategory && renderSection(shownCategory.label, shownCategory.blurb, shownCategory.list)}
      </ShopDialog>

      <ShopDialog
        open={cacheOpen}
        title="Vivid Cache"
        subtitle="One cache. One cosmetic. A chance at the First Flame."
        onClose={() => setCacheOpen(false)}
      >
        <VividCache onChange={loadShop} />
      </ShopDialog>
    </div>
  );
}

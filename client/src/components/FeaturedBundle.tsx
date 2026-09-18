import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import "./FeaturedBundle.css";

type BundleIcon = "dice" | "trail" | "burst" | "fracture" | "ring" | "chat" | "crown";

export interface BundleFeature {
  title: string;
  blurb: string;
  icon: BundleIcon;
  status: "included" | "upcoming";
  cosmeticId?: string;
  /** Either a router path, or "category:<cosmetic type>" to open its popup. */
  target?: string;
}

export interface CosmeticBundle {
  id: string;
  name: string;
  kicker: string;
  quote: string;
  tagline: string;
  art: string | null;
  rarity: "legendary" | "mythic";
  source: { kind: "cache"; price: number } | { kind: "shop" };
  features: BundleFeature[];
  releasedAt: string;
}

export interface CategoryCard {
  id: string;
  label: string;
  caption: string;
  owned: number;
  total: number;
}

const ICONS: Record<BundleIcon, JSX.Element> = {
  dice: <path d="M12 2.6l8 4.7v9.4l-8 4.7-8-4.7V7.3zM12 12l8-4.7M12 12v9.4M12 12L4 7.3" />,
  trail: <path d="M3 16c4.5 1.6 8-.4 9.6-3.6C14.2 9.2 13 6 10 6c-2.4 0-3.4 2.8-1.4 4.2 3 2.2 8.2.6 12.4-4.2" />,
  burst: <path d="M12 2.4l2.1 5.6 5.5 2.2-5.5 2.1-2.1 5.6-2.1-5.6L4.4 10.2l5.5-2.2zM19 16.4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />,
  fracture: <path d="M12 2.6l3.4 6.1-2.3 1.2 3.9 3.4-1.8 1.1 2.4 6-6.2-4.1 1.9-1.3-4.3-3.1 2.4-1.4-4.1-4.2z" />,
  ring: <path d="M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6zM12 1.4l1.5 1.8h-3zM12 22.6l1.5-1.8h-3zM1.4 12l1.8-1.5v3zM22.6 12l-1.8-1.5v3z" />,
  chat: <path d="M3.4 5.6h17.2v10.2H9.8l-4.6 3.6v-3.6H3.4zM7.6 9.4h8.8M7.6 12.4h5.6" />,
  crown: <path d="M3.4 17.6h17.2M4.2 15.4L2.8 6.6l5 3.6L12 4l4.2 6.2 5-3.6-1.4 8.8z" />,
};

function Icon({ name }: { name: BundleIcon }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35"
      strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/**
 * The Emporium. One bundle presented as a product, filling the viewport, with
 * every panel around it a door into part of the catalogue. The page itself
 * never scrolls — the catalogue opens in popups that do.
 *
 * Features marked "upcoming" render as teasers and are deliberately inert:
 * they are cosmetic types that do not exist yet, and a buyer must never read
 * one as something the bundle includes.
 */
export default function FeaturedBundle({
  bundle,
  categories,
  onOpenCategory,
  onOpenCache,
  onPreviewTrail,
  onPreviewCrit,
  trailPreview,
  critPreview,
}: {
  bundle: CosmeticBundle;
  categories: CategoryCard[];
  onOpenCategory: (id: string) => void;
  onOpenCache?: () => void;
  onPreviewTrail?: () => void;
  onPreviewCrit?: () => void;
  /** The shop's own renderPreview output, so these stay in sync with the grid. */
  trailPreview?: ReactNode;
  critPreview?: ReactNode;
}) {
  const navigate = useNavigate();

  const go = (target?: string) => {
    if (!target) return;
    if (target.startsWith("category:")) {
      onOpenCategory(target.slice("category:".length));
      return;
    }
    navigate(target);
  };

  return (
    <section className={`featured-bundle rarity-${bundle.rarity}`} aria-labelledby="featured-bundle-name">
      <div className="featured-rail">
        <p className="featured-kicker">What&rsquo;s inside</p>
        <ul>
          {bundle.features.map((feature) => {
            const interactive = feature.status === "included" && !!feature.target;
            const body = (
              <>
                <span className="featured-feature-icon"><Icon name={feature.icon} /></span>
                <span className="featured-feature-text">
                  <strong>
                    {feature.title}
                    {feature.status === "upcoming" && <em className="featured-soon">Soon</em>}
                  </strong>
                  <small>{feature.blurb}</small>
                </span>
              </>
            );

            return (
              <li key={feature.title} className={`featured-feature is-${feature.status}`}>
                {interactive ? (
                  <button type="button" onClick={() => go(feature.target)}>{body}</button>
                ) : (
                  <div>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="featured-hero">
        <h2 id="featured-bundle-name">{bundle.name}</h2>
        <p className="featured-sub">{bundle.kicker}</p>
        <blockquote>{bundle.quote}</blockquote>

        <div className="featured-art">
          {bundle.art ? (
            <img src={bundle.art} alt={`${bundle.name} key art`} />
          ) : (
            // No key art yet. A lit plinth reads as intentional staging rather
            // than a broken image, and names what belongs here.
            <div className="featured-art-empty" role="img" aria-label={`${bundle.name} artwork coming soon`}>
              <span className="featured-plinth" aria-hidden="true" />
              <p>Key art pending</p>
            </div>
          )}
        </div>

        <p className="featured-tagline">{bundle.tagline}</p>
      </div>

      <div className="featured-previews">
        <article>
          <h3>Roll trail preview</h3>
          <div className="featured-preview-stage">{trailPreview}</div>
          {onPreviewTrail && <button type="button" onClick={onPreviewTrail}>Roll it</button>}
        </article>
        <article>
          <h3>Nat 20 animation</h3>
          <div className="featured-preview-stage">{critPreview}</div>
          {onPreviewCrit && <button type="button" onClick={onPreviewCrit}>Play it</button>}
        </article>
      </div>

      <div className="featured-strip">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className="featured-card"
            onClick={() => onOpenCategory(category.id)}
          >
            <span className="featured-card-label">{category.label}</span>
            <span className="featured-card-caption">{category.caption}</span>
            <span className="featured-card-count">{category.owned} / {category.total} owned</span>
          </button>
        ))}

        {bundle.source.kind === "cache" && (
          <button type="button" className="featured-card featured-card-source" onClick={onOpenCache}>
            <span className="featured-card-label">Only in the Vivid Cache</span>
            <span className="featured-card-caption">{bundle.source.price} VCoins per opening</span>
            <span className="featured-card-count">Open the cache</span>
          </button>
        )}
      </div>
    </section>
  );
}

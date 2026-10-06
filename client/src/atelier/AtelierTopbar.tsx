import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

const ASSET = "/assets/themes/schnee-atelier";

export interface AtelierNavLink {
  label: string;
  to: string;
  active?: boolean;
}

/**
 * The comp's top bar: crest + wordmark, a three-part pill nav, Edit panels,
 * and a gear menu that holds every other campaign link and tool. The menu
 * stays mounted while closed so tools inside it (recaps, theme picker) keep
 * their own state and portals.
 */
export function AtelierTopbar({
  nav,
  editing,
  onToggleEdit,
  editTools,
  menu,
  avatarUrl,
  userName,
}: {
  nav: AtelierNavLink[];
  editing?: boolean;
  onToggleEdit?: () => void;
  editTools?: ReactNode;
  menu: ReactNode;
  avatarUrl?: string;
  userName?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Dialogs opened from the menu render in portals; clicks there keep it open.
      if (!wrap.current?.contains(target) && !target.closest?.("[role='dialog']")) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <header className="topbar campaign-topbar atelier-topbar">
      <Link to="/" className="atelier-wordmark" title="Back to campaigns">
        <img src={`${ASSET}/crest.webp`} alt="" />
        <span>Vivid Realms</span>
      </Link>
      <nav className="atelier-pills" aria-label="Campaign">
        {nav.map((link) => (
          <Link key={link.label} to={link.to} className={link.active ? "is-active" : undefined} aria-current={link.active ? "page" : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>
      <span className="spacer" />
      {editing && editTools}
      {onToggleEdit && (
        <button type="button" className={`atelier-edit${editing ? " is-on" : ""}`} onClick={onToggleEdit}>
          <svg viewBox="0 0 20 20" aria-hidden>
            <rect x="2" y="2" width="6.5" height="6.5" rx="1" />
            <rect x="11.5" y="2" width="6.5" height="6.5" rx="1" />
            <rect x="2" y="11.5" width="6.5" height="6.5" rx="1" />
            <rect x="11.5" y="11.5" width="6.5" height="6.5" rx="1" />
          </svg>
          {editing ? "Done" : "Edit panels"}
        </button>
      )}
      <span className="atelier-divider" aria-hidden />
      <div className="atelier-gear-wrap" ref={wrap}>
        <button type="button" className="atelier-icon-btn" aria-label="Campaign menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" transform="translate(-1 0)" />
          </svg>
        </button>
        <div className="atelier-gear-menu" hidden={!open}>
          {menu}
        </div>
      </div>
      <Link to="/profile" className="atelier-icon-btn atelier-avatar" title={userName ? `${userName} — profile` : "Profile"}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="10.5" fill="none" strokeWidth="1.6" />
            <circle cx="12" cy="9.5" r="3.6" />
            <path d="M5.6 18.6a7.6 7.6 0 0 1 12.8 0A9 9 0 0 1 12 21a9 9 0 0 1-6.4-2.4Z" />
          </svg>
        )}
      </Link>
    </header>
  );
}

/** The centred plaque under the top bar. */
export function AtelierMasthead({ name, sessionNumber, chapter }: { name: string; sessionNumber: number; chapter?: string }) {
  return (
    <section className="atelier-masthead" aria-label="Campaign">
      <div className="atelier-title-plaque">
        <img className="atelier-plaque-spark left" src={`${ASSET}/sparkle.svg`} alt="" />
        <img className="atelier-plaque-spark right" src={`${ASSET}/sparkle.svg`} alt="" />
        <span className="atelier-eyebrow">Schnee Atelier</span>
        <h1>{name}</h1>
        <p>
          {chapter ? `${chapter} · ` : ""}Session {sessionNumber}
        </p>
      </div>
    </section>
  );
}

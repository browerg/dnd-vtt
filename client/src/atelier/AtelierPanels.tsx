import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { DiceThumbnail } from "../components/CollectionDicePreview";
import type { AtelierCharacter, AtelierLogEntry, AtelierMission, AtelierTeamMember } from "./atelierModel";

const ASSET = "/assets/themes/schnee-atelier";

export interface AtelierMenuItem {
  label: string;
  onSelect?: () => void;
  href?: string;
}

/** Panel header: the silver tab label, a centre sparkle, and a ⋮ menu. */
export function AtelierPanelHead({
  title,
  editing,
  menu,
  onRemove,
}: {
  title: string;
  editing: boolean;
  menu: AtelierMenuItem[];
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className={`panel-head atelier-head${editing ? " panel-drag" : ""}`}>
      <span className="atelier-grip" aria-hidden />
      <span className="panel-title atelier-tab">{title}</span>
      <img className="atelier-head-spark" src={`${ASSET}/sparkle.svg`} alt="" />
      {editing && onRemove && (
        <button
          type="button"
          className="panel-remove"
          title="Remove this panel"
          aria-label={`Remove ${title} panel`}
          data-no-drag
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
        >
          <span aria-hidden="true">✕</span>
          <span className="panel-remove-label">Remove</span>
        </button>
      )}
      {menu.length > 0 && (
        <div className="atelier-kebab-wrap" ref={wrap} data-no-drag>
          <button
            type="button"
            className="atelier-kebab"
            aria-label={`${title} options`}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden>⋮</span>
          </button>
          {open && (
            <div className="atelier-menu" role="menu">
              {menu.map((item) =>
                item.href ? (
                  <Link key={item.label} role="menuitem" to={item.href} onClick={() => setOpen(false)}>
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      item.onSelect?.();
                    }}
                  >
                    {item.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AtelierPortrait({ src, name, className = "" }: { src?: string; name: string; className?: string }) {
  return (
    <span className={`atelier-portrait ${className}`}>
      {src ? <img src={src} alt="" /> : <span className="atelier-initial">{name.trim()[0]?.toUpperCase() ?? "?"}</span>}
    </span>
  );
}

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
};
const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

/** The Aura dial: a 270° enamel arc with ticks, the emblem and the pool. */
export function AuraGauge({ aura, auraMax, emblemUrl }: { aura: number; auraMax: number; emblemUrl?: string }) {
  const pct = auraMax > 0 ? Math.max(0, Math.min(1, aura / auraMax)) : 0;
  const start = -135;
  const end = start + 270 * pct;
  const ticks = Array.from({ length: 37 }, (_, i) => start + (270 / 36) * i);
  return (
    <div className="atelier-gauge" role="meter" aria-label="Aura" aria-valuemin={0} aria-valuemax={auraMax} aria-valuenow={aura}>
      <img className="atelier-gauge-star left" src={`${ASSET}/sparkle.svg`} alt="" />
      <img className="atelier-gauge-star right" src={`${ASSET}/sparkle.svg`} alt="" />
      <svg viewBox="0 0 220 190" aria-hidden>
        <defs>
          <linearGradient id="atelier-aura-fill" x1="0" x2="1">
            <stop offset="0" stopColor="#1f63b6" />
            <stop offset="1" stopColor="#4fa3ea" />
          </linearGradient>
        </defs>
        <path d={arc(110, 110, 96, start, 135)} stroke="#c9d5e3" strokeWidth="13" fill="none" />
        <path d={arc(110, 110, 96, start, 135)} stroke="#ffffff" strokeWidth="9" fill="none" />
        {pct > 0 && <path d={arc(110, 110, 96, start, end)} stroke="url(#atelier-aura-fill)" strokeWidth="9" fill="none" />}
        <path d={arc(110, 110, 103, start, 135)} stroke="#9fb2c9" strokeWidth=".8" fill="none" />
        {ticks.map((deg, i) => {
          const [x1, y1] = polar(110, 110, 84, deg);
          const [x2, y2] = polar(110, 110, i % 6 === 0 ? 76 : 80, deg);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8fa3bd" strokeWidth={i % 6 === 0 ? 1.1 : 0.6} />;
        })}
        <path d="M110 4L118 14L110 24L102 14Z" fill="#183b66" stroke="#eef4fb" strokeWidth="1.5" />
        <path d="M110 9L113.5 14L110 19L106.5 14Z" fill="#eef4fb" />
      </svg>
      <div className="atelier-gauge-core">
        {emblemUrl ? <img className="atelier-emblem" src={emblemUrl} alt="" /> : <img className="atelier-emblem glyph" src={`${ASSET}/glyph.svg`} alt="" />}
        <span className="atelier-gauge-label">Aura</span>
        <span className="atelier-gauge-value">
          {aura} <small>/ {auraMax}</small>
        </span>
      </div>
    </div>
  );
}

function Shield({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`atelier-shield${highlight ? " is-main" : ""}`} title={highlight ? "Main attribute" : undefined}>
      <svg viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden>
        <path d="M50 2L98 18V102L50 118L2 102V18Z" vectorEffect="non-scaling-stroke" />
        <path d="M50 7L93 21.5V98.5L50 113L7 98.5V21.5Z" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="atelier-shield-label">{label}</span>
      <strong className="atelier-shield-value">{value}</strong>
      <img className="atelier-shield-mark" src={`${ASSET}/sparkle.svg`} alt="" />
    </div>
  );
}

export function AtelierCharacterCard({ card }: { card: AtelierCharacter }) {
  return (
    <div className="atelier-character">
      <div className="atelier-character-top">
        <AtelierPortrait src={card.portraitUrl} name={card.name} className="large" />
        <div className="atelier-character-id">
          <h2>{card.sheetHref ? <Link to={card.sheetHref}>{card.name}</Link> : card.name}</h2>
          {card.subtitle && <p className="atelier-character-sub">{card.subtitle}</p>}
          {card.emblemUrl ? (
            <img className="atelier-character-emblem" src={card.emblemUrl} alt="" />
          ) : (
            <span className="atelier-character-gem" style={{ background: card.auraColor }} aria-hidden />
          )}
          {card.lines.map((line) => (
            <p key={line} className="atelier-character-line">
              {line}
            </p>
          ))}
        </div>
      </div>
      <AuraGauge aura={card.aura} auraMax={card.auraMax} emblemUrl={card.emblemUrl} />
      <div className={`atelier-shields count-${card.stats.length}`}>
        {card.stats.map((stat) => (
          <Shield key={stat.label} {...stat} />
        ))}
      </div>
      {card.weapon && (
        <section className="atelier-weapon" aria-label="Weapon">
          <h3 className="atelier-rule-heading">
            <span>Weapon</span>
          </h3>
          <div className="atelier-weapon-row">
            <span className="atelier-weapon-art">
              {card.weapon.imageUrl ? <img src={card.weapon.imageUrl} alt="" /> : <img className="glyph" src={`${ASSET}/glyph.svg`} alt="" />}
            </span>
            <div>
              <strong>{card.weapon.name}</strong>
              {card.weapon.subtitle && <p>{card.weapon.subtitle}</p>}
              {card.weapon.tags.length > 0 && (
                <div className="atelier-tags">
                  {card.weapon.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export function AtelierMissionView({ mission, onEdit }: { mission: AtelierMission; onEdit?: () => void }) {
  const empty = !mission.title && !mission.steps.length && !mission.description;
  return (
    <div className="atelier-mission" onDoubleClick={onEdit}>
      <img className="atelier-mission-compass" src={`${ASSET}/compass.svg`} alt="" />
      {empty ? (
        <div className="atelier-mission-empty">
          <p>Your private mission notes. The first line becomes the title, and lines starting with • become numbered steps.</p>
          {onEdit && (
            <button type="button" onClick={onEdit}>
              Write notes
            </button>
          )}
        </div>
      ) : (
        <>
          <header className="atelier-mission-head">
            <svg className="atelier-mission-mark" viewBox="0 0 48 48" aria-hidden>
              <circle cx="24" cy="24" r="13" fill="none" stroke="#1b3561" strokeWidth="2.2" />
              <path d="M24 1L28 20L24 24L20 20Z M24 47L20 28L24 24L28 28Z M1 24L20 20L24 24L20 28Z M47 24L28 28L24 24L28 20Z" fill="#1b3561" />
              <path d="M24 1L24 24L28 20Z M24 47L24 24L20 28Z M1 24L24 24L20 28Z M47 24L24 24L28 20Z" fill="#4d6f9f" />
              <circle cx="24" cy="24" r="3.4" fill="#eef4fb" stroke="#1b3561" strokeWidth="1.5" />
            </svg>
            <h2>{mission.title}</h2>
            {mission.region && (
              <span className="atelier-region">
                <svg viewBox="0 0 16 20" aria-hidden>
                  <path d="M8 1a6.5 6.5 0 0 0-6.5 6.5C1.5 12.4 8 19 8 19s6.5-6.6 6.5-11.5A6.5 6.5 0 0 0 8 1Zm0 9a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
                </svg>
                {mission.region}
              </span>
            )}
          </header>
          {mission.description && <p className="atelier-mission-desc">{mission.description}</p>}
          {mission.steps.length > 0 && (
            <ol className="atelier-steps">
              {mission.steps.map((step, i) => (
                <li key={`${i}-${step.title}`}>
                  <span className="atelier-step-num" aria-hidden>
                    {i + 1}
                  </span>
                  <div>
                    <strong>{step.title}</strong>
                    {step.detail && <p>{step.detail}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

function Bar({ label, value, max, kind }: { label: string; value: number; max: number; kind: "hp" | "aura" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`atelier-bar ${kind}`}>
      <span className="atelier-bar-text">
        <span>{label}</span> <strong>{value}</strong> <small>/ {max}</small>
      </span>
      <span className="atelier-bar-track">
        <span style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

export function AtelierTeamStatus({ members }: { members: AtelierTeamMember[] }) {
  if (!members.length) return <p className="atelier-empty">No characters yet.</p>;
  return (
    <ul className="atelier-team">
      {members.map((member) => (
        <li key={member.id}>
          <AtelierPortrait src={member.portraitUrl} name={member.name} />
          {member.online && <span className="atelier-online" title="Online" />}
          <div className="atelier-team-body">
            <strong>{member.href ? <Link to={member.href}>{member.name}</Link> : member.name}</strong>
            <div className="atelier-team-bars">
              <Bar label="HP" value={member.hp} max={member.maxHp} kind="hp" />
              {member.auraMax != null && <Bar label="Aura" value={member.aura ?? 0} max={member.auraMax} kind="aura" />}
            </div>
          </div>
          {member.emblemUrl && <img className="atelier-team-emblem" src={member.emblemUrl} alt="" />}
        </li>
      ))}
    </ul>
  );
}

export function AtelierSessionLog({ entries }: { entries: AtelierLogEntry[] }) {
  const list = useRef<HTMLDivElement>(null);
  // Follow the newest roll at the bottom of the panel, without moving the page.
  useEffect(() => {
    const scroller = list.current?.closest(".panel-body");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [entries.length]);
  if (!entries.length) return <p className="atelier-empty">No rolls yet. Make history.</p>;
  return (
    <div className="atelier-log" ref={list}>
      {entries.map((entry) => (
        <article key={entry.id} className="atelier-log-entry">
          <AtelierPortrait src={entry.portraitUrl} name={entry.name} />
          <div>
            <header>
              <strong>{entry.name}</strong>
              <time>{entry.time}</time>
            </header>
            <p className="atelier-log-roll" title={entry.title}>
              {entry.rolled} <span className={`atelier-chip ${entry.tone}`}>{entry.total}</span>
            </p>
            <p className="atelier-log-detail">{entry.detail}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

const DICE = [4, 6, 8, 10, 12, 20];

/**
 * The simple roller from the comp: pick a die, press Roll (or R). Clicking
 * the selected die again adds another of it. Remnant starts on its 2d10.
 */
export function AtelierDice({
  system,
  diceTheme,
  stageImage,
  hotkey = true,
  onRoll,
  footer,
  initial,
}: {
  system: string;
  diceTheme?: string;
  stageImage?: string;
  hotkey?: boolean;
  onRoll?: (formula: string) => Promise<void>;
  footer?: ReactNode;
  initial?: { sides: number; count: number };
}) {
  const remnant = system === "remnant";
  const [pick, setPick] = useState(initial ?? { sides: remnant ? 10 : 20, count: remnant ? 2 : 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formula = `${pick.count}d${pick.sides}`;

  const roll = useRef<() => void>(() => {});
  roll.current = async () => {
    if (!onRoll || busy) return;
    setBusy(true);
    setError("");
    try {
      await onRoll(formula);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!hotkey || !onRoll) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "r" || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      event.preventDefault();
      roll.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey, onRoll]);

  const choose = (sides: number) =>
    setPick((current) => (current.sides === sides ? { sides, count: Math.min(current.count + 1, 9) } : { sides, count: 1 }));

  return (
    <div className="atelier-dice">
      <div className={`atelier-dice-stage${stageImage ? " is-art" : ""}`}>
        {stageImage ? (
          <img src={stageImage} alt="" />
        ) : (
          <>
            <img className="atelier-dice-circle" src={`${ASSET}/circle.svg`} alt="" />
            <span className="atelier-dice-die">
              <DiceThumbnail theme={diceTheme || "white"} />
            </span>
          </>
        )}
      </div>
      <div className="atelier-dice-controls">
        <p className="atelier-rule-heading centered">
          <span>Select die</span>
        </p>
        <div className="atelier-die-row" role="radiogroup" aria-label="Select die">
          {DICE.map((sides) => {
            const active = pick.sides === sides;
            return (
              <button
                key={sides}
                type="button"
                className={`atelier-die${active ? " is-active" : ""}`}
                role="radio"
                aria-checked={active}
                onClick={() => choose(sides)}
                title={active ? "Click again to add another" : undefined}
              >
                d{sides}
                {active && pick.count > 1 && <span className="atelier-die-count">×{pick.count}</span>}
              </button>
            );
          })}
        </div>
        <button type="button" className="atelier-roll" disabled={!onRoll || busy} onClick={() => roll.current()}>
          Roll
        </button>
        <p className="atelier-roll-hint">{pick.count > 1 ? `${formula} · ` : ""}Click or press R</p>
        {error && <p className="error small">{error}</p>}
        {footer}
      </div>
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import "./TokenQuickCard.css";

// The card that pops up beside a selected token so the GM can run a fight
// from the map instead of the sidebar: HP/Aura, a damage box that follows the
// handbook's Aura → Armor → HP rules (applied on the server), quick rolls,
// conditions and the common token actions. Players get a read-only version
// for their own token.

export interface QuickCardToken {
  id: number;
  name: string;
  color: string;
  imageUrl: string;
  portraitUrl: string;
  characterId: number | null;
  hp: number | null;
  maxHp: number | null;
  aura: number | null;
  auraMax: number | null;
  auraColor: string;
  conditions: string[];
}

export interface QuickRoll {
  label: string;
  formula: string;
  title: string;
}

export interface VitalsResult {
  armorBlocked: number;
  toTempHp: number;
  toAura: number;
  toHp: number;
  auraBroke: boolean;
  reachedZeroHp: boolean;
}

interface Props {
  token: QuickCardToken;
  campaignId: number;
  /** Token centre in viewport pixels, and its on-screen radius. */
  anchor: { x: number; y: number; radius: number };
  viewport: { width: number; height: number };
  canEdit: boolean;
  subtitle: string;
  armor: number;
  rolls: QuickRoll[];
  conditionOptions: readonly string[];
  stateLabel: string;
  actions: ReactNode;
  onApply: (action: "damage" | "heal" | "aura", amount: number, ignoreArmor: boolean) => Promise<VitalsResult | null>;
  onToggleCondition: (condition: string) => void;
  onRoll: (roll: QuickRoll) => void;
  onClose: () => void;
}

const CARD_GAP = 14;
const EDGE = 8;

function Bar({ label, value, max, kind, color }: { label: string; value: number; max: number; kind: "hp" | "aura"; color?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`tqc-bar is-${kind}${value <= 0 ? " is-empty" : ""}`}>
      <div className="tqc-bar-label">
        <span>{label}</span>
        <strong>
          {value} / {max}
        </strong>
      </div>
      <div className="tqc-bar-track">
        <div className="tqc-bar-fill" style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }} />
      </div>
    </div>
  );
}

const describe = (result: VitalsResult) => {
  const parts: string[] = [];
  if (result.toAura) parts.push(`−${result.toAura} Aura`);
  if (result.armorBlocked) parts.push(`${result.armorBlocked} blocked by armor`);
  if (result.toTempHp) parts.push(`−${result.toTempHp} temp HP`);
  if (result.toHp) parts.push(`−${result.toHp} HP`);
  if (!parts.length) parts.push("No damage got through");
  if (result.auraBroke) parts.push("Aura broken!");
  if (result.reachedZeroHp) parts.push("Down to 0 HP");
  return parts.join(" · ");
};

export default function TokenQuickCard({
  token,
  campaignId,
  anchor,
  viewport,
  canEdit,
  subtitle,
  armor,
  rolls,
  conditionOptions,
  stateLabel,
  actions,
  onApply,
  onToggleCondition,
  onRoll,
  onClose,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 300, height: 260 });
  const [amount, setAmount] = useState("");
  const [ignoreArmor, setIgnoreArmor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [addingCondition, setAddingCondition] = useState(false);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.offsetWidth, height: el.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setAmount("");
    setFeedback("");
    setError("");
    setIgnoreArmor(false);
    setAddingCondition(false);
  }, [token.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Sit to the right of the token; flip left near the edge; keep on screen.
  let left = anchor.x + anchor.radius + CARD_GAP;
  if (left + size.width > viewport.width - EDGE) left = anchor.x - anchor.radius - CARD_GAP - size.width;
  left = Math.max(EDGE, Math.min(left, viewport.width - size.width - EDGE));
  const top = Math.max(EDGE, Math.min(anchor.y - 48, viewport.height - size.height - EDGE));

  const hasAura = token.auraMax != null && token.auraMax > 0 && token.aura != null;
  const hasHp = token.maxHp != null && token.hp != null;
  const art = token.imageUrl || token.portraitUrl;

  const apply = async (action: "damage" | "heal" | "aura", event?: FormEvent) => {
    event?.preventDefault();
    const value = Math.floor(Number(amount));
    if (!amount.trim() || !Number.isFinite(value) || value < 0) {
      setError("Enter an amount first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await onApply(action, value, ignoreArmor);
      setFeedback(
        action === "damage" && result
          ? describe(result)
          : action === "heal"
            ? `+${value} HP`
            : `+${value} Aura`
      );
      setAmount("");
    } catch (e: any) {
      setError(e.message ?? "That didn't go through.");
    } finally {
      setBusy(false);
    }
  };

  const remaining = conditionOptions.filter((c) => !token.conditions.includes(c));

  return (
    <div
      ref={cardRef}
      className="token-quick-card"
      role="dialog"
      aria-label={`${token.name} quick actions`}
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <header className="tqc-head">
        <div className="tqc-avatar" style={{ background: art ? "transparent" : token.color }}>
          {art ? (
            <img src={art} alt="" />
          ) : (
            <span>
              {token.name
                .split(/\s+/)
                .slice(0, 2)
                .map((word) => word[0])
                .join("")
                .toUpperCase()}
            </span>
          )}
        </div>
        <div className="tqc-title">
          <strong>{token.name}</strong>
          {subtitle && <small>{subtitle}</small>}
        </div>
        <button type="button" className="tqc-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      {stateLabel && <div className="tqc-state">{stateLabel}</div>}

      {(hasAura || hasHp) && (
        <div className="tqc-bars">
          {hasAura && (
            <Bar label="Aura" value={token.aura as number} max={token.auraMax as number} kind="aura" color={token.auraColor} />
          )}
          {hasHp && <Bar label="HP" value={token.hp as number} max={token.maxHp as number} kind="hp" />}
        </div>
      )}

      {canEdit && (hasAura || hasHp) && (
        <form className="tqc-damage" onSubmit={(event) => apply("damage", event)}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            placeholder="0"
            aria-label="Amount"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError("");
            }}
          />
          <button type="submit" className="tqc-hit" disabled={busy}>
            Damage
          </button>
          {hasHp && (
            <button type="button" className="tqc-heal" disabled={busy} onClick={() => apply("heal")}>
              Heal
            </button>
          )}
          {hasAura && (
            <button
              type="button"
              className="tqc-aura"
              disabled={busy}
              title="Restore Aura (focus round, Intercept, Semblance…)"
              onClick={() => apply("aura")}
            >
              +Aura
            </button>
          )}
        </form>
      )}
      {canEdit && armor > 0 && (
        <label className="tqc-armor">
          <input type="checkbox" checked={ignoreArmor} onChange={(event) => setIgnoreArmor(event.target.checked)} />
          Ignore armor ({armor}) — weak-point shot or Expose
        </label>
      )}
      {error && <div className="tqc-error">{error}</div>}
      {feedback && !error && <div className="tqc-feedback">{feedback}</div>}

      {canEdit && rolls.length > 0 && (
        <div className="tqc-rolls">
          {rolls.map((roll) => (
            <button key={`${roll.label}-${roll.formula}`} type="button" title={roll.title} onClick={() => onRoll(roll)}>
              {roll.label}
              <small>{roll.formula}</small>
            </button>
          ))}
        </div>
      )}

      {(token.conditions.length > 0 || canEdit) && (
        <div className="tqc-conditions">
          {token.conditions.map((condition) =>
            canEdit ? (
              <button
                key={condition}
                type="button"
                className="tqc-chip"
                title={`Remove ${condition}`}
                onClick={() => onToggleCondition(condition)}
              >
                {condition} <span aria-hidden="true">×</span>
              </button>
            ) : (
              <span key={condition} className="tqc-chip">
                {condition}
              </span>
            )
          )}
          {canEdit &&
            (addingCondition ? (
              <select
                autoFocus
                className="tqc-condition-picker"
                aria-label="Add condition"
                value=""
                onChange={(event) => {
                  if (event.target.value) onToggleCondition(event.target.value);
                  setAddingCondition(false);
                }}
                onBlur={() => setAddingCondition(false)}
              >
                <option value="">Add condition…</option>
                {remaining.map((condition) => (
                  <option key={condition}>{condition}</option>
                ))}
              </select>
            ) : (
              remaining.length > 0 && (
                <button type="button" className="tqc-add-condition" onClick={() => setAddingCondition(true)}>
                  + Condition
                </button>
              )
            ))}
        </div>
      )}

      <footer className="tqc-actions">
        {actions}
        {token.characterId != null && (
          <Link to={`/campaigns/${campaignId}/characters/${token.characterId}`} target="_blank" rel="noreferrer">
            Sheet ↗
          </Link>
        )}
      </footer>
    </div>
  );
}

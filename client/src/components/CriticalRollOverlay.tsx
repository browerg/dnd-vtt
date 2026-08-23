import { useEffect, useMemo, useState } from "react";
import "./CriticalRollOverlay.css";
import "./CriticalRollEffects.css";

export type CriticalRollKind = "nat20" | "nat1";
export type CriticalEffectStyle =
  | "golden"
  | "rose"
  | "lightning"
  | "fracture"
  | "smoke"
  | "debris";

export interface CriticalRollEventDetail {
  kind: CriticalRollKind;
  userName?: string;
  label?: string;
  effect?: string;
}

interface ActiveCritical extends CriticalRollEventDetail {
  id: number;
  system: "remnant" | "dnd5e";
  effect: CriticalEffectStyle;
}

const EVENT_NAME = "tabletop:critical-roll";
let eventId = 0;

const NAT20_EFFECTS = new Set<CriticalEffectStyle>(["golden", "rose", "lightning"]);
const NAT1_EFFECTS = new Set<CriticalEffectStyle>(["fracture", "smoke", "debris"]);

function currentSystem(): "remnant" | "dnd5e" {
  const system = document.querySelector<HTMLElement>("[data-system]")?.dataset.system;
  return system === "remnant" ? "remnant" : "dnd5e";
}

function campaignIdFromPath(): number | null {
  const match = window.location.pathname.match(/\/campaigns\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const campaignId = Number(match[1]);
  return Number.isInteger(campaignId) && campaignId > 0 ? campaignId : null;
}

function normalizeEffect(kind: CriticalRollKind, value?: string): CriticalEffectStyle {
  if (value) {
    const effect = value as CriticalEffectStyle;
    if (kind === "nat20" && NAT20_EFFECTS.has(effect)) return effect;
    if (kind === "nat1" && NAT1_EFFECTS.has(effect)) return effect;
  }
  return kind === "nat20" ? "golden" : "fracture";
}

async function resolveEffect(detail: CriticalRollEventDetail): Promise<CriticalEffectStyle> {
  if (detail.effect) return normalizeEffect(detail.kind, detail.effect);

  const campaignId = campaignIdFromPath();
  const userName = detail.userName?.trim();
  if (!campaignId || !userName) return normalizeEffect(detail.kind);

  const query = new URLSearchParams({
    campaignId: String(campaignId),
    userName,
    kind: detail.kind,
  });

  try {
    const response = await fetch(`/api/shop/critical-effect?${query.toString()}`);
    if (!response.ok) return normalizeEffect(detail.kind);
    const body = (await response.json()) as { effect?: string };
    return normalizeEffect(detail.kind, body.effect);
  } catch {
    return normalizeEffect(detail.kind);
  }
}

function playCriticalSound(kind: CriticalRollKind, effect: CriticalEffectStyle) {
  if (localStorage.getItem("critical-roll-sound") === "off") return;

  try {
    const AudioContextClass =
      window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const start = context.currentTime + 0.015;
    const master = context.createGain();

    const effectBoost =
      effect === "lightning" ? 1.08 :
      effect === "debris" ? 1.05 :
      effect === "smoke" ? 0.86 :
      1;

    master.gain.setValueAtTime(0.0001, start);
    master.gain.exponentialRampToValueAtTime((kind === "nat20" ? 0.16 : 0.12) * effectBoost, start + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, start + (kind === "nat20" ? 1.15 : 0.92));
    master.connect(context.destination);

    let frequencies =
      kind === "nat20" ? [392, 523.25, 659.25, 783.99] : [196, 130.81, 82.41];

    if (effect === "rose") frequencies = [349.23, 440, 523.25, 698.46];
    if (effect === "lightning") frequencies = [523.25, 783.99, 1046.5, 1318.51];
    if (effect === "smoke") frequencies = [146.83, 110, 73.42];
    if (effect === "debris") frequencies = [164.81, 98, 55];

    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const voice = context.createGain();
      const noteStart = start + index * (kind === "nat20" ? 0.09 : 0.12);
      const noteLength = kind === "nat20" ? 0.58 : 0.48;

      oscillator.type =
        effect === "lightning" ? "square" :
        effect === "smoke" ? "sine" :
        kind === "nat20" ? "triangle" :
        "sawtooth";

      oscillator.frequency.setValueAtTime(frequency, noteStart);
      if (kind === "nat1") {
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(42, frequency * 0.65),
          noteStart + noteLength
        );
      }

      voice.gain.setValueAtTime(0.0001, noteStart);
      voice.gain.exponentialRampToValueAtTime(kind === "nat20" ? 0.34 : 0.24, noteStart + 0.025);
      voice.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteLength);

      oscillator.connect(voice);
      voice.connect(master);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + noteLength + 0.03);
    });

    window.setTimeout(() => void context.close().catch(() => {}), 1700);
  } catch {
    // Browsers may block audio until the page has received a user gesture.
  }
}

export default function CriticalRollOverlay() {
  const [queue, setQueue] = useState<ActiveCritical[]>([]);
  const [active, setActive] = useState<ActiveCritical | null>(null);

  useEffect(() => {
    let cancelled = false;

    const receive = (event: Event) => {
      const detail = (event as CustomEvent<CriticalRollEventDetail>).detail;
      if (!detail || (detail.kind !== "nat20" && detail.kind !== "nat1")) return;

      void resolveEffect(detail).then((effect) => {
        if (cancelled) return;
        setQueue((pending) => [
          ...pending.slice(-3),
          {
            ...detail,
            effect,
            id: ++eventId,
            system: currentSystem(),
          },
        ]);
      });
    };

    window.addEventListener(EVENT_NAME, receive);
    return () => {
      cancelled = true;
      window.removeEventListener(EVENT_NAME, receive);
    };
  }, []);

  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActive(next);
  }, [active, queue]);

  useEffect(() => {
    if (!active) return;
    playCriticalSound(active.kind, active.effect);
    const timer = window.setTimeout(
      () => setActive(null),
      active.kind === "nat20" ? 3300 : 2900
    );
    return () => window.clearTimeout(timer);
  }, [active]);

  const particles = useMemo(
    () => Array.from({ length: 20 }, (_, index) => <span key={index} />),
    []
  );

  if (!active) return null;

  const success = active.kind === "nat20";
  const userName = active.userName?.trim() || "A player";
  const remnant = active.system === "remnant";

  return (
    <div
      key={active.id}
      className={`critical-roll-overlay ${active.kind} ${active.system} effect-${active.effect}`}
      role="status"
      aria-live="assertive"
    >
      <div className="critical-screen-flash" aria-hidden />
      <div className="critical-vignette" aria-hidden />
      <div className="critical-scan" aria-hidden />

      <div className="critical-rings" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <div className="critical-particles" aria-hidden>
        {particles}
      </div>

      {!success && (
        <div className="critical-fractures" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      )}

      <div className="critical-emblem" aria-hidden>
        <span className="critical-emblem-frame" />
        <span className="critical-emblem-shadow">{success ? "20" : "1"}</span>
        <strong>{success ? "20" : "1"}</strong>
      </div>

      <div className="critical-banner">
        <span className="critical-banner-line" aria-hidden />
        <p className="critical-kicker">
          {success ? "NATURAL 20" : "NATURAL 1"}
        </p>
        <h2>{success ? "CRITICAL SUCCESS" : "CRITICAL FAILURE"}</h2>
        <p className="critical-message">
          <strong>{userName}</strong>
          <span>
            {success
              ? remnant
                ? "Combat performance: exceptional."
                : "The table erupts in celebration."
              : remnant
                ? "Combat performance: compromised."
                : "The dice have made their decision."}
          </span>
        </p>
        {active.label && <p className="critical-label">{active.label}</p>}
        <span className="critical-banner-line bottom" aria-hidden />
      </div>
    </div>
  );
}

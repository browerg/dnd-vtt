import { SPECIAL_CRITICALS, type SpecialCriticalStyle } from "../../../shared/specialCriticals";
import SpecialCriticalSpectacle from "./SpecialCriticalSpectacle";
import SeveredFateSpectacle from "./SeveredFateSpectacle";
import MimicSpectacle from "./MimicSpectacle";
import AbyssalGazeSpectacle from "./AbyssalGazeSpectacle";
import MainCharacterSpectacle from "./MainCharacterSpectacle";
import JackpotSpectacle from "./JackpotSpectacle";
import LegendForgedSpectacle from "./LegendForgedSpectacle";
import {
  playAbyssalGazeSound, playJackpotSound, playLegendForgedSound, playMainCharacterSound, playMimicSound, playSeveredFateSound,
} from "../criticalSounds";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import "./CriticalRollOverlay.css";
import "./CriticalRollEffects.css";

export type CriticalRollKind = "nat20" | "nat1";
export type CriticalEffectStyle =
  | SpecialCriticalStyle
  | "first-flame"
  | "golden"
  | "rose"
  | "lightning"
  | "fracture"
  | "smoke"
  | "debris"
  | "severed-fate"
  | "mimic"
  | "abyssal-gaze"
  | "main-character"
  | "jackpot"
  | "legend-forged";

export interface CriticalRollEventDetail {
  kind: CriticalRollKind;
  userName?: string;
  label?: string;
  effect?: string;
  defaultEffect?: string;
  preview?: boolean;
}

interface ActiveCritical extends CriticalRollEventDetail {
  id: number;
  system: "remnant" | "dnd5e";
  effect: CriticalEffectStyle;
}

const EVENT_NAME = "tabletop:critical-roll";
let eventId = 0;

const NAT20_EFFECTS = new Set<CriticalEffectStyle>(["golden", "rose", "lightning", "first-flame", "main-character", "jackpot", "legend-forged", ...SPECIAL_CRITICALS.map(effect => effect.effect)]);
const NAT1_EFFECTS = new Set<CriticalEffectStyle>(["fracture", "smoke", "debris", "first-flame", "severed-fate", "mimic", "abyssal-gaze"]);

/**
 * The premium spectacles take over the whole screen with their own scene,
 * score, length and line. Effect names are unique across Nat 20s and Nat 1s,
 * so one table serves both. Adding one is an entry here plus its component.
 */
const SPECTACLES: Partial<Record<CriticalEffectStyle, { scene: (props: { userName: string }) => JSX.Element; sound: () => void; duration: number; message: string }>> = {
  "severed-fate": { scene: SeveredFateSpectacle, sound: playSeveredFateSound, duration: 4000, message: "Fate has cut your thread." },
  mimic: { scene: MimicSpectacle, sound: playMimicSound, duration: 4200, message: "It was a mimic." },
  "abyssal-gaze": { scene: AbyssalGazeSpectacle, sound: playAbyssalGazeSound, duration: 4400, message: "Something has noticed you." },
  "main-character": { scene: MainCharacterSpectacle, sound: playMainCharacterSound, duration: 4000, message: "Main character energy." },
  jackpot: { scene: JackpotSpectacle, sound: playJackpotSound, duration: 4400, message: "The dice pay out." },
  "legend-forged": { scene: LegendForgedSpectacle, sound: playLegendForgedSound, duration: 4400, message: "A legend is forged." },
};

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
  if (!campaignId || !userName) return normalizeEffect(detail.kind, detail.defaultEffect);

  const query = new URLSearchParams({
    campaignId: String(campaignId),
    userName,
    kind: detail.kind,
  });

  try {
    const response = await fetch(`/api/shop/critical-effect?${query.toString()}`);
    if (!response.ok) return normalizeEffect(detail.kind, detail.defaultEffect);
    const body = (await response.json()) as { effect?: string; equipped?: boolean };
    return normalizeEffect(detail.kind, body.equipped === false ? detail.defaultEffect ?? body.effect : body.effect);
  } catch {
    return normalizeEffect(detail.kind, detail.defaultEffect);
  }
}

function playCriticalSound(kind: CriticalRollKind, effect: CriticalEffectStyle) {
  if (localStorage.getItem("critical-roll-sound") === "off") return;
  const spectacle = SPECTACLES[effect];
  if (spectacle) return spectacle.sound();

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

    if (effect === "void-collapse") frequencies = [130.81, 196, 392, 783.99];
    if (effect === "heavens-lance") frequencies = [523.25, 659.25, 783.99, 1046.5];
    if (effect === "chronobreak") frequencies = [783.99, 392, 523.25, 1046.5];
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
        if (detail.preview) {
          setActive({ ...detail, effect, id: ++eventId, system: currentSystem() });
          return;
        }
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
    if (!active.preview && active.effect !== "first-flame") playCriticalSound(active.kind, active.effect);
    const timer = window.setTimeout(
      () => setActive(null),
      active.effect === "first-flame" ? 3800 : SPECTACLES[active.effect]?.duration ?? (active.kind === "nat20" ? 3300 : 2900)
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
  const spectacle = SPECTACLES[active.effect];
  const Spectacle = spectacle?.scene;

  return (
    <div
      key={active.id}
      className={`critical-roll-overlay ${active.kind} ${active.system} effect-${active.effect}`}
      role="status"
      aria-live="assertive"
    >
      <SpecialCriticalSpectacle effect={active.effect} />
      {Spectacle && <Spectacle userName={userName} />}
      {active.effect === "first-flame" && <div className="flame-spectacle" aria-hidden="true">
        {success && <div className="flame-awakening">
          <svg className="flame-seal" viewBox="0 0 600 600">
            <g className="flame-seal-half left"><path d="M300 55 90 170 70 400 300 540 280 420 315 350 280 260 320 180Z" /></g>
            <g className="flame-seal-half right"><path d="M300 55 510 170 530 400 300 540 280 420 315 350 280 260 320 180Z" /></g>
          </svg>
          <svg className="flame-crown" viewBox="0 0 600 600">
            <path className="flame-crown-body" d="m150 245-35-140 100 80 30-120 55 105 55-105 30 120 100-80-35 140-75-24-75 20-75-20Z" />
            <path className="flame-crown-inlay" d="m158 211 62-7 26-68 54 63 54-63 26 68 62 7M225 221l-12-36M300 241v-42M375 221l12-36" />
            <path className="flame-crown-jewel" d="m300 170 15 23-15 20-15-20Z" />
          </svg>
          <svg className="flame-script-ring" viewBox="0 0 600 600">
            <circle cx="300" cy="300" r="256" />
            {Array.from({ length: 12 }, (_, i) => <path key={i} transform={`rotate(${i*30} 300 300)`} d="M300 22v40m-9-27 18 14m-18 0 18-14" />)}
          </svg>
        </div>}
        <div className="flame-eclipse" />
        <div className="flame-shockwave" /><div className="flame-shockwave second" />
        <div className="flame-rays">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ "--angle": `${i * 15}deg`, "--delay": `${(i % 5) * 45}ms` } as CSSProperties} />)}</div>
        <svg className="flame-faults" viewBox="0 0 1000 700" preserveAspectRatio="none">
          <path pathLength="1" d="M500 350 L420 300 395 215 315 190 280 95 150 0 M420 300 L280 325 200 260 0 290 M395 215 L445 100 415 0 M500 350 L610 275 650 185 770 155 840 0 M650 185 L860 245 1000 180 M500 350 L630 390 680 485 810 520 900 700 M680 485 L620 580 655 700 M500 350 L420 440 330 465 280 570 130 700 M330 465 L135 435 0 520" />
        </svg>
        <div className="flame-shards">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ "--angle": `${i * 22.5}deg`, "--delay": `${(i % 4) * 70}ms` } as CSSProperties} />)}</div>
      </div>}
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
            {spectacle
              ? spectacle.message
              : success
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

import { useEffect, useMemo, useState } from "react";
import "./CriticalRollOverlay.css";

export type CriticalRollKind = "nat20" | "nat1";

export interface CriticalRollEventDetail {
  kind: CriticalRollKind;
  userName?: string;
  label?: string;
}

interface ActiveCritical extends CriticalRollEventDetail {
  id: number;
  system: "remnant" | "dnd5e";
}

const EVENT_NAME = "tabletop:critical-roll";
let eventId = 0;

function currentSystem(): "remnant" | "dnd5e" {
  const system = document.querySelector<HTMLElement>("[data-system]")?.dataset.system;
  return system === "remnant" ? "remnant" : "dnd5e";
}

function playCriticalSound(kind: CriticalRollKind) {
  if (localStorage.getItem("critical-roll-sound") === "off") return;

  try {
    const AudioContextClass =
      window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const start = context.currentTime + 0.015;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, start);
    master.gain.exponentialRampToValueAtTime(kind === "nat20" ? 0.16 : 0.12, start + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, start + (kind === "nat20" ? 1.15 : 0.92));
    master.connect(context.destination);

    const frequencies = kind === "nat20" ? [392, 523.25, 659.25, 783.99] : [196, 130.81, 82.41];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const voice = context.createGain();
      const noteStart = start + index * (kind === "nat20" ? 0.09 : 0.12);
      const noteLength = kind === "nat20" ? 0.58 : 0.48;

      oscillator.type = kind === "nat20" ? "triangle" : "sawtooth";
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      if (kind === "nat1") {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(42, frequency * 0.65), noteStart + noteLength);
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
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<CriticalRollEventDetail>).detail;
      if (!detail || (detail.kind !== "nat20" && detail.kind !== "nat1")) return;

      setQueue((pending) => [
        ...pending.slice(-3),
        {
          ...detail,
          id: ++eventId,
          system: currentSystem(),
        },
      ]);
    };

    window.addEventListener(EVENT_NAME, receive);
    return () => window.removeEventListener(EVENT_NAME, receive);
  }, []);

  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActive(next);
  }, [active, queue]);

  useEffect(() => {
    if (!active) return;
    playCriticalSound(active.kind);
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
      className={`critical-roll-overlay ${active.kind} ${active.system}`}
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

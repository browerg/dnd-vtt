import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { api } from "../api";
import type { ProfileBadge } from "./BadgeShowcase";
import "./AchievementNotifications.css";

const SOUND_KEY = "achievement-unlock-sound";

export default function AchievementNotifications() {
  const [queue, setQueue] = useState<ProfileBadge[]>([]);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(SOUND_KEY) === "off"; } catch { return false; }
  });
  const audio = useRef<AudioContext | null>(null);
  const played = useRef<string | null>(null);
  const current = queue[0];

  useEffect(() => {
    const seen = new Set<string>();
    const socket = io();
    socket.on("achievement:unlocked", (badge: ProfileBadge) => {
      if (!badge?.id || seen.has(badge.id)) return;
      seen.add(badge.id);
      setQueue((previous) => [...previous, badge]);
      window.dispatchEvent(new Event("achievements:updated"));
    });
    // Reconcile existing campaign/profile data after this socket can receive
    // account notifications. The server awards each achievement only once.
    socket.on("connect", () => { void api("/api/achievements").catch(() => {}); });
    // Browsers require a player gesture before audio can start. Keep this
    // context ready so a later quest completion can play its chime too.
    const enableAudio = () => {
      try {
        if (!audio.current) audio.current = new AudioContext();
        if (audio.current.state === "suspended") void audio.current.resume().catch(() => {});
      } catch { /* The notification still works without audio support. */ }
    };
    window.addEventListener("pointerdown", enableAudio);
    window.addEventListener("keydown", enableAudio);
    return () => {
      socket.disconnect();
      window.removeEventListener("pointerdown", enableAudio);
      window.removeEventListener("keydown", enableAudio);
      if (audio.current) void audio.current.close().catch(() => {});
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => setQueue((previous) => previous.slice(1)), 6500);
    return () => window.clearTimeout(timer);
  }, [current]);

  useEffect(() => {
    if (!current || played.current === current.id) return;
    played.current = current.id;
    const context = audio.current;
    if (muted || !context || context.state !== "running") return;
    // A soft rising major arpeggio with a bell-like octave shimmer.
    const start = context.currentTime + .02;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const when = start + index * .12;
      for (const [multiple, volume] of [[1, .07], [2, .014]]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency * multiple;
        gain.gain.setValueAtTime(.0001, when);
        gain.gain.exponentialRampToValueAtTime(volume, when + .015);
        gain.gain.exponentialRampToValueAtTime(.0001, when + .65);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(when); oscillator.stop(when + .7);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
    });
  }, [current, muted]);

  const toggleSound = () => {
    setMuted((value) => {
      try { localStorage.setItem(SOUND_KEY, value ? "on" : "off"); } catch { /* Optional preference. */ }
      return !value;
    });
  };

  return <aside className="achievement-notifications" aria-label="Achievement notifications">
    <div role="status" aria-live="polite" aria-atomic="true">
      {current && <div className="achievement-unlock-toast" key={current.id}>
        <img src={current.badgeThumbnail} srcSet={`${current.badgeThumbnail} 1x, ${current.badgeThumbnail2x} 2x`} alt="" width="72" height="72" decoding="async" />
        <div><span className="achievement-unlock-kicker">Achievement unlocked</span>
          <strong>{current.name}</strong><p>{current.description}</p>
          <Link to="/profile" onClick={() => setQueue((previous) => previous.slice(1))}>View your badges →</Link>
        </div>
      </div>}
    </div>
    {current && <div className="achievement-toast-controls">
      <button type="button" onClick={toggleSound} aria-pressed={muted}>{muted ? "Enable unlock sound" : "Mute unlock sound"}</button>
      <button type="button" onClick={() => setQueue((previous) => previous.slice(1))} aria-label="Dismiss achievement notification">Dismiss</button>
    </div>}
  </aside>;
}

import { useEffect, useRef, useState } from "react";
import { gatewayMusic, playWelcomeChime } from "../loginAudio";
import "./WelcomeOverlay.css";

// Long enough to read a name, short enough that it never becomes the thing
// standing between a player and their table.
const HOLD_MS = 1900;
const LEAVE_MS = 1100;
const REDUCED_HOLD_MS = 900;
const REDUCED_LEAVE_MS = 600;

/**
 * The greeting between signing in and the dashboard. The dashboard mounts
 * underneath the moment the session lands, so this is a veil being drawn back
 * rather than a page of its own — by the time it clears, the table is there.
 */
export default function WelcomeOverlay({
  name,
  returning,
  onDone,
}: {
  name: string;
  returning: boolean;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const finish = useRef(onDone);
  finish.current = onDone;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduced ? REDUCED_HOLD_MS : HOLD_MS;
    const leave = reduced ? REDUCED_LEAVE_MS : LEAVE_MS;

    playWelcomeChime();
    // The gateway music rides the whole greeting out instead of being cut off
    // at the route change.
    gatewayMusic.stop(hold + leave);

    const toLeaving = window.setTimeout(() => setLeaving(true), hold);
    const toDone = window.setTimeout(() => finish.current(), hold + leave);
    return () => {
      window.clearTimeout(toLeaving);
      window.clearTimeout(toDone);
    };
  }, []);

  return (
    <div className={`welcome-veil${leaving ? " is-leaving" : ""}`} role="status" aria-live="polite">
      <div className="welcome-rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="welcome-copy">
        <p className="welcome-eyebrow">{returning ? "Welcome back" : "Welcome"}</p>
        <p className="welcome-name">{name}</p>
        <span className="welcome-rule" aria-hidden="true" />
        <p className="welcome-sub">Opening your table…</p>
      </div>
    </div>
  );
}

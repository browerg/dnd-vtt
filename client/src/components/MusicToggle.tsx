import type { BackgroundMusic } from "../useBackgroundMusic";
import "./MusicToggle.css";

/**
 * Pause control for page background music, with a volume slider that appears
 * on hover. Required rather than decorative: anything that starts playing on
 * its own needs a way to stop it.
 *
 * The slider stays in the DOM while hidden so it remains reachable by keyboard
 * — tabbing to it trips :focus-within, which reveals it.
 */
export default function MusicToggle({ music, className = "" }: { music: BackgroundMusic; className?: string }) {
  const state = music.on ? (music.blocked ? "blocked" : "playing") : "off";
  const percent = Math.round(music.volume * 100);

  return (
    <div className={`music-control ${className}`.trim()} data-state={state}>
      <button
        type="button"
        className="music-toggle"
        data-state={state}
        onClick={music.toggle}
        aria-pressed={music.on}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M2 6.2h2.4L7.6 3.4v9.2L4.4 9.8H2z" strokeLinejoin="round" />
          {music.on ? (
            <>
              <path className="music-toggle-wave" d="M9.9 6.1a2.7 2.7 0 0 1 0 3.8" strokeLinecap="round" />
              <path className="music-toggle-wave" d="M11.9 4.3a5.4 5.4 0 0 1 0 7.4" strokeLinecap="round" />
            </>
          ) : (
            <path d="M10.3 6.3l3.4 3.4M13.7 6.3l-3.4 3.4" strokeLinecap="round" />
          )}
        </svg>
        {music.on ? (music.blocked ? "Click anywhere to start the music" : "Music on") : "Music off"}
      </button>

      <div className="music-volume">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          aria-label="Music volume"
          aria-valuetext={`${percent} percent`}
          onChange={(event) => music.setVolume(Number(event.target.value) / 100)}
        />
        <span className="music-volume-readout">{percent}%</span>
      </div>
    </div>
  );
}


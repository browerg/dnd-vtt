import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./Entrance.css";

const SESSION_KEY = "vivid-realms-entrance-v1";

function shouldShowEntrance() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.location.pathname === "/reset-password") return false;
  try { return sessionStorage.getItem(SESSION_KEY) !== "seen"; } catch { return true; }
}

export default function Entrance({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"ready" | "starting" | "playing" | "leaving" | "done">(() => shouldShowEntrance() ? "ready" : "done");
  const video = useRef<HTMLVideoElement>(null);
  const enter = useRef<HTMLButtonElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const app = useRef<HTMLDivElement>(null);
  const stallTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closing = useRef(false);

  useLayoutEffect(() => {
    if (app.current) app.current.inert = phase !== "done";
  }, [phase]);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    clearTimeout(stallTimer.current);
    video.current?.pause();
    try { sessionStorage.setItem(SESSION_KEY, "seen"); } catch { /* Storage can be disabled. */ }
    setPhase("leaving");
  }, []);

  useEffect(() => {
    if (phase === "ready") enter.current?.focus({ preventScroll: true });
    if (phase === "starting") skip.current?.focus({ preventScroll: true });
    if (phase !== "leaving") return;
    const timer = setTimeout(() => {
      setPhase("done");
      // Wait until React removes inert before restoring keyboard access.
      requestAnimationFrame(() => app.current?.focus({ preventScroll: true }));
    }, 450);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "starting" && phase !== "playing") return;
    const timer = setTimeout(dismiss, 15000);
    return () => clearTimeout(timer);
  }, [phase, dismiss]);

  useEffect(() => () => clearTimeout(stallTimer.current), []);

  function waitForPlayback() {
    clearTimeout(stallTimer.current);
    stallTimer.current = setTimeout(dismiss, 4000);
  }

  function start() {
    if (phase !== "ready") return;
    setPhase("starting");
    waitForPlayback();
    // Invoke play directly from the click so browsers allow the soundtrack.
    video.current?.play().catch(dismiss);
  }

  return <>
    <div ref={app} className="entrance-app" tabIndex={-1}>
      {children}
    </div>
    {phase !== "done" && <div
      className={`vr-entrance${phase === "leaving" ? " vr-entrance--leaving" : ""}`}
      role="dialog" aria-modal="true" aria-label="Welcome to Vivid Realms"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); dismiss(); }
        if (event.key === "Tab") {
          event.preventDefault();
          if (phase === "ready" && document.activeElement === skip.current) enter.current?.focus();
          else skip.current?.focus();
        }
      }}
    >
      <video ref={video} className="vr-entrance__video"
        src="/assets/intro/entrance-v1.mp4" poster="/assets/intro/entrance-v1.webp"
        preload="metadata" playsInline aria-hidden="true" tabIndex={-1}
        onEnded={dismiss} onError={dismiss}
        onWaiting={() => { if (phase === "starting" || phase === "playing") waitForPlayback(); }}
        onPlaying={() => {
          clearTimeout(stallTimer.current);
          if (!closing.current) setPhase("playing");
        }}
      />
      {phase === "ready" && <div className="vr-entrance__invitation">
        {/* Button adapted from Uiverse.io by MuhammadHasann. */}
        <button ref={enter} type="button" className="vr-enter-button" onClick={start}>
          <span className="vr-enter-button__border" aria-hidden="true" />
          <svg viewBox="0 0 24 24" fill="none" className="vr-enter-button__sparkle" aria-hidden="true">
            <path d="M14.187 8.096L15 5.25L15.813 8.096C16.0231 8.83114 16.4171 9.50062 16.9577 10.0413C17.4984 10.5819 18.1679 10.9759 18.903 11.186L21.75 12L18.904 12.813C18.1689 13.0231 17.4994 13.4171 16.9587 13.9577C16.4181 14.4984 16.0241 15.1679 15.814 15.903L15 18.75L14.187 15.904C13.9769 15.1689 13.5829 14.4994 13.0423 13.9587C12.5016 13.4181 11.8321 13.0241 11.097 12.814L8.25 12L11.096 11.187C11.8311 10.9769 12.5006 10.5829 13.0413 10.0423C13.5819 9.50162 13.9759 8.83214 14.186 8.097Z" />
            <path d="M6 14.25L5.741 15.285C5.59267 15.8785 5.28579 16.4206 4.85319 16.8532C4.42059 17.2858 3.87853 17.5927 3.285 17.741L2.25 18L3.285 18.259C3.87853 18.4073 4.42059 18.7142 4.85319 19.1468C5.28579 19.5794 5.59267 20.1215 5.741 20.715L6 21.75L6.259 20.715C6.40725 20.1216 6.71398 19.5796 7.14639 19.147C7.5788 18.7144 8.12065 18.4075 8.714 18.259L9.75 18L8.714 17.741C8.12065 17.5925 7.5788 17.2856 7.14639 16.853C6.71398 16.4204 6.40725 15.8784 6.259 15.285Z" />
            <path d="M6.5 4L6.303 4.5915C6.24777 4.75718 6.15472 4.90774 6.03123 5.03123C5.90774 5.15472 5.75718 5.24777 5.5915 5.303L5 5.5L5.5915 5.697C5.75718 5.75223 5.90774 5.84528 6.03123 5.96877C6.15472 6.09226 6.24777 6.24282 6.303 6.4085L6.5 7L6.697 6.4085C6.75223 6.24282 6.84528 6.09226 6.96877 5.96877C7.09226 5.84528 7.24282 5.75223 7.4085 5.697L8 5.5L7.4085 5.303C7.24282 5.24777 7.09226 5.15472 6.96877 5.03123C6.84528 4.90774 6.75223 4.75718 6.697 4.5915Z" />
          </svg>
          <span className="vr-enter-button__text">Enter Vivid Realms</span>
        </button>
        <p className="vr-entrance__hint">Your story awaits · Sound on</p>
      </div>}
      {phase === "starting" && <p className="vr-entrance__loading" role="status">Opening the realms…</p>}
      <button ref={skip} type="button" className="vr-entrance__skip" onClick={dismiss}>Skip Intro</button>
    </div>}
  </>;
}

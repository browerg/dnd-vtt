// A looping background track with fades and the autoplay dance, shared by the
// gateway and the Emporium.
//
// Each loop owns one <audio> element rather than a decoded AudioBuffer. These
// files run to several megabytes; decoding one would sit on tens of megabytes
// of RAM on a page that already carries the 3D dice canvas, and an element
// streams instead.

export interface MusicLoop {
  /**
   * Fades in. Resolves false when the browser refused — landing straight on a
   * page with no user gesture yet — so the caller can offer to start it rather
   * than leaving a control that lies about its state.
   */
  start(): Promise<boolean>;
  /** Fades out over `fadeMs` and parks the track back at the top. */
  stop(fadeMs?: number): void;
  playing(): boolean;
  /** Retargets the loop, live if it is sounding and not mid-fade. */
  setVolume(next: number): void;
  volume(): number;
  /** What the track plays at until someone changes it. */
  readonly defaultVolume: number;
}

export function createMusicLoop(
  src: string,
  volume: number,
  fadeInMs = 1800,
  defaultFadeOutMs = 480
): MusicLoop {
  let element: HTMLAudioElement | null = null;
  let fadeTimer = 0;
  let target = volume;

  function clearFade(): void {
    if (fadeTimer) {
      window.clearInterval(fadeTimer);
      fadeTimer = 0;
    }
  }

  function fadeTo(target: number, ms: number, done?: () => void): void {
    const audio = element;
    if (!audio) return;
    clearFade();
    const from = audio.volume;
    const startedAt = performance.now();
    fadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * progress));
      if (progress >= 1) {
        clearFade();
        done?.();
      }
    }, 40);
  }

  return {
    async start() {
      if (!element) {
        element = new Audio(src);
        element.loop = true;
        element.preload = "auto";
      }

      if (!element.paused) {
        // Stopping and starting again lands here mid fade-out. Returning early
        // would leave that fade to finish and pause the track under a control
        // that says the music is on, so turn it around instead.
        if (!fadeTimer && element.volume >= target) return true;
        fadeTo(target, fadeInMs);
        return true;
      }

      clearFade();
      element.volume = 0;
      try {
        await element.play();
      } catch {
        return false; // autoplay policy, or the file did not load
      }
      fadeTo(target, fadeInMs);
      return true;
    },

    stop(fadeMs = defaultFadeOutMs) {
      const audio = element;
      if (!audio || audio.paused) return;
      fadeTo(0, fadeMs, () => {
        audio.pause();
        audio.currentTime = 0;
      });
    },

    playing() {
      return !!element && !element.paused;
    },

    setVolume(next) {
      target = Math.max(0, Math.min(1, next));
      // A fade owns the volume while it runs — including the goodbye fade, so
      // dragging the slider during one must not haul the track back up.
      if (element && !element.paused && !fadeTimer) element.volume = target;
    },

    volume() {
      return target;
    },

    defaultVolume: volume,
  };
}

export function musicEnabled(key: string): boolean {
  try {
    return localStorage.getItem(key) !== "off";
  } catch {
    return true; // private mode: default to audible
  }
}

export function setMusicEnabled(key: string, enabled: boolean): void {
  try {
    localStorage.setItem(key, enabled ? "on" : "off");
  } catch {
    /* private mode or quota — the preference just won't persist */
  }
}

export function musicVolume(key: string, fallback: number): number {
  try {
    // Number(null) and Number("") are both 0, so an unset preference has to be
    // ruled out before parsing or every new visitor gets silence.
    const raw = localStorage.getItem(`${key}-volume`);
    if (raw === null || raw.trim() === "") return fallback;
    const saved = Number(raw);
    return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function setStoredMusicVolume(key: string, value: number): void {
  try {
    localStorage.setItem(`${key}-volume`, String(value));
  } catch {
    /* private mode or quota — the preference just won't persist */
  }
}

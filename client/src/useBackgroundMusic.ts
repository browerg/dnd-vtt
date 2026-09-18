import { useEffect, useState } from "react";
import { musicEnabled, musicVolume, setMusicEnabled, setStoredMusicVolume, type MusicLoop } from "./musicLoop";

export interface BackgroundMusic {
  on: boolean;
  /** True when the track is wanted but the browser has not allowed it yet. */
  blocked: boolean;
  toggle: () => void;
  /** 0–1. */
  volume: number;
  setVolume: (next: number) => void;
}

/**
 * Plays `loop` for as long as the calling page is mounted and `active`, with
 * the preference kept under `storageKey`. Stops on the way out: background
 * music belongs to its page and should not follow the player to the next one.
 */
export function useBackgroundMusic(loop: MusicLoop, storageKey: string, active = true): BackgroundMusic {
  const [on, setOn] = useState(() => musicEnabled(storageKey));
  const [blocked, setBlocked] = useState(false);
  const [volume, setVolume] = useState(() => musicVolume(storageKey, loop.defaultVolume));

  // Applied before the first start(), so the loop fades in to the chosen level
  // rather than to its default and then down.
  useEffect(() => {
    loop.setVolume(volume);
  }, [loop, volume]);

  useEffect(() => {
    if (!on || !active) {
      loop.stop();
      setBlocked(false);
      return;
    }

    let cancelled = false;

    // Arriving by refresh means no user gesture yet, so the browser refuses
    // play(). Start on the next thing they touch instead.
    const startOnGesture = () => {
      void loop.start().then((started) => {
        if (cancelled || !started) return;
        setBlocked(false);
        window.removeEventListener("pointerdown", startOnGesture);
        window.removeEventListener("keydown", startOnGesture);
      });
    };

    void loop.start().then((started) => {
      if (cancelled) return;
      setBlocked(!started);
      if (!started) {
        window.addEventListener("pointerdown", startOnGesture);
        window.addEventListener("keydown", startOnGesture);
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", startOnGesture);
      window.removeEventListener("keydown", startOnGesture);
      loop.stop();
    };
  }, [loop, storageKey, on, active]);

  return {
    on,
    blocked,
    toggle: () => {
      const next = !on;
      setMusicEnabled(storageKey, next);
      setOn(next);
    },
    volume,
    setVolume: (next: number) => {
      setVolume(next);
      setStoredMusicVolume(storageKey, next);
    },
  };
}

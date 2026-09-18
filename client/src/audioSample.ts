// Short one-shots, decoded once and played from a buffer so repeats can
// overlap rather than the second restarting the first.
//
// Anything long enough to be background music belongs in musicLoop instead:
// decoding a multi-megabyte track would sit on tens of megabytes of RAM.

import { effectsMuted, getAudioContext } from "./audioContext";

export interface AudioSample {
  /** Fetches and decodes ahead of the first play, so it is warm in time. */
  prime(): void;
  play(): void;
}

export function createAudioSample(src: string, volume: number, minIntervalMs = 0): AudioSample {
  let buffer: AudioBuffer | null = null;
  let loading = false;
  let lastPlayedAt = 0;

  function prime(): void {
    if (buffer || loading) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    loading = true;
    void fetch(src)
      .then((response) => response.arrayBuffer())
      .then((encoded) => ctx.decodeAudioData(encoded))
      .then((decoded) => {
        buffer = decoded;
      })
      .catch(() => {
        /* falls back to a plain <audio> one-shot below */
      })
      .finally(() => {
        loading = false;
      });
  }

  return {
    prime,

    play() {
      if (effectsMuted()) return;

      const now = Date.now();
      if (minIntervalMs && now - lastPlayedAt < minIntervalMs) return;
      lastPlayedAt = now;

      const ctx = getAudioContext();
      if (!ctx || !buffer) {
        // First play of the session may land before the decode finishes.
        prime();
        const oneShot = new Audio(src);
        oneShot.volume = volume;
        void oneShot.play().catch(() => {});
        return;
      }

      try {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = buffer;
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.onended = () => {
          source.disconnect();
          gain.disconnect();
        };
        source.start();
      } catch {
        // Audio is enhancement-only; the page still works in silence.
      }
    },
  };
}

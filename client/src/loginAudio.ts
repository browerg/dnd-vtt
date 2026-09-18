// The gateway's music, and the flourish that plays when someone signs in.
//
//   Music — geoffharvey, "Magical Storytime" (Pixabay 389087)
//
// The welcome flourish is synthesised rather than shipped as a file, matching
// the chat and cache sounds: it is three bell tones and a pad, and a 200KB
// download would buy nothing. Swapping in a sample later means replacing
// playWelcomeChime and nothing else.

import { effectsMuted, getAudioContext } from "./audioContext";
import { createMusicLoop } from "./musicLoop";

export const GATEWAY_MUSIC_KEY = "gateway-music";

// Under the sign-in form, so it sits beneath conversation rather than over it.
export const gatewayMusic = createMusicLoop("/assets/audio/gateway-loop.mp3", 0.08, 2400);

// Peak of the welcome flourish, matched to the music so the two sit together.
const CHIME_PEAK = 0.08;

/** Rising bell over a warm swell. C5–G5–C6, about a second and a half. */
export function playWelcomeChime(): void {
  if (effectsMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const start = ctx.currentTime + 0.02;

    // A pad underneath, so the bells land on something rather than in silence.
    const pad = ctx.createGain();
    pad.gain.setValueAtTime(0.0001, start);
    pad.gain.exponentialRampToValueAtTime(CHIME_PEAK * 0.42, start + 0.5);
    pad.gain.exponentialRampToValueAtTime(0.0001, start + 1.9);
    pad.connect(ctx.destination);
    for (const frequency of [130.81, 196.0]) {
      const drone = ctx.createOscillator();
      drone.type = "triangle";
      drone.frequency.setValueAtTime(frequency, start);
      drone.connect(pad);
      drone.start(start);
      drone.stop(start + 2);
      drone.onended = () => drone.disconnect();
    }

    // C5, G5, C6 — an open rise, no third, so it reads as a doorway opening
    // rather than as a major-key fanfare.
    [523.25, 783.99, 1046.5].forEach((frequency, index) => {
      const at = start + index * 0.09;
      const bell = ctx.createOscillator();
      const shimmer = ctx.createOscillator();
      const gain = ctx.createGain();

      bell.type = "sine";
      bell.frequency.setValueAtTime(frequency, at);
      // A quiet partial a twelfth up gives the tone a struck edge.
      shimmer.type = "sine";
      shimmer.frequency.setValueAtTime(frequency * 3, at);

      const shimmerGain = ctx.createGain();
      shimmerGain.gain.setValueAtTime(0.18, at);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(gain);
      bell.connect(gain);

      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(CHIME_PEAK * (1 - index * 0.17), at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
      gain.connect(ctx.destination);

      bell.start(at);
      shimmer.start(at);
      bell.stop(at + 1.5);
      shimmer.stop(at + 1.5);
      bell.onended = () => {
        bell.disconnect();
        shimmer.disconnect();
        shimmerGain.disconnect();
        gain.disconnect();
      };
    });
  } catch {
    // Audio is enhancement-only; the welcome still shows.
  }
}

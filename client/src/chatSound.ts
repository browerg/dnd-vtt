// Chat notification sound. Synthesized rather than shipped as an asset, to
// match the Aura-break sound in MapPage — but on a single shared AudioContext,
// because chat fires far more often than an Aura break and browsers cap how
// many contexts a page may open.

const STORAGE_KEY = "chat:sound:v1";

let context: AudioContext | null = null;
let lastPlayedAt = 0;

// A burst of messages should not machine-gun the room.
const MIN_INTERVAL_MS = 1200;

export type ChatSoundKind = "message" | "whisper";

export function chatSoundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true; // private mode: default to audible
  }
}

export function setChatSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* private mode or quota — the preference just won't persist */
  }
}

function getContext(): AudioContext | null {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!context) context = new AudioContextClass();
    // Browsers start the context suspended until a user gesture; once the
    // player has clicked anything at all this resolves and stays running.
    if (context.state === "suspended") void context.resume().catch(() => {});
    return context;
  } catch {
    return null;
  }
}

function blip(ctx: AudioContext, startAt: number, frequency: number, peak: number): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.20);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.22);
}

/**
 * Soft two-note chime for ordinary chat, a brighter rising pair for whispers
 * so a private message is distinguishable without looking at the screen.
 * Silent when muted, and rate-limited so a burst plays once.
 */
export function playChatSound(kind: ChatSoundKind = "message", force = false): void {
  if (!chatSoundEnabled()) return;

  // `force` is for the deliberate preview when someone unmutes — without it a
  // message arriving a moment earlier would make that click appear broken.
  const now = Date.now();
  if (!force && now - lastPlayedAt < MIN_INTERVAL_MS) return;

  const ctx = getContext();
  if (!ctx) return;
  lastPlayedAt = now;

  try {
    const start = ctx.currentTime;
    if (kind === "whisper") {
      blip(ctx, start, 784, 0.16);        // G5
      blip(ctx, start + 0.11, 1046.5, 0.14); // C6 — rising, "someone's talking to you"
    } else {
      blip(ctx, start, 587.33, 0.11);     // D5
      blip(ctx, start + 0.1, 440, 0.09);  // A4 — falling, less insistent
    }
  } catch {
    // Audio is enhancement-only; the unread badges still do their job.
  }
}

export type ScrollSoundKind = "tap" | "send" | "buzz";

/**
 * The Scroll's interface sounds: a soft tick when switching apps and a quick
 * rising swoosh when a message goes out. Quieter than the message chimes,
 * and silenced by the same chat mute.
 */
export function playScrollSound(kind: ScrollSoundKind): void {
  if (!chatSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    const start = ctx.currentTime;
    if (kind === "buzz") {
      // A phone vibrating on a table: two short low rattles.
      for (const offset of [0, 0.2]) {
        const osc = ctx.createOscillator();
        const low = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(140, start + offset);
        low.type = "lowpass";
        low.frequency.value = 420;
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(0.09, start + offset + 0.015);
        gain.gain.setValueAtTime(0.09, start + offset + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.15);
        osc.connect(low);
        low.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start + offset);
        osc.stop(start + offset + 0.16);
      }
      return;
    }
    if (kind === "tap") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1900, start);
      osc.frequency.exponentialRampToValueAtTime(1200, start + 0.04);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.06, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.06);
      return;
    }
    // Send: filtered noise swept upward under a short rising tone.
    const length = Math.floor(ctx.sampleRate * 0.22);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.2;
    band.frequency.setValueAtTime(600, start);
    band.frequency.exponentialRampToValueAtTime(3800, start + 0.2);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, start);
    noiseGain.gain.exponentialRampToValueAtTime(0.07, start + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    noise.connect(band);
    band.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(start);
    noise.stop(start + 0.23);

    const tone = ctx.createOscillator();
    const toneGain = ctx.createGain();
    tone.type = "sine";
    tone.frequency.setValueAtTime(520, start + 0.03);
    tone.frequency.exponentialRampToValueAtTime(1320, start + 0.17);
    toneGain.gain.setValueAtTime(0.0001, start + 0.03);
    toneGain.gain.exponentialRampToValueAtTime(0.05, start + 0.06);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    tone.connect(toneGain);
    toneGain.connect(ctx.destination);
    tone.start(start + 0.03);
    tone.stop(start + 0.21);
  } catch {
    // Audio is enhancement-only.
  }
}

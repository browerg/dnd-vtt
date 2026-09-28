/*
 * Synthesized scores for the premium Natural 1 spectacles. Each one is timed
 * to its visual, so the beats named in the comments match the CSS timelines.
 * Callers check the "critical-roll-sound" mute preference first.
 */

type Score = (kit: Kit) => number;

interface Kit {
  t0: number;
  tone: (type: OscillatorType, from: number, to: number, start: number, end: number, peak: number, attack?: number) => OscillatorNode;
  noise: (start: number, length: number, peak: number, filter: BiquadFilterType, from: number, to: number, q?: number) => void;
  context: AudioContext;
  master: GainNode;
}

function play(volume: number, score: Score) {
  try {
    const AudioContextClass =
      window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const t0 = context.currentTime + 0.015;
    const master = context.createGain();
    master.gain.value = volume;
    master.connect(context.destination);

    const tone: Kit["tone"] = (type, from, to, start, end, peak, attack = 0.02) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, start);
      oscillator.frequency.exponentialRampToValueAtTime(to, end);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(end + 0.05);
      return oscillator;
    };

    const noise: Kit["noise"] = (start, length, peak, filterType, from, to, q = 1) => {
      const frames = Math.max(1, Math.floor(context.sampleRate * length));
      const buffer = context.createBuffer(1, frames, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = filterType;
      filter.Q.value = q;
      filter.frequency.setValueAtTime(from, start);
      filter.frequency.exponentialRampToValueAtTime(to, start + length);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, length / 3));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      source.connect(filter).connect(gain).connect(master);
      source.start(start);
    };

    const seconds = score({ t0, tone, noise, context, master });
    window.setTimeout(() => void context.close().catch(() => {}), seconds * 1000 + 400);
  } catch {
    // Browsers may block audio until the page has received a user gesture.
  }
}

/** A taut string that tightens, the blade's ring and snap at 1.05s, then a sub drop under a sinking dyad. */
export const playSeveredFateSound = () => play(0.2, ({ t0, tone, noise, context }) => {
  const cut = t0 + 1.05;
  const thread = tone("sine", 660, 990, t0 + 0.1, cut, 0.18, 0.8);
  const vibrato = context.createOscillator();
  const depth = context.createGain();
  vibrato.frequency.setValueAtTime(5, t0);
  vibrato.frequency.linearRampToValueAtTime(14, cut);
  depth.gain.value = 9;
  vibrato.connect(depth).connect(thread.frequency);
  vibrato.start(t0);
  vibrato.stop(cut);

  noise(cut - 0.14, 0.14, 0.6, "bandpass", 1800, 7800, 1.4);
  noise(cut, 0.26, 0.9, "bandpass", 7800, 2400, 1.4);
  tone("triangle", 2637, 2600, cut, cut + 0.9, 0.22, 0.004);
  tone("sine", 3951, 3900, cut, cut + 0.5, 0.1, 0.004);

  tone("sine", 92, 30, cut + 0.02, cut + 1.6, 0.9, 0.01);
  tone("sawtooth", 220, 147, cut + 0.25, cut + 2.4, 0.07, 0.3);
  tone("sawtooth", 233.08, 155.56, cut + 0.25, cut + 2.4, 0.06, 0.3);
  return 3.8;
});

/** Creaking lid, the snap at 1.0s, two chews, a gulp, the spit at 1.6s and a sad little fanfare. */
export const playMimicSound = () => play(0.24, ({ t0, tone, noise, context, master }) => {
  // The creak: a low buzz through a narrow band, its pitch wobbling.
  const creak = context.createOscillator();
  const band = context.createBiquadFilter();
  const creakGain = context.createGain();
  const wobble = context.createOscillator();
  const wobbleDepth = context.createGain();
  creak.type = "sawtooth";
  creak.frequency.value = 62;
  wobble.frequency.value = 7;
  wobbleDepth.gain.value = 16;
  wobble.connect(wobbleDepth).connect(creak.frequency);
  band.type = "bandpass";
  band.frequency.value = 900;
  band.Q.value = 7;
  creakGain.gain.setValueAtTime(0.0001, t0 + 0.2);
  creakGain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.5);
  creakGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
  creak.connect(band).connect(creakGain).connect(master);
  creak.start(t0 + 0.2);
  wobble.start(t0 + 0.2);
  creak.stop(t0 + 0.95);
  wobble.stop(t0 + 0.95);

  const snap = t0 + 1.0;
  noise(snap, 0.18, 1, "lowpass", 2600, 500);
  tone("sine", 150, 38, snap, snap + 0.45, 1, 0.005);
  tone("triangle", 2300, 1900, snap, snap + 0.06, 0.3, 0.002);
  for (const chew of [0.13, 0.28]) {
    noise(snap + chew, 0.07, 0.5, "highpass", 1800, 1200);
    tone("sine", 110, 50, snap + chew, snap + chew + 0.12, 0.5, 0.004);
  }
  tone("sine", 330, 78, t0 + 1.48, t0 + 1.75, 0.55, 0.01);

  const spit = t0 + 1.6;
  noise(spit, 0.14, 0.7, "bandpass", 700, 3200, 2);
  tone("sine", 380, 950, spit, spit + 0.12, 0.35, 0.005);

  [311.13, 293.66, 277.18, 261.63].forEach((note, index) => {
    const start = t0 + 1.95 + index * 0.24;
    const end = start + (index === 3 ? 0.75 : 0.22);
    const horn = tone("sawtooth", note, note * 0.985, start, end, 0.09, 0.03);
    if (index === 3) {
      const lfo = context.createOscillator();
      const lfoDepth = context.createGain();
      lfo.frequency.value = 6;
      lfoDepth.gain.value = 5;
      lfo.connect(lfoDepth).connect(horn.frequency);
      lfo.start(start);
      lfo.stop(end);
    }
  });
  return 4;
});

/** A beating drone, the wet lid opening, three darting clicks, a dissonant sting at the lock (1.9s) and eyes opening. */
export const playAbyssalGazeSound = () => play(0.22, ({ t0, tone, noise }) => {
  tone("sine", 49, 47, t0, t0 + 4.2, 0.55, 1.2);
  tone("sine", 50.6, 48.4, t0, t0 + 4.2, 0.45, 1.2);
  tone("sawtooth", 98, 92, t0 + 0.2, t0 + 3.8, 0.05, 1.4);
  noise(t0 + 0.5, 0.7, 0.35, "lowpass", 250, 900, 3);

  for (const dart of [1.25, 1.52, 1.78]) noise(t0 + dart, 0.03, 0.4, "bandpass", 3200, 2800, 3);

  const lock = t0 + 1.9;
  for (const [note, peak] of [[739.99, 0.12], [783.99, 0.11], [830.61, 0.1], [1479.98, 0.05]] as const) {
    tone("sine", note, note * 0.97, lock, lock + 1.9, peak, 0.01);
  }
  tone("sine", 70, 30, lock, lock + 1, 0.8, 0.005);
  noise(lock, 0.35, 0.4, "highpass", 5000, 2000);

  [2.2, 2.45, 2.62, 2.8, 2.95, 3.1, 3.22, 3.35].forEach((at, index) => {
    const pitch = 1150 + ((index * 173) % 700);
    tone("sine", pitch, pitch * 1.06, t0 + at, t0 + at + 0.35, 0.05, 0.01);
  });
  noise(t0 + 3.7, 0.25, 0.25, "lowpass", 600, 200, 2);
  return 4.4;
});

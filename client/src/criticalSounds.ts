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

/** A whoosh as the panel slams in, a punchy hit on the stamp at 1.0s, then a stabbing synth fanfare. */
export const playMainCharacterSound = () => play(0.2, ({ t0, tone, noise }) => {
  noise(t0 + 0.05, 0.4, 0.7, "bandpass", 600, 5000, 0.8);
  const hit = t0 + 1.0;
  tone("sine", 160, 42, hit, hit + 0.4, 1, 0.004);
  noise(hit, 0.12, 0.8, "highpass", 3000, 1500);
  const chord = [523.25, 659.25, 783.99, 987.77];
  [0, 0.22, 0.44].forEach((offset, stab) => {
    for (const note of chord) tone("sawtooth", note * (stab === 2 ? 2 : 1), note * (stab === 2 ? 2 : 1), hit + offset, hit + offset + 0.16, 0.05, 0.005);
  });
  [1046.5, 1318.51, 1567.98, 2093].forEach((note, i) => tone("square", note, note, hit + 0.7 + i * 0.07, hit + 0.7 + i * 0.07 + 0.12, 0.035, 0.005));
  for (const note of chord) tone("sawtooth", note, note * 1.005, hit + 1.05, hit + 2.4, 0.04, 0.05);
  return 3.6;
});

/** Reels ticking and slowing, a clunk at each stop (1.1s, 1.55s, 2.3s), then bells and coins. */
export const playJackpotSound = () => play(0.2, ({ t0, tone, noise }) => {
  const stops = [1.1, 1.55, 2.3];
  let at = 0.25;
  let gap = 0.05;
  while (at < 2.28) {
    tone("square", 1800, 1700, t0 + at, t0 + at + 0.02, 0.05, 0.002);
    at += gap;
    if (at > 1.6) gap = Math.min(0.16, gap * 1.08);
  }
  stops.forEach((stop, i) => {
    tone("sine", 220 - i * 20, 90, t0 + stop, t0 + stop + 0.18, 0.7, 0.004);
    noise(t0 + stop, 0.06, 0.4, "lowpass", 1500, 600);
  });
  const win = t0 + 2.3;
  [1046.5, 1318.51, 1567.98, 2093, 1567.98, 2093, 2637].forEach((note, i) => {
    tone("triangle", note, note, win + i * 0.09, win + i * 0.09 + 0.5, 0.12, 0.005);
  });
  for (let i = 0; i < 16; i += 1) {
    const pitch = 2600 + ((i * 331) % 1800);
    tone("sine", pitch, pitch * 0.98, win + 0.2 + i * 0.075, win + 0.2 + i * 0.075 + 0.14, 0.06, 0.002);
  }
  return 4.2;
});

/** Three anvil clangs (0.9s, 1.5s, 2.1s), the quench hiss at 2.4s, then a warm brass swell. */
export const playLegendForgedSound = () => play(0.2, ({ t0, tone, noise }) => {
  noise(t0, 1, 0.12, "lowpass", 300, 500, 0.7);
  [0.9, 1.5, 2.1].forEach((strike, i) => {
    const at = t0 + strike;
    const lift = 1 + i * 0.04;
    for (const [partial, peak, length] of [[1180, 0.3, 1.1], [2250, 0.16, 0.8], [3370, 0.1, 0.5], [5120, 0.05, 0.3]] as const) {
      tone("sine", partial * lift, partial * lift * 0.995, at, at + length, peak, 0.002);
    }
    tone("sine", 120, 55, at, at + 0.25, 0.6, 0.003);
    noise(at, 0.05, 0.6, "highpass", 4000, 2500);
  });
  noise(t0 + 2.4, 1.3, 0.55, "highpass", 6000, 2500, 0.6);
  for (const note of [130.81, 196, 261.63, 329.63, 392]) {
    tone("sawtooth", note, note, t0 + 2.55, t0 + 4.1, 0.045, 0.45);
  }
  return 4.2;
});

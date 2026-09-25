/** Gesture-created audio: mechanical clicks, a launch swell and rarity chords. */
export function createCacheTickPlayer() {
  const Audio = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Audio) return null;
  try {
    const context = new Audio();
    void context.resume().catch(() => {});
    let lastTick = -1;
    let lastGlimmer = -1;
    const audible = () => {
      if (context.state !== "running" || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
      try { return localStorage.getItem("critical-roll-sound") !== "off"; } catch { return false; }
    };
    const tone = (frequency: number, end: number, duration: number, volume: number, delay = 0, type: OscillatorType = "sine") => {
      if (!audible()) return;
      const now = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(now); oscillator.stop(now + duration + .02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };
    return {
      launch() { tone(90, 360, .5, .05, 0, "triangle"); tone(760, 220, .24, .025, .06); },
      tick(rarity?: string, slow = false) {
        const now = context.currentTime;
        if (now - lastTick < .065) return;
        lastTick = now;
        tone(slow ? 920 : 660, 260, slow ? .075 : .04, slow ? .055 : .032, 0, "triangle");
        if ((rarity === "mythic" || rarity === "legendary") && now - lastGlimmer > .5) {
          lastGlimmer = now;
          tone(rarity === "mythic" ? 1397 : 1047, 880, .18, .018);
        }
      },
      land(rarity: string) {
        tone(130, 48, .35, .075, 0, "triangle");
        const notes = rarity === "mythic" ? [523, 659, 784, 1047, 1319]
          : rarity === "legendary" ? [440, 554, 659, 880]
          : rarity === "epic" ? [392, 494, 587] : [330, 440];
        notes.forEach((note, i) => tone(note, note, rarity === "mythic" ? 1.2 : .6, .028, i * .07));
      },
      dispose() { void context.close().catch(() => {}); },
    };
  } catch { return null; }
}

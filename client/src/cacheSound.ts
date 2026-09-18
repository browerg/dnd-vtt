/** Quiet, procedural wooden ticks. Create during the Open button gesture. */
export function createCacheTickPlayer() {
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    const context = new AudioContextClass();
    void context.resume().catch(() => {});
    let lastTick = -1;
    return {
      tick() {
        if (context.state !== "running" || localStorage.getItem("critical-roll-sound") === "off") return;
        const now = context.currentTime;
        // Skip excess crossings at full speed instead of stacking loud clicks.
        if (now - lastTick < 0.08) return;
        lastTick = now;
        const tone = context.createOscillator();
        const gain = context.createGain();
        tone.type = "sine";
        tone.frequency.setValueAtTime(620, now);
        tone.frequency.exponentialRampToValueAtTime(340, now + 0.035);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.035, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        tone.connect(gain);
        gain.connect(context.destination);
        tone.start(now);
        tone.stop(now + 0.05);
        tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      },
      dispose() { void context.close().catch(() => {}); },
    };
  } catch { return null; }
}

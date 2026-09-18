// One AudioContext for the whole app. Browsers cap how many a page may open,
// and every short effect here is cheap enough to share one.

let context: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!context) context = new AudioContextClass();
    // Contexts start suspended until a user gesture; once anything has been
    // clicked this resolves and the context stays running.
    if (context.state === "suspended") void context.resume().catch(() => {});
    return context;
  } catch {
    return null;
  }
}

/** One shared mute for short effects, honoured across dice, cache and shop. */
export function effectsMuted(): boolean {
  try {
    return localStorage.getItem("critical-roll-sound") === "off";
  } catch {
    return false;
  }
}

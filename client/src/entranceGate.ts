// Whether the opening video is out of the way.
//
// The app renders behind the entrance from the first paint, so a page cannot
// tell from its own mount whether the intro is still playing. Anything that
// would talk over the intro's soundtrack waits on this.

let done = false;
const listeners = new Set<() => void>();

export function markEntranceDone(): void {
  if (done) return;
  done = true;
  for (const listener of listeners) listener();
  listeners.clear();
}

export function entranceDone(): boolean {
  return done;
}

/** Calls back once the entrance is gone, immediately if it already is. */
export function whenEntranceDone(listener: () => void): () => void {
  if (done) {
    listener();
    return () => {};
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

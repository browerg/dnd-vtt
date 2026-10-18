// An invite opened before signing in is kept here so sign-in (or creating an
// account) carries on to it instead of dropping the player on their home page.
const KEY = "vivid:pending-invite";
const CODE = /^[A-Za-z0-9_-]{6,32}$/;

export function savePendingInvite(code: string) {
  if (!CODE.test(code)) return;
  try { localStorage.setItem(KEY, code); } catch {}
}

export function peekPendingInvite(): string | null {
  try { const code = localStorage.getItem(KEY); return code && CODE.test(code) ? code : null; } catch { return null; }
}

export function takePendingInvite(): string | null {
  const code = peekPendingInvite();
  try { localStorage.removeItem(KEY); } catch {}
  return code;
}

/**
 * The invite code from whatever the player pasted: a whole link (from any
 * address — tunnel links change every session but the code stays good), a
 * "/join/…" path, or the bare code.
 */
export function inviteCodeFrom(input: string): string | null {
  const text = input.trim();
  const fromLink = text.match(/\/join\/([A-Za-z0-9_-]{6,32})(?:[/?#]|$)/);
  if (fromLink) return fromLink[1];
  return CODE.test(text) ? text : null;
}

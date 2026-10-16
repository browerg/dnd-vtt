import { useId, useState, type FormEvent } from "react";
import { api } from "../api";
import "./MemberPasswordReset.css";

const WORDS = ["rose", "ember", "frost", "grimm", "dust", "aura", "scythe", "moon", "petal", "storm", "glyph", "ruby", "onyx", "willow"];
// Easy to read out loud or type from a phone; the GM can change it before saving.
function friendlyPassword(): string {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${pick()}-${pick()}-${10 + Math.floor(Math.random() * 90)}`;
}

interface Member { id: number; display_name: string; role: string }

/** Whether the viewer may set this member's password (the server enforces the same rule). */
export function canSetPassword(viewerRole: string | undefined, viewerId: number, member: Member): boolean {
  if (viewerRole !== "dm" && viewerRole !== "co-dm") return false;
  if (member.id === viewerId || member.role === "dm") return false;
  return member.role !== "co-dm" || viewerRole === "dm";
}

/** GM tool for a forgotten password: set a new one and pass it on. */
export default function MemberPasswordReset({ campaignId, member }: { campaignId: number; member: Member }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [copied, setCopied] = useState(false);
  const inputId = useId();

  const start = () => { setOpen(true); setPassword(friendlyPassword()); setError(""); setDone(""); setCopied(false); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await api(`/api/campaigns/${campaignId}/members/${member.id}/password`, { method: "PUT", body: JSON.stringify({ password }) });
      setDone(password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't set the password.");
    } finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(done); setCopied(true); } catch { setCopied(false); }
  };

  if (!open) {
    return <button type="button" className="ghost mini member-password-open" onClick={start} aria-label={`Set a new password for ${member.display_name}`} title="Forgot their password? Set a new one">🔑</button>;
  }
  return (
    <div className="member-password">
      {done ? <>
        <p role="status"><strong>{member.display_name}</strong> can now sign in with:</p>
        <div className="member-password-result">
          <code>{done}</code>
          <button type="button" className="ghost mini" onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>
        </div>
        <p className="muted small">Send it to them on Discord. They can change it from their profile.</p>
        <button type="button" className="ghost mini" onClick={() => setOpen(false)}>Done</button>
      </> : <form onSubmit={submit}>
        <label htmlFor={inputId}>New password for <strong>{member.display_name}</strong></label>
        <div className="member-password-result">
          <input id={inputId} value={password} onChange={event => setPassword(event.target.value)} minLength={8} required autoComplete="off" spellCheck={false} />
          <button type="button" className="ghost mini" onClick={() => setPassword(friendlyPassword())} title="Pick another">↻</button>
        </div>
        {error && <p role="alert" className="member-password-error">{error}</p>}
        <p className="muted small">This signs them out on other devices.</p>
        <div className="member-password-actions">
          <button type="submit" className="mini" disabled={busy || password.length < 8}>{busy ? "Saving…" : "Set password"}</button>
          <button type="button" className="ghost mini" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </form>}
    </div>
  );
}

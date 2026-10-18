import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { inviteCodeFrom } from "../pendingInvite";

/** Paste an invite link (from any hosting session) or just its code. */
export default function JoinByCode() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const inputId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = inviteCodeFrom(value);
    if (!code) { setError("That doesn't look like an invite link or code."); return; }
    navigate(`/join/${code}`);
  };
  return (
    <form className="join-by-code" onSubmit={submit}>
      <label htmlFor={inputId}>Join with a code</label>
      <div className="join-by-code-row">
        <input id={inputId} value={value} onChange={(event) => { setValue(event.target.value); setError(""); }}
          placeholder="Paste an invite link or code" autoComplete="off" spellCheck={false} />
        <button type="submit" disabled={!value.trim()}>Join</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

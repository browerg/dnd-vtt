import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

/** DM-only: permanently delete the campaign after typing its name. */
export default function DeleteCampaign({ campaignId, name }: { campaignId: number; name: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputId = useId();
  const matches = typed.trim() === name.trim();

  const remove = async () => {
    setBusy(true); setError("");
    try {
      await api(`/api/campaigns/${campaignId}`, { method: "DELETE", body: JSON.stringify({ confirmName: typed }) });
      navigate("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't delete the campaign.");
      setBusy(false);
    }
  };

  if (!open) {
    return <button type="button" className="ghost danger delete-campaign-open" onClick={() => setOpen(true)}>Delete campaign…</button>;
  }
  return (
    <div className="delete-campaign" role="group" aria-labelledby={`${inputId}-title`}>
      <strong id={`${inputId}-title`}>Delete “{name}” for good?</strong>
      <p>
        This removes the campaign for everyone: its maps, tokens, characters, chat, quests and handouts.
        It can't be undone. <a href={`/api/campaigns/${campaignId}/export`} download>Download a backup</a> first if you might want it later.
      </p>
      <label htmlFor={inputId}>Type the campaign name to confirm</label>
      <input id={inputId} value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={name} autoComplete="off" spellCheck={false} />
      {error && <p role="alert" className="delete-campaign-error">{error}</p>}
      <div className="delete-campaign-actions">
        <button type="button" className="danger" disabled={!matches || busy} onClick={() => void remove()}>
          {busy ? "Deleting…" : "Delete campaign"}
        </button>
        <button type="button" className="ghost" onClick={() => { setOpen(false); setTyped(""); setError(""); }}>Cancel</button>
      </div>
    </div>
  );
}

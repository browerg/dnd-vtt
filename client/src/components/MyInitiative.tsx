import { useEffect, useId, useState, type FormEvent } from "react";
import { api } from "../api";

interface Props {
  campaignId: number;
  /** The viewer's own character tokens on this map. */
  myTokens: { id: number; name: string }[];
  combatants: { tokenId: number | null; initiative: number }[];
}

/** Players type the initiative they rolled for their own character. */
export default function MyInitiative({ campaignId, myTokens, combatants }: Props) {
  const [tokenId, setTokenId] = useState(myTokens[0]?.id ?? 0);
  const current = combatants.find((c) => c.tokenId === tokenId);
  const [value, setValue] = useState(current ? String(current.initiative) : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inputId = useId();

  useEffect(() => { if (!myTokens.some((t) => t.id === tokenId)) setTokenId(myTokens[0]?.id ?? 0); }, [myTokens, tokenId]);
  // Show the number already in the order when switching characters or when the GM changes it.
  useEffect(() => { setValue(current ? String(current.initiative) : ""); }, [tokenId, current?.initiative]);

  if (!myTokens.length) return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      await api(`/api/campaigns/${campaignId}/combat/my-initiative`, { method: "POST", body: JSON.stringify({ tokenId, initiative: Number(value) }) });
      setMessage(current ? "Updated." : "You're in the order.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Couldn't save your initiative.");
    } finally { setBusy(false); }
  };

  return (
    <form className="my-initiative" onSubmit={submit}>
      <label htmlFor={inputId}>Your initiative</label>
      <div className="my-initiative-row">
        {myTokens.length > 1 && (
          <select value={tokenId} onChange={(event) => setTokenId(Number(event.target.value))} aria-label="Character">
            {myTokens.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <input id={inputId} type="number" inputMode="numeric" step={1} min={-99} max={999} value={value}
          onChange={(event) => setValue(event.target.value)} placeholder="Your roll" required />
        <button type="submit" disabled={busy || value.trim() === ""}>{current ? "Update" : "Add me"}</button>
      </div>
      {message && <p className="muted small" role="status">{message}</p>}
    </form>
  );
}

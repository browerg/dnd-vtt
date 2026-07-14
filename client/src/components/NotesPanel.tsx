import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { handleBulletKeyDown } from "../bulletList";

// A private, autosaving notepad — one per player per campaign. Nobody else
// (not even the DM) sees it. Playtesters said a running notes doc is vital.
export default function NotesPanel({ campaignId }: { campaignId: number }) {
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<number>();

  useEffect(() => {
    setLoaded(false);
    api<{ body: string }>(`/api/campaigns/${campaignId}/notes`)
      .then((r) => setBody(r.body))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [campaignId]);

  const save = useCallback(
    (text: string) => {
      window.clearTimeout(timer.current);
      setState("saving");
      timer.current = window.setTimeout(async () => {
        try {
          await api(`/api/campaigns/${campaignId}/notes`, { method: "PUT", body: JSON.stringify({ body: text }) });
          setState("saved");
        } catch {
          setState("error");
        }
      }, 600);
    },
    [campaignId]
  );

  return (
    <div className="notes-panel">
      <div className="notes-head">
        <span className="muted small">🔒 Private to you</span>
        <span className={`save-state small ${state}`}>
          {state === "saving" ? "Saving…" : state === "error" ? "Save failed!" : state === "saved" ? "Saved" : ""}
        </span>
      </div>
      <textarea
        className="notes-area"
        placeholder="Session notes — clues, NPC names, loot, that thing the DM definitely wants you to remember…"
        value={body}
        disabled={!loaded}
        onKeyDown={handleBulletKeyDown}
        onChange={(e) => {
          setBody(e.target.value);
          save(e.target.value);
        }}
      />
    </div>
  );
}

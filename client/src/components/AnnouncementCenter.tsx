import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api } from "../api";

type Kind = "info" | "combat" | "quest" | "alert";
interface Announcement {
  campaignId: number;
  message: string;
  kind: Kind;
  at: number;
  from: string;
}

const KIND_ICON: Record<Kind, string> = { info: "📣", combat: "⚔️", quest: "📜", alert: "⚠️" };

// Self-contained (like CampaignDocks): opens its own campaign room join, toasts
// any announcement:push, and — for the DM — shows a compose control. Mounted
// once per campaign screen.
export default function AnnouncementCenter({ campaignId }: { campaignId: number }) {
  const [isDM, setIsDM] = useState(false);
  const [toast, setToast] = useState<Announcement | null>(null);
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<Kind>("info");
  const timer = useRef<number>();

  useEffect(() => {
    api<{ yourRole: string }>(`/api/campaigns/${campaignId}`)
      .then((r) => setIsDM(r.yourRole === "dm" || r.yourRole === "co-dm"))
      .catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("announcement:push", (a: Announcement) => {
      if (a.campaignId !== campaignId) return;
      setToast(a);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), 6000);
    });
    return () => {
      socket.disconnect();
    };
  }, [campaignId]);

  const send = async () => {
    const text = message.trim();
    if (!text) return;
    try {
      await api(`/api/campaigns/${campaignId}/announce`, {
        method: "POST",
        body: JSON.stringify({ message: text, kind }),
      });
      setMessage("");
      setComposing(false);
    } catch {
      /* surfaced by the toast on the receiving side; ignore here */
    }
  };

  return (
    <>
      {toast && (
        <div className={`announce-toast kind-${toast.kind}`} onClick={() => setToast(null)}>
          <span className="announce-icon">{KIND_ICON[toast.kind]}</span>
          <div className="announce-text">
            <strong>{toast.message}</strong>
            <span className="muted small"> — {toast.from}</span>
          </div>
        </div>
      )}
      {isDM && (
        <div className="announce-dm">
          <button className="ghost mini" onClick={() => setComposing((v) => !v)}>
            📣 Announce
          </button>
          {composing && (
            <div className="announce-compose card">
              <input
                value={message}
                maxLength={200}
                placeholder="Tell the party…"
                autoFocus
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
              />
              <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                <option value="info">Info</option>
                <option value="combat">Combat</option>
                <option value="quest">Quest</option>
                <option value="alert">Alert</option>
              </select>
              <button className="primary" onClick={send}>
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

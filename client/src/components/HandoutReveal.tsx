import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "../App";
import "./HandoutReveal.css";

interface RevealedHandout {
  id: number;
  name: string;
  url: string;
  isPdf: boolean;
}

// When the DM reveals (or re-presents) a handout, it lands on every other
// player's screen like a letter set down on the table. Several in a row
// queue up. Self-contained like AnnouncementCenter: its own room join.
export default function HandoutReveal({ campaignId }: { campaignId: number }) {
  const { user } = useAuth();
  const [queue, setQueue] = useState<RevealedHandout[]>([]);
  const myId = useRef(user?.id);
  myId.current = user?.id;
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("handout:reveal", (m: { campaignId: number; fromUserId: number; handout: RevealedHandout }) => {
      if (m.campaignId !== campaignId || m.fromUserId === myId.current) return;
      setQueue((q) => (q.some((h) => h.id === m.handout.id) ? q : [...q, m.handout]));
    });
    return () => {
      socket.disconnect();
    };
  }, [campaignId]);

  const current = queue[0];

  useEffect(() => {
    if (current) close.current?.focus({ preventScroll: true });
  }, [current?.id]);

  if (!current) return null;
  const dismiss = () => setQueue((q) => q.slice(1));

  return (
    <div
      className="handout-reveal"
      role="dialog"
      aria-modal="true"
      aria-label={`New handout: ${current.name}`}
      onClick={(event) => event.target === event.currentTarget && dismiss()}
      onKeyDown={(event) => event.key === "Escape" && dismiss()}
    >
      <div className="handout-reveal__card" key={current.id}>
        <p className="handout-reveal__eyebrow">A handout is placed before you</p>
        <h2 className="handout-reveal__title">{current.name}</h2>
        <a className="handout-reveal__art" href={current.url} target="_blank" rel="noreferrer" title="Open full size">
          {current.isPdf ? <span className="handout-reveal__pdf" aria-hidden="true">📄</span> : <img src={current.url} alt={current.name} />}
        </a>
        <div className="handout-reveal__actions">
          <a className="ghost link" href={current.url} target="_blank" rel="noreferrer">Open full size</a>
          <button ref={close} type="button" className="primary" onClick={dismiss}>
            {queue.length > 1 ? `Next (${queue.length - 1} more)` : "Keep it"}
          </button>
        </div>
        <p className="handout-reveal__hint">Saved in the Codex under Handouts.</p>
      </div>
    </div>
  );
}

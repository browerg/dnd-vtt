import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ChatMessage } from "../api";
import { useAuth } from "../App";
import { playChatSound } from "../chatSound";
import "./ScrollTextAlert.css";

const SHOW_MS = 9000;
const MAX_SHOWN = 3;

// A private message landing on your screen like a text on your Scroll.
// Always for messages from an NPC contact; for ordinary whispers only when
// no chat panel is on screen (the map), since the chat already flags those.
export default function ScrollTextAlert({ campaignId, system }: { campaignId: number; system: string }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<ChatMessage[]>([]);
  const myId = useRef(user?.id);
  myId.current = user?.id;
  const timers = useRef(new Map<number, number>());

  useEffect(() => {
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("chat", (m: ChatMessage) => {
      if (m.campaignId !== campaignId || m.channel !== "whisper" || m.targetUserId !== myId.current) return;
      const chatOnScreen = !!document.querySelector(".chat-panel");
      if (!m.speaker && chatOnScreen) return;
      // The chat panel plays its own sound when it's mounted.
      if (!chatOnScreen) playChatSound("whisper");
      setAlerts((all) => [...all.filter((a) => a.id !== m.id), m].slice(-MAX_SHOWN));
      timers.current.set(
        m.id,
        window.setTimeout(() => {
          setAlerts((all) => all.filter((a) => a.id !== m.id));
          timers.current.delete(m.id);
        }, SHOW_MS)
      );
    });
    const pending = timers.current;
    return () => {
      socket.disconnect();
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, [campaignId]);

  if (!alerts.length) return null;
  const remnant = system === "remnant";

  return (
    <div className={`scroll-text-alerts${remnant ? " is-scroll" : ""}`} role="status" aria-live="polite">
      {alerts.map((m) => (
        <button
          key={m.id}
          type="button"
          className="scroll-text-alert"
          title="Dismiss"
          onClick={() => setAlerts((all) => all.filter((a) => a.id !== m.id))}
        >
          <span className="scroll-text-alert-app">
            <span aria-hidden="true">📱</span> {remnant ? "Scroll" : "Private message"} · now
          </span>
          <strong>{m.speaker || m.userName}</strong>
          <span className="scroll-text-alert-body">{m.body}</span>
        </button>
      ))}
    </div>
  );
}

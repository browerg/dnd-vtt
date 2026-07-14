import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, Member } from "../api";
import { Avatar } from "./Avatar";

type Tab = "ic" | "ooc" | "whisper";

const TABS: { key: Tab; label: string }[] = [
  { key: "ic", label: "In Character" },
  { key: "ooc", label: "Out of Character" },
  { key: "whisper", label: "Whispers" },
];

interface Props {
  messages: ChatMessage[];
  members: Member[];
  myId: number;
  canChat: boolean;
  onSend: (body: string, channel: Tab, targetUserId?: number) => Promise<void>;
}

export default function ChatPanel({ messages, members, myId, canChat, onSend }: Props) {
  const [tab, setTab] = useState<Tab>("ooc");
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState(0);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const shown = messages.filter((m) => m.channel === tab);
  const others = members.filter((m) => m.id !== myId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [shown.length, tab]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setError("");
    try {
      await onSend(draft, tab, tab === "whisper" ? target || others[0]?.id : undefined);
      setDraft("");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="chat-panel">
      <div className="tabs chat-tabs">
        {TABS.map(({ key, label }) => (
          <button key={key} className={tab === key ? "tab active" : "tab"} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className="chat-log">
        {shown.length === 0 && <p className="muted">Nothing here yet.</p>}
        {shown.map((m) => (
          <div key={m.id} className="chat-msg">
            {m.channel !== "ic" && (
              <Avatar
                name={m.userName}
                src={members.find((mem) => mem.id === m.userId)?.avatar_path || undefined}
                id={m.userId}
                size={18}
              />
            )}
            <span className="chat-author">
              {m.channel === "ic" && m.speaker ? (
                <>
                  {m.speaker} <span className="muted">({m.userName})</span>
                </>
              ) : (
                m.userName
              )}
              {m.channel === "whisper" && (
                <span className="muted"> → {m.targetUserId === myId ? "you" : m.targetName}</span>
              )}
            </span>
            <span className="chat-body">{m.body}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {canChat && (
        <form onSubmit={send} className="chat-compose">
          {tab === "whisper" && (
            <select value={target || others[0]?.id || 0} onChange={(e) => setTarget(Number(e.target.value))}>
              {others.map((m) => (
                <option key={m.id} value={m.id}>
                  to {m.display_name}
                </option>
              ))}
            </select>
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={tab === "ic" ? "Speak as your character…" : "Say something…"}
          />
          <button className="primary">Send</button>
        </form>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

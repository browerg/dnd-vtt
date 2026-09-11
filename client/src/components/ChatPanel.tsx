import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, Member } from "../api";
import type { CharacterSummary } from "../sheet";
import { Avatar } from "./Avatar";
import { chatSoundEnabled, playChatSound, setChatSoundEnabled } from "../chatSound";

type Tab = "ic" | "ooc" | "whisper";

const TABS: { key: Tab; label: string }[] = [
  { key: "ic", label: "In Character" },
  { key: "ooc", label: "Out of Character" },
  { key: "whisper", label: "Whispers" },
];

interface Props {
  messages: ChatMessage[];
  messagesReady: boolean;
  members: Member[];
  characters: CharacterSummary[];
  myId: number;
  canChat: boolean;
  isDM: boolean;
  onSend: (
    body: string,
    channel: Tab,
    targetUserId?: number,
    speakerCharacterId?: number,
    speakerAsGm?: boolean,
    replyToId?: number
  ) => Promise<void>;
}

export default function ChatPanel({
  messages,
  messagesReady,
  members,
  characters,
  myId,
  canChat,
  isDM,
  onSend,
}: Props) {
  const [tab, setTab] = useState<Tab>("ooc");
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState(0);
  const [speakerChoice, setSpeakerChoice] = useState("gm");
  const [error, setError] = useState("");
  const [unread, setUnread] = useState<Record<Tab, number>>({ ic: 0, ooc: 0, whisper: 0 });
  const [notice, setNotice] = useState("");
  const [soundOn, setSoundOn] = useState(chatSoundEnabled);
  // The message being replied to. Cleared on send, on cancel, and whenever the
  // tab changes — a reply only ever belongs to its own channel.
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const composeRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const lastMessageIdRef = useRef(0);
  const noticeTimerRef = useRef<number>();

  const shown = messages.filter((m) => m.channel === tab);
  const others = members.filter((m) => m.id !== myId);

  useEffect(() => {
    const log = chatLogRef.current;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }, [shown.length, tab]);

  useEffect(() => {
    if (!messagesReady) return;

    if (!initializedRef.current) {
      initializedRef.current = true;
      lastMessageIdRef.current = messages.reduce((max, message) => Math.max(max, message.id), 0);
      return;
    }

    const fresh = messages.filter((message) => message.id > lastMessageIdRef.current);
    if (!fresh.length) return;
    lastMessageIdRef.current = Math.max(lastMessageIdRef.current, ...fresh.map((message) => message.id));

    const incoming = fresh.filter((message) => message.userId !== myId);
    if (!incoming.length) return;

    // Audible cue for anything someone else said, on any tab — players kept
    // missing chat entirely while looking at the map. playChatSound re-reads
    // the stored preference on every call, so no stale-closure worry here.
    playChatSound(incoming.some((message) => message.channel === "whisper") ? "whisper" : "message");

    const additions: Record<Tab, number> = { ic: 0, ooc: 0, whisper: 0 };
    for (const message of incoming) {
      if (message.channel !== tab) additions[message.channel] += 1;
    }

    if (additions.ic || additions.ooc || additions.whisper) {
      setUnread((current) => ({
        ic: current.ic + additions.ic,
        ooc: current.ooc + additions.ooc,
        whisper: current.whisper + additions.whisper,
      }));
    }

    const newest = incoming[incoming.length - 1];
    if (newest.channel !== tab) {
      const label =
        newest.channel === "ic"
          ? "In Character"
          : newest.channel === "whisper"
            ? "Whisper"
            : "Out of Character";
      setNotice(`New ${label} message from ${newest.speaker || newest.userName}`);
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setNotice(""), 3500);
    }
  }, [messages, messagesReady, myId, tab]);

  useEffect(
    () => () => {
      window.clearTimeout(noticeTimerRef.current);
    },
    []
  );

  const selectTab = (next: Tab) => {
    setTab(next);
    setUnread((current) => ({ ...current, [next]: 0 }));
    setNotice("");
    setReplyTo(null); // a reply belongs to the channel it was started in
  };

  const startReply = (message: ChatMessage) => {
    setReplyTo(message);
    // Whispers reply to whoever sent it, not whoever was last selected.
    if (message.channel === "whisper") {
      setTarget(message.userId === myId ? message.targetUserId ?? 0 : message.userId);
    }
    composeRef.current?.focus();
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setError("");
    try {
      const whisperTarget = tab === "whisper" ? target || others[0]?.id : undefined;
      const speakerAsGm = tab === "ic" && isDM && speakerChoice === "gm";
      const speakerCharacterId =
        tab === "ic" && isDM && speakerChoice !== "gm"
          ? Number(speakerChoice) || undefined
          : undefined;

      await onSend(draft, tab, whisperTarget, speakerCharacterId, speakerAsGm, replyTo?.id);
      setDraft("");
      setReplyTo(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="chat-panel">
      {notice && (
        <div className="chat-unread-toast" role="status" aria-live="polite">
          <span className="chat-unread-pip" />
          {notice}
        </div>
      )}

      <div className="tabs chat-tabs">
        {TABS.map(({ key, label }) => (
          <button key={key} className={tab === key ? "tab active" : "tab"} onClick={() => selectTab(key)}>
            {label}
            {unread[key] > 0 && (
              <span className={key === "whisper" ? "chat-tab-unread whisper" : "chat-tab-unread"}>
                {unread[key] > 99 ? "99+" : unread[key]}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="chat-sound-toggle"
          aria-pressed={soundOn}
          title={soundOn ? "Chat sound on — click to mute" : "Chat sound muted — click to unmute"}
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            setChatSoundEnabled(next);
            if (next) playChatSound("message", true); // preview so they know what to listen for
          }}
        >
          <span aria-hidden="true">{soundOn ? "🔔" : "🔕"}</span>
          <span className="sr-only">{soundOn ? "Mute chat sound" : "Unmute chat sound"}</span>
        </button>
      </div>

      <div className="chat-log" ref={chatLogRef}>
        {shown.length === 0 && <p className="muted">Nothing here yet.</p>}
        {shown.map((m) => (
          <div key={m.id} id={`chat-msg-${m.id}`} className="chat-msg">
            {m.replyTo && (
              <button
                type="button"
                className="chat-quote"
                title="Jump to the message this replies to"
                onClick={() => {
                  const el = document.getElementById(`chat-msg-${m.replyTo!.id}`);
                  el?.scrollIntoView({ block: "center" });
                  el?.classList.add("chat-msg-flash");
                  window.setTimeout(() => el?.classList.remove("chat-msg-flash"), 1200);
                }}
              >
                <span className="chat-quote-author">{m.replyTo.author}</span>
                <span className="chat-quote-body">{m.replyTo.body}</span>
              </button>
            )}
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
            {canChat && (
              <button
                type="button"
                className="chat-reply-btn"
                title={`Reply to ${m.speaker || m.userName}`}
                onClick={() => startReply(m)}
              >
                <span aria-hidden="true">↩</span>
                <span className="sr-only">Reply to {m.speaker || m.userName}</span>
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {canChat && (
        <form onSubmit={send} className="chat-compose">
          {replyTo && (
            <div className="chat-replying-to">
              <span className="chat-replying-label">Replying to</span>
              <span className="chat-replying-author">{replyTo.speaker || replyTo.userName}</span>
              <span className="chat-replying-body">{replyTo.body}</span>
              <button type="button" onClick={() => setReplyTo(null)} title="Cancel reply">
                <span aria-hidden="true">✕</span>
                <span className="sr-only">Cancel reply</span>
              </button>
            </div>
          )}
          {tab === "ic" && isDM && (
            <label className="ic-speaker-control">
              <span>Speaking as</span>
              <select value={speakerChoice} onChange={(e) => setSpeakerChoice(e.target.value)}>
                <option value="gm">GM</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.isNpc ? "NPC: " : "Character: "}
                    {character.name}
                  </option>
                ))}
              </select>
            </label>
          )}

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
            ref={composeRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && replyTo) {
                e.preventDefault();
                setReplyTo(null);
              }
            }}
            placeholder={
              tab === "ic"
                ? isDM
                  ? speakerChoice === "gm"
                    ? "Speak as the GM…"
                    : "Speak as the selected character…"
                  : "Speak as your character…"
                : "Say something…"
            }
          />
          <button className="primary">Send</button>
        </form>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}

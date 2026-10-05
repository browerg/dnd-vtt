import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, Member, RollPayload } from "../api";
import type { CharacterSummary } from "../sheet";
import { Avatar } from "./Avatar";
import "./RelicAppearance.css";
import { chatSoundEnabled, playChatSound, setChatSoundEnabled } from "../chatSound";
import "./ScrollChat.css";

type Tab = "ic" | "ooc" | "whisper";

const TABS: { key: Tab; label: string }[] = [
  { key: "ic", label: "In Character" },
  { key: "ooc", label: "Out of Character" },
  { key: "whisper", label: "Whispers" },
];

// Remnant campaigns dress the chat as a Scroll, the phone everyone in RWBY
// carries: the three channels become its app tabs, the battery shows your
// character's Aura, and dice rolls arrive as push notifications.
const SCROLL_TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "ic", label: "Team", icon: "👥" },
  { key: "ooc", label: "Table talk", icon: "💬" },
  { key: "whisper", label: "Private", icon: "🔒" },
];

interface RollPush {
  id: number;
  who: string;
  what: string;
  result: string;
  critical: "nat20" | "nat1" | null;
}

interface Props {
  messages: ChatMessage[];
  messagesReady: boolean;
  members: Member[];
  characters: CharacterSummary[];
  myId: number;
  canChat: boolean;
  isDM: boolean;
  /** Render as a RWBY Scroll (Remnant campaigns). */
  scroll?: boolean;
  /** Rolls to surface as Scroll push notifications. */
  rolls?: RollPayload[];
  onSend: (
    body: string,
    channel: Tab,
    targetUserId?: number,
    speakerCharacterId?: number,
    speakerAsGm?: boolean,
    replyToId?: number,
    speakerName?: string
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
  scroll = false,
  rolls,
  onSend,
}: Props) {
  const [tab, setTab] = useState<Tab>("ooc");
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState(0);
  const [speakerChoice, setSpeakerChoice] = useState("gm");
  // GM only: who a private message comes from — "me", an NPC's id, or "contact"
  // for a typed-in name like "Unknown number".
  const [whisperAs, setWhisperAs] = useState("me");
  const [contactName, setContactName] = useState("");
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
  const [clock, setClock] = useState(() => new Date());
  const [push, setPush] = useState<RollPush | null>(null);
  const pushTimerRef = useRef<number>();
  const lastRollIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!scroll) return;
    const timer = window.setInterval(() => setClock(new Date()), 20_000);
    return () => window.clearInterval(timer);
  }, [scroll]);

  // New rolls slide down from the top of the Scroll for a few seconds. The
  // first batch is history, not news, so it only sets the high-water mark.
  useEffect(() => {
    if (!scroll || !rolls) return;
    const newest = rolls.reduce((max, roll) => Math.max(max, roll.id), 0);
    if (lastRollIdRef.current === null) {
      lastRollIdRef.current = newest;
      return;
    }
    const fresh = rolls.filter((roll) => roll.id > (lastRollIdRef.current ?? 0));
    lastRollIdRef.current = Math.max(lastRollIdRef.current, newest);
    const roll = fresh[fresh.length - 1];
    if (!roll) return;
    setPush({
      id: roll.id,
      who: roll.userName,
      what: roll.label || roll.formula,
      result: roll.total == null ? "Rolled in secret" : `${roll.formula} = ${roll.total}`,
      critical: roll.detail?.critical ?? null,
    });
    window.clearTimeout(pushTimerRef.current);
    pushTimerRef.current = window.setTimeout(() => setPush(null), 4500);
  }, [scroll, rolls]);

  useEffect(() => () => window.clearTimeout(pushTimerRef.current), []);

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

      const asNpc = tab === "whisper" && isDM && whisperAs !== "me" && whisperAs !== "contact";
      const asContact = tab === "whisper" && isDM && whisperAs === "contact" && contactName.trim();
      if (tab === "whisper" && isDM && whisperAs === "contact" && !contactName.trim()) {
        setError("Name the contact this message comes from.");
        return;
      }
      await onSend(
        draft,
        tab,
        whisperTarget,
        asNpc ? Number(whisperAs) || undefined : speakerCharacterId,
        speakerAsGm,
        replyTo?.id,
        asContact ? contactName.trim() : undefined
      );
      setDraft("");
      setReplyTo(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const composeForm = canChat && (
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

      {tab === "whisper" && isDM && (
        <label className="ic-speaker-control whisper-as-control">
          <span>Send as</span>
          <select value={whisperAs} onChange={(e) => setWhisperAs(e.target.value)}>
            <option value="me">Yourself (GM)</option>
            {characters.filter((c) => c.isNpc).map((c) => (
              <option key={c.id} value={c.id}>
                NPC: {c.name}
              </option>
            ))}
            <option value="contact">Another contact…</option>
          </select>
          {whisperAs === "contact" && (
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Contact name, e.g. Unknown number"
              maxLength={40}
              aria-label="Contact name"
            />
          )}
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
            : scroll
              ? tab === "whisper"
                ? "Private message…"
                : "Message the table…"
              : "Say something…"
        }
      />
      <button className="primary">Send</button>
    </form>
  );

  const jumpTo = (id: number) => {
    const el = document.getElementById(`chat-msg-${id}`);
    el?.scrollIntoView({ block: "center" });
    el?.classList.add("chat-msg-flash");
    window.setTimeout(() => el?.classList.remove("chat-msg-flash"), 1200);
  };

  const soundToggle = (
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
  );

  if (scroll) {
    const mine = characters.find((c) => c.ownerId === myId && !c.isNpc && c.auraMax);
    const auraPct = mine?.auraMax
      ? Math.max(0, Math.min(100, Math.round(((mine.aura ?? 0) / mine.auraMax) * 100)))
      : null;
    // The GM has no character of their own; use the team most of the party is on.
    const teamCounts = new Map<string, number>();
    for (const c of characters) {
      const name = c.teamName?.trim();
      if (name && !c.isNpc) teamCounts.set(name, (teamCounts.get(name) ?? 0) + 1);
    }
    const teamName =
      mine?.teamName?.trim() || [...teamCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const header =
      tab === "ic"
        ? { title: teamName ? `Team ${teamName}` : "Team", sub: "In character", badge: (teamName || "TM").slice(0, 4).toUpperCase() }
        : tab === "ooc"
          ? { title: "Table talk", sub: "Out of character", badge: "💬" }
          : { title: "Private", sub: "Only you and them", badge: "🔒" };

    return (
      <div className="chat-panel scroll-chat">
        <div className="scroll-device">
          <div className="scroll-status" aria-hidden="true">
            <span className="scroll-signal">
              <i />
              <i />
              <i />
              <i /> CCT
            </span>
            <span>{clock.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
            <span className="scroll-aura" title={auraPct == null ? undefined : "Your Aura"}>
              {auraPct == null ? (isDM ? "GM" : "") : `${auraPct}%`}
              <span className={`scroll-battery${auraPct != null && auraPct <= 20 ? " is-low" : ""}`}>
                <span style={{ width: `${auraPct ?? 100}%` }} />
              </span>
            </span>
          </div>

          <header className="scroll-header">
            <span className="scroll-header-badge" aria-hidden="true">
              {header.badge}
            </span>
            <span className="scroll-header-text">
              <strong>{header.title}</strong>
              <small>{header.sub}</small>
            </span>
            {soundToggle}
          </header>

          {push && (
            <div key={push.id} className={`scroll-push${push.critical ? ` is-${push.critical}` : ""}`} role="status">
              <span className="scroll-push-icon" aria-hidden="true">🎲</span>
              <span className="scroll-push-text">
                <small>
                  {push.who} · {push.what}
                </small>
                <strong>
                  {push.result}
                  {push.critical === "nat20" ? " · Critical!" : push.critical === "nat1" ? " · Ouch" : ""}
                </strong>
              </span>
            </div>
          )}
          {notice && (
            <div className="chat-unread-toast scroll-notice" role="status" aria-live="polite">
              <span className="chat-unread-pip" />
              {notice}
            </div>
          )}

          <div className="chat-log scroll-thread" ref={chatLogRef}>
            {shown.length === 0 && <p className="scroll-empty">No messages yet.</p>}
            {shown.map((m) => {
              const own = m.userId === myId;
              const author = m.speaker && m.channel !== "ooc" ? m.speaker : m.userName;
              const fromContact = m.channel === "whisper" && !!m.speaker;
              return (
                <div key={m.id} id={`chat-msg-${m.id}`} className={`chat-msg scroll-bubble-row${own ? " is-own" : ""}`}>
                  {!own && (
                    <span className={`scroll-author${m.chatFlair === "chat-first-flame" ? " relic-chat-name" : ""}`}>
                      {author}
                      {m.channel === "ic" && m.speaker && <span className="scroll-author-real"> · {m.userName}</span>}
                      {fromContact && <span className="scroll-contact-tag">Contact</span>}
                    </span>
                  )}
                  <div className="scroll-bubble">
                    {m.replyTo && (
                      <button
                        type="button"
                        className="chat-quote"
                        title="Jump to the message this replies to"
                        onClick={() => jumpTo(m.replyTo!.id)}
                      >
                        <span className="chat-quote-author">{m.replyTo.author}</span>
                        <span className="chat-quote-body">{m.replyTo.body}</span>
                      </button>
                    )}
                    {own && fromContact && <span className="scroll-whisper-to">as {m.speaker}</span>}
                    {m.channel === "whisper" && (
                      <span className="scroll-whisper-to">
                        {!own && m.targetUserId === myId
                          ? "to you"
                          : // Replying to a contact's text addresses the contact, not the GM behind it.
                            `to ${m.replyTo && m.replyTo.author !== m.targetName ? m.replyTo.author : m.targetName}`}
                      </span>
                    )}
                    <span className="chat-body">{m.body}</span>
                  </div>
                  {canChat && (
                    <button type="button" className="chat-reply-btn" title={`Reply to ${author}`} onClick={() => startReply(m)}>
                      <span aria-hidden="true">↩</span>
                      <span className="sr-only">Reply to {author}</span>
                    </button>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {composeForm}
          {error && <div className="error">{error}</div>}

          <nav className="scroll-tabs" aria-label="Chat channels">
            {SCROLL_TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                className={tab === key ? "is-active" : ""}
                aria-current={tab === key ? "page" : undefined}
                onClick={() => selectTab(key)}
              >
                <span aria-hidden="true">{icon}</span>
                {label}
                {unread[key] > 0 && (
                  <span className={key === "whisper" ? "chat-tab-unread whisper" : "chat-tab-unread"}>
                    {unread[key] > 99 ? "99+" : unread[key]}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>
    );
  }

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
        {soundToggle}
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
                onClick={() => jumpTo(m.replyTo!.id)}
              >
                <span className="chat-quote-author">{m.replyTo.author}</span>
                <span className="chat-quote-body">{m.replyTo.body}</span>
              </button>
            )}
            {m.channel !== "ic" && !(m.channel === "whisper" && m.speaker) && (
              <Avatar
                name={m.userName}
                src={members.find((mem) => mem.id === m.userId)?.avatar_path || undefined}
                id={m.userId}
                size={18}
              />
            )}
            <span className={`chat-author${m.chatFlair === "chat-first-flame" ? " relic-chat-name" : ""}`}>
              {m.channel === "ic" && m.speaker ? (
                <>
                  {m.speaker} <span className="muted">({m.userName})</span>
                </>
              ) : m.channel === "whisper" && m.speaker ? (
                <>
                  📱 {m.speaker} <span className="muted">(contact)</span>
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

      {composeForm}

      {error && <div className="error">{error}</div>}
    </div>
  );
}

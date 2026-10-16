import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, Member, RollPayload } from "../api";
import type { CharacterSummary } from "../sheet";
import { Avatar } from "./Avatar";
import "./RelicAppearance.css";
import { chatSoundEnabled, playChatSound, playScrollSound, setChatSoundEnabled } from "../chatSound";
import "./ScrollChat.css";
import ScrollShell, { ScrollIcon, readScrollPreferences } from "./ScrollShell";
import { messageThreadKey, parseThreadKey, threadKey, type ThreadRef } from "../../../shared/chatThreads";

// Thread helpers need targetSpeaker as a string; older messages may lack it.
const threadOfMessage = (message: ChatMessage, viewerId: number) =>
  messageThreadKey({ ...message, targetSpeaker: message.targetSpeaker ?? "" }, viewerId);

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
  /** Rolls to surface as Scroll push notifications (and the Rolls app). */
  rolls?: RollPayload[];
  /** Living in the pocket Scroll: adds the Rolls app and a tuck-away button. */
  pocket?: boolean;
  scrollStorageKey?: string;
  pocketOpen?: boolean;
  onReadChannel?: (channel: Tab | null) => void;
  onTuck?: () => void;
  /** Scroll only: clear a private conversation from this viewer's Scroll. */
  onDeleteThread?: (key: string) => Promise<void>;
  onSend: (
    body: string,
    channel: Tab,
    targetUserId?: number,
    speakerCharacterId?: number,
    speakerAsGm?: boolean,
    replyToId?: number,
    speakerName?: string,
    toSpeaker?: string
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
  pocket = false,
  scrollStorageKey = "scroll:guest",
  pocketOpen = true,
  onReadChannel,
  onTuck,
  onDeleteThread,
  onSend,
}: Props) {
  const [tab, setTab] = useState<Tab>(() => { try { const saved = sessionStorage.getItem(`${scrollStorageKey}:tab`); return pocket && (saved === "ic" || saved === "whisper") ? saved : "ooc"; } catch { return "ooc"; } });
  useEffect(() => { if(pocket) { try { sessionStorage.setItem(`${scrollStorageKey}:tab`,tab); } catch {} } }, [tab,pocket,scrollStorageKey]);
  const [draft, setDraft] = useState(() => { try { return pocket ? sessionStorage.getItem(`${scrollStorageKey}:draft`) || "" : ""; } catch { return ""; } });
  useEffect(() => { if(pocket) { try { sessionStorage.setItem(`${scrollStorageKey}:draft`,draft); } catch {} } }, [draft,pocket,scrollStorageKey]);
  const [target, setTarget] = useState(() => { try { return pocket ? Number(sessionStorage.getItem(`${scrollStorageKey}:target`)) || 0 : 0; } catch { return 0; } });
  useEffect(() => { if(pocket) { try { sessionStorage.setItem(`${scrollStorageKey}:target`,String(target)); } catch {} } }, [target,pocket,scrollStorageKey]);
  // Scroll only: the open private conversation (a thread key), or the inbox when null.
  const [openThread, setOpenThread] = useState<string | null>(() => { try { return pocket ? sessionStorage.getItem(`${scrollStorageKey}:thread`) : null; } catch { return null; } });
  useEffect(() => { if (pocket) { try { if (openThread) sessionStorage.setItem(`${scrollStorageKey}:thread`, openThread); else sessionStorage.removeItem(`${scrollStorageKey}:thread`); } catch {} } }, [openThread, pocket, scrollStorageKey]);
  // Conversations deleted this visit (key → last message id cleared); the server filters them after a reload.
  const [deleted, setDeleted] = useState<Record<string, number>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [threadUnread, setThreadUnread] = useState<Record<string, number>>({});
  const [composing, setComposing] = useState(false);
  const [newTo, setNewTo] = useState(0);
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
  const clearReply = () => { setReplyTo(null); try { sessionStorage.removeItem(`${scrollStorageKey}:reply`); } catch {} };
  const restoredReply = useRef(false);
  useEffect(() => {
    if (!pocket || !messagesReady || restoredReply.current) return;
    restoredReply.current = true;
    try { const id = Number(sessionStorage.getItem(`${scrollStorageKey}:reply`)); setReplyTo(messages.find(m=>m.id === id && m.channel === tab) || null); } catch {}
  }, [pocket,messagesReady,messages,scrollStorageKey]);
  useEffect(() => { if(pocket && restoredReply.current) { try { if(replyTo)sessionStorage.setItem(`${scrollStorageKey}:reply`,String(replyTo.id)); } catch {} } }, [replyTo,pocket,scrollStorageKey]);

  const composeRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const lastMessageIdRef = useRef(0);
  const noticeTimerRef = useRef<number>();
  const [clock, setClock] = useState(() => new Date());
  const [push, setPush] = useState<RollPush | null>(null);
  // Pocket Scroll only: the Rolls app is open instead of a chat channel.
  const [rollsOpen, setRollsOpen] = useState(false);
  const [threadVisible, setThreadVisible] = useState(false);
  const reading = !pocket || (pocketOpen && threadVisible && !rollsOpen);
  useEffect(()=>{onReadChannel?.(reading ? tab : null);},[reading,tab,onReadChannel]);
  const rollsLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = rollsLogRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [rollsOpen, rolls?.length]);
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

  const nearBottom = useRef(true);
  const readingPosition = useRef(0);
  const [newBelow, setNewBelow] = useState(false);
  const previousTab = useRef(tab);
  const others = members.filter((m) => m.id !== myId);
  const visibleMessages = messages.filter((m) => {
    if (m.channel !== "whisper") return true;
    const key = threadOfMessage(m, myId);
    return !key || deleted[key] == null || m.id > deleted[key];
  });
  // On the Scroll, Private is an inbox of separate conversations.
  const threadMode = scroll && tab === "whisper";
  const openRef = threadMode && openThread ? parseThreadKey(openThread) : null;
  const threadList = (() => {
    const byKey = new Map<string, { key: string; ref: ThreadRef; last: ChatMessage }>();
    for (const m of visibleMessages) {
      const key = threadOfMessage(m, myId);
      const ref = key ? parseThreadKey(key) : null;
      if (key && ref) byKey.set(key, { key, ref, last: m });
    }
    return [...byKey.values()].sort((a, b) => b.last.id - a.last.id);
  })();
  const shown = threadMode
    ? (openThread ? visibleMessages.filter((m) => threadOfMessage(m, myId) === openThread) : [])
    : visibleMessages.filter((m) => m.channel === tab);
  const nameFor = (ref: ThreadRef) => ref.otherPersona || members.find((m) => m.id === ref.otherId)?.display_name || "Unknown";
  const portraitFor = (ref: ThreadRef) => (ref.otherPersona ? undefined : members.find((m) => m.id === ref.otherId)?.avatar_path || undefined);
  const openConversation = (key: string | null) => { setOpenThread(key); setComposing(false); setConfirmDelete(null); if (key) setThreadUnread((current) => ({ ...current, [key]: 0 })); };

  useEffect(() => {
    const log = chatLogRef.current;
    if (!log || !reading) return;
    if (nearBottom.current || previousTab.current !== tab) { log.scrollTop = log.scrollHeight; setNewBelow(false); } else { log.scrollTop = readingPosition.current; setNewBelow(true); }
    previousTab.current = tab;
  }, [shown.length, tab, reading]);

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
    if (!pocket) playChatSound(incoming.some((message) => message.channel === "whisper") ? "whisper" : "message");

    const threadAdds: Record<string, number> = {};
    for (const message of incoming) {
      const key = message.channel === "whisper" ? threadOfMessage(message, myId) : null;
      if (key && !(reading && tab === "whisper" && openThread === key)) threadAdds[key] = (threadAdds[key] ?? 0) + 1;
    }
    if (Object.keys(threadAdds).length) {
      setThreadUnread((current) => {
        const next = { ...current };
        for (const [key, count] of Object.entries(threadAdds)) next[key] = (next[key] ?? 0) + count;
        return next;
      });
    }

    const additions: Record<Tab, number> = { ic: 0, ooc: 0, whisper: 0 };
    for (const message of incoming) {
      if (message.channel !== tab || !reading) additions[message.channel] += 1;
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
  }, [messages, messagesReady, myId, tab, reading, openThread]);

  useEffect(
    () => () => {
      window.clearTimeout(noticeTimerRef.current);
    },
    []
  );

  useEffect(()=>{if(reading)setUnread(current=>({...current,[tab]:0}));},[reading,tab]);
  const selectTab = (next: Tab) => {
    if (scroll && (next !== tab || rollsOpen) && readScrollPreferences(scrollStorageKey).interfaceSound) playScrollSound("tap", true);
    // Tapping Private again goes back to the conversation list.
    if (next === "whisper" && tab === "whisper" && !rollsOpen) openConversation(null);
    setRollsOpen(false);
    setTab(next);
    setUnread((current) => ({ ...current, [next]: 0 }));
    setNotice("");
    clearReply(); // a reply belongs to the channel it was started in
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
      if (threadMode) {
        if (!openRef) return;
        // The conversation decides who it goes to and who it comes from.
        await onSend(draft, "whisper", openRef.otherId, undefined, false, replyTo?.id,
          isDM && openRef.myPersona ? openRef.myPersona : undefined, openRef.otherPersona || undefined);
        if (readScrollPreferences(scrollStorageKey).interfaceSound) playScrollSound("send", true);
        setDraft("");
        clearReply();
        return;
      }
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
      if (scroll && readScrollPreferences(scrollStorageKey).interfaceSound) playScrollSound("send", true);
      setDraft("");
      clearReply();
      try { sessionStorage.removeItem(`${scrollStorageKey}:reply`); } catch {}
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
          <button type="button" onClick={() => clearReply()} title="Cancel reply">
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

      {tab === "whisper" && isDM && !threadMode && (
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

      {tab === "whisper" && !threadMode && (
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
            clearReply();
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
                ? openRef ? `Message ${nameFor(openRef)}…` : "Private message…"
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
    const header = rollsOpen
      ? { title: "Rolls", sub: "Dice history", badge: "🎲" }
      : tab === "ic"
        ? { title: teamName ? `Team ${teamName}` : "Team", sub: "In character", badge: (teamName || "TM").slice(0, 4).toUpperCase() }
        : tab === "ooc"
          ? { title: "Table talk", sub: "Out of character", badge: "💬" }
          : openRef
            ? { title: nameFor(openRef), sub: isDM && openRef.myPersona ? `You're writing as ${openRef.myPersona}` : openRef.otherPersona ? "Contact" : "Private message", badge: "" }
            : { title: "Private", sub: "Your conversations", badge: "" };

    const startConversation = () => {
      const otherId = newTo || others[0]?.id;
      if (!otherId) return;
      let persona = "";
      if (isDM && whisperAs === "contact") {
        persona = contactName.trim();
        if (!persona) { setError("Name the contact this message comes from."); return; }
      } else if (isDM && whisperAs !== "me") {
        persona = characters.find((c) => String(c.id) === whisperAs)?.name ?? "";
      }
      setError("");
      openConversation(threadKey({ otherId, otherPersona: "", myPersona: persona.slice(0, 40) }));
    };
    const removeThread = async (key: string) => {
      setConfirmDelete(null);
      if (!onDeleteThread) return;
      try {
        await onDeleteThread(key);
        const last = Math.max(0, ...visibleMessages.filter((m) => threadOfMessage(m, myId) === key).map((m) => m.id));
        setDeleted((current) => ({ ...current, [key]: last }));
        if (openThread === key) openConversation(null);
      } catch (err: any) { setError(err.message); }
    };
    const inbox = (
      <div className="scroll-inbox">
        {canChat && (composing ? (
          <div className="scroll-inbox-compose">
            <label>To
              <select value={newTo || others[0]?.id || 0} onChange={(e) => setNewTo(Number(e.target.value))}>
                {others.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
            </label>
            {isDM && (
              <label>As
                <select value={whisperAs} onChange={(e) => setWhisperAs(e.target.value)}>
                  <option value="me">Yourself (GM)</option>
                  {characters.filter((c) => c.isNpc).map((c) => <option key={c.id} value={c.id}>NPC: {c.name}</option>)}
                  <option value="contact">Another contact…</option>
                </select>
              </label>
            )}
            {isDM && whisperAs === "contact" && (
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name, e.g. Unknown number" maxLength={40} aria-label="Contact name" />
            )}
            <div className="scroll-inbox-actions">
              <button type="button" className="primary" onClick={startConversation} disabled={!others.length}>Start</button>
              <button type="button" onClick={() => setComposing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="scroll-inbox-new" onClick={() => { setComposing(true); setNewTo(others[0]?.id || 0); }}>
            <ScrollIcon name="messages"/> New message
          </button>
        ))}
        {!threadList.length && !composing && <p className="scroll-empty">No conversations yet. Tap someone in Contacts, or start a new message.</p>}
        {threadList.map((t) => {
          const name = nameFor(t.ref);
          const unreadCount = threadUnread[t.key] ?? 0;
          return (
            <div key={t.key} className={`scroll-inbox-row${unreadCount ? " is-unread" : ""}`}>
              {confirmDelete === t.key ? (
                <div className="scroll-inbox-confirm" role="group" aria-label={`Delete conversation with ${name}`}>
                  <span>Delete this conversation from your Scroll? They keep their copy.</span>
                  <button type="button" className="scroll-inbox-danger" onClick={() => void removeThread(t.key)}>Delete</button>
                  <button type="button" onClick={() => setConfirmDelete(null)}>Keep</button>
                </div>
              ) : (
                <>
                  <button type="button" className="scroll-inbox-open" onClick={() => openConversation(t.key)}>
                    <Avatar name={name} src={portraitFor(t.ref)} id={t.ref.otherId} size={38}/>
                    <span className="scroll-inbox-text">
                      <strong>{name}{unreadCount > 0 && <span className="scroll-inbox-dot" aria-label={`${unreadCount} unread`}/>}</strong>
                      {isDM && t.ref.myPersona && <small className="scroll-inbox-as">as {t.ref.myPersona}</small>}
                      <span className="scroll-inbox-last">{t.last.userId === myId ? "You: " : ""}{t.last.body}</span>
                    </span>
                  </button>
                  {onDeleteThread && (
                    <button type="button" className="scroll-inbox-delete" onClick={() => setConfirmDelete(t.key)} aria-label={`Delete conversation with ${name}`} title="Delete conversation">
                      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    );

    return (
      <div className={`chat-panel scroll-chat${pocket ? " is-pocket" : ""}`}>
        <ScrollShell storageKey={scrollStorageKey} characterName={mine?.name || members.find(m=>m.id===myId)?.display_name || "Your Scroll"} aura={auraPct} clock={clock} members={members} messages={messages} myId={myId} canChat={canChat} onTuck={onTuck} onRolls={setRollsOpen} onVisibilityChange={setThreadVisible}
          onMessage={message=>{selectTab(message.channel);if(message.channel === "whisper")openConversation(threadOfMessage(message, myId));}}
          onContact={key=>{selectTab("whisper");openConversation(key);}}>
          <header className="scroll-header">
            {threadMode && openRef && !rollsOpen && (
              <button type="button" className="scroll-back" onClick={() => { openConversation(null); clearReply(); }} aria-label="Back to conversations">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>
              </button>
            )}
            <span className="scroll-header-badge" aria-hidden="true">
              {threadMode && openRef && !rollsOpen ? <Avatar name={nameFor(openRef)} src={portraitFor(openRef)} id={openRef.otherId} size={30}/> : tab === "ic" && !rollsOpen ? header.badge : <ScrollIcon name={rollsOpen ? "rolls" : "messages"}/>}
            </span>
            <span className="scroll-header-text">
              <strong>{header.title}</strong>
              <small>{header.sub}</small>
            </span>
            {soundToggle}
            {onTuck && (
              <button type="button" className="scroll-tuck" onClick={onTuck} title="Put your Scroll away">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M3.5 6l4.5 4.5L12.5 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="sr-only">Put your Scroll away</span>
              </button>
            )}
          </header>

          {push && (
            <div key={push.id} className={`scroll-push${push.critical ? ` is-${push.critical}` : ""}`} role="status">
              <ScrollIcon name="rolls"/>
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

          {rollsOpen && (
            <div className="scroll-thread scroll-rolls" ref={rollsLogRef}>
              {!rolls?.length && <p className="scroll-empty">No rolls yet.</p>}
              {rolls?.map((roll) => {
                const critical = roll.detail?.critical ?? null;
                return (
                  <div key={roll.id} className={`scroll-roll${critical ? ` is-${critical}` : ""}`}>
                    <ScrollIcon name="rolls"/>
                    <span className="scroll-roll-text">
                      <small>
                        {roll.userName}
                        {roll.label ? ` · ${roll.label}` : ""}
                      </small>
                      <strong>
                        {roll.total == null ? "Rolled in secret" : `${roll.formula} = ${roll.total}`}
                        {critical === "nat20" ? " · Critical!" : critical === "nat1" ? " · Ouch" : ""}
                      </strong>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="chat-log scroll-thread" ref={chatLogRef} hidden={rollsOpen} onScroll={e=>{const el=e.currentTarget;if(!el.clientHeight)return;readingPosition.current=el.scrollTop;nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<70;if(nearBottom.current)setNewBelow(false);}}>
            {threadMode && !openRef ? inbox : shown.length === 0 && <p className="scroll-empty">{openRef ? `Say hello to ${nameFor(openRef)}.` : "No messages yet."}</p>}
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
                    {own && fromContact && !threadMode && <span className="scroll-whisper-to">as {m.speaker}</span>}
                    {m.channel === "whisper" && !threadMode && (
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
                      <ScrollIcon name="reply"/>
                      <span className="sr-only">Reply to {author}</span>
                    </button>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {newBelow && !rollsOpen && <button type="button" className="signature-new-messages" onClick={()=>{const log=chatLogRef.current;if(log)log.scrollTop=log.scrollHeight;nearBottom.current=true;setNewBelow(false);}}>New messages ↓</button>}
          {!rollsOpen && (!threadMode || openRef) && composeForm}
          {error && <div className="error">{error}</div>}

          <nav className="scroll-tabs" aria-label="Message channels">
            {SCROLL_TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={!rollsOpen && tab === key ? "is-active" : ""}
                aria-current={!rollsOpen && tab === key ? "page" : undefined}
                onClick={() => selectTab(key)}
              >
                <ScrollIcon name={key === "ic" ? "contacts" : "messages"}/>
                {label}
                {unread[key] > 0 && (
                  <span className={key === "whisper" ? "chat-tab-unread whisper" : "chat-tab-unread"}>
                    {unread[key] > 99 ? "99+" : unread[key]}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </ScrollShell>
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
                <ScrollIcon name="reply"/>
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

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../App";
import { api, type ChatMessage, type Member, type RollPayload } from "../api";
import type { CharacterSummary } from "../sheet";
import { messageThreadKey, parseThreadKey, threadKey, type ThreadRef } from "../../../shared/chatThreads";
import { playChatSound } from "../chatSound";
import MagicLetter from "./MagicLetter";
import RollFeed from "./RollFeed";
import "./SendingDock.css";

const OPEN_SENDING = "vivid:open-sending";
type Channel = "whisper" | "ic" | "ooc" | "rolls";
const keyOf = (m: ChatMessage, viewer: number) => m.channel === "whisper" ? messageThreadKey({ ...m, targetSpeaker: m.targetSpeaker || "" }, viewer) : m.channel;
const merge = (old: ChatMessage[], incoming: ChatMessage[]) => [...new Map([...old, ...incoming].map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id);
const readableTime = (date: string) => { const d = new Date(date.endsWith("Z") || date.includes("T") ? date : date.replace(" ", "T") + "Z"); return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
const errorText = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
function readStored<T>(key: string, fallback: T): T { try { return JSON.parse(sessionStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } }

export default function SendingDock(props: { campaignId: number; rolls: RollPayload[] }) {
  const { user } = useAuth();
  return user ? <Correspondence key={`${props.campaignId}:${user.id}`} {...props} myId={user.id} /> : null;
}

function Correspondence({ campaignId, rolls, myId }: { campaignId: number; rolls: RollPayload[]; myId: number }) {
  const storage = `sending:${myId}:${campaignId}`;
  const [open, setOpen] = useState(() => readStored(`${storage}:open`, false));
  const [channel, setChannel] = useState<Channel>("whisper");
  const [thread, setThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [role, setRole] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [seen, setSeen] = useState<Record<string, number>>(() => readStored(`${storage}:seen`, {}));
  const seenRef = useRef(seen); seenRef.current = seen;
  const [drafts, setDrafts] = useState<Record<string, string>>(() => readStored(`${storage}:drafts`, {}));
  const [animateId, setAnimateId] = useState<number | null>(null);
  const [peek, setPeek] = useState<ChatMessage | null>(null);
  const [rollUnread, setRollUnread] = useState(0);
  const [rollPeek, setRollPeek] = useState<RollPayload | null>(null);
  const [composing, setComposing] = useState(false);
  const [newConversation, setNewConversation] = useState(false);
  const [recipient, setRecipient] = useState(0);
  const [persona, setPersona] = useState("");
  const [contact, setContact] = useState("");
  const [partySpeaker, setPartySpeaker] = useState("gm");
  const [sending, setSending] = useState(false);
  const [quote, setQuote] = useState<ChatMessage | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const hydrated = useRef(false);
  const body = useRef<HTMLDivElement>(null), log = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null), dock = useRef<HTMLButtonElement>(null);
  const nearBottom = useRef(true), magicFollow = useRef(true), initialSeen = useRef(readStored<Record<string, number> | null>(`${storage}:seen`, null) !== null);
  const currentView = useRef({ open, channel, thread }); currentView.current = { open, channel, thread };
  const peekTimer = useRef<number>(), rollTimer = useRef<number>();
  const loadedRolls = useRef(false), lastRoll = useRef<number | null>(null), rollMountedAt = useRef(Date.now());
  const sendingRef = useRef(false);
  const isDM = role === "dm" || role === "co-dm", canChat = !!role && role !== "spectator";
  const others = members.filter(m => m.id !== myId);
  const openRef = thread ? parseThreadKey(thread) : null;
  const nameFor = (ref: ThreadRef) => ref.otherPersona || members.find(m => m.id === ref.otherId)?.display_name || "Campaign member";
  const viewKey = channel === "whisper" ? thread : channel;
  const draftKey = viewKey || "inbox", draft = drafts[draftKey] || "";
  const unreadFor = (key: string) => messages.filter(m => m.userId !== myId && keyOf(m, myId) === key && m.id > (seen[key] || 0)).length;
  const unread = messages.filter(m => m.userId !== myId && m.id > (seen[keyOf(m, myId) || ""] || 0)).length;
  const threads = new Map<string, { ref: ThreadRef; last: ChatMessage }>();
  messages.forEach(m => { if (m.channel === "whisper") { const key = keyOf(m, myId), ref = key ? parseThreadKey(key) : null; if (key && ref) threads.set(key, { ref, last: m }); } });
  const inbox = [...threads.entries()].sort(([a, av], [b, bv]) => Number(unreadFor(b) > 0) - Number(unreadFor(a) > 0) || bv.last.id - av.last.id);
  const shown = channel === "rolls" ? [] : messages.filter(m => channel === "whisper" ? !!thread && keyOf(m, myId) === thread : m.channel === channel);

  useEffect(() => { try { sessionStorage.setItem(`${storage}:open`, JSON.stringify(open)); sessionStorage.setItem(`${storage}:seen`, JSON.stringify(seen)); sessionStorage.setItem(`${storage}:drafts`, JSON.stringify(drafts)); } catch {} }, [open, seen, drafts, storage]);
  useEffect(() => { if (body.current) body.current.inert = !open; }, [open]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const socket = io();
    const acceptHistory = (history: ChatMessage[]) => {
      if (cancelled) return;
      if (!hydrated.current && !initialSeen.current) {
        const baseline: Record<string, number> = {};
        history.forEach(m => { const key = keyOf(m, myId); if (key) baseline[key] = Math.max(baseline[key] || 0, m.id); });
        setSeen(baseline);
      }
      hydrated.current = true; setMessages(current => merge(current, history)); setReady(true);
    };
    const load = async () => {
      try {
        const [detail, history, sheets] = await Promise.all([
          api<{ yourRole: string; members: Member[] }>(`/api/campaigns/${campaignId}`, { signal: controller.signal }),
          api<{ messages: ChatMessage[] }>(`/api/campaigns/${campaignId}/messages`, { signal: controller.signal }),
          api<{ characters: CharacterSummary[] }>(`/api/campaigns/${campaignId}/characters`, { signal: controller.signal }),
        ]);
        if (cancelled) return;
        setRole(detail.yourRole); setMembers(detail.members); setCharacters(sheets.characters); setError(""); acceptHistory(history.messages);
      } catch (err) { if (!cancelled) setError(errorText(err)); }
    };
    socket.on("connect", () => { setConnected(true); socket.emit("campaign:join", campaignId); void load(); });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("chat", (message: ChatMessage) => {
      if (message.campaignId !== campaignId) return;
      // Keep the client boundary as strict as the server's private-message routing.
      if (message.channel === "whisper" && message.userId !== myId && message.targetUserId !== myId) return;
      setMessages(current => merge(current, [message]));
      if (hydrated.current && message.userId !== myId) {
        playChatSound(message.channel === "whisper" ? "whisper" : "message");
        const v = currentView.current;
        if (!v.open || v.channel !== message.channel || (message.channel === "whisper" && keyOf(message, myId) !== v.thread)) {
          setPeek(message); window.clearTimeout(peekTimer.current); peekTimer.current = window.setTimeout(() => setPeek(null), 6000);
        }
      }
    });
    socket.on("campaign:update", (event: { campaignId: number }) => { if (event.campaignId === campaignId) void load(); });
    socket.on("character:update", (event: { campaignId: number }) => { if (event.campaignId === campaignId) void load(); });
    void load();
    return () => { cancelled = true; controller.abort(); socket.disconnect(); window.clearTimeout(peekTimer.current); window.clearTimeout(rollTimer.current); };
  }, [campaignId, myId]);

  useEffect(() => {
    if (!ready || !open || !viewKey || channel === "rolls") return;
    const visible = messages.filter(m => keyOf(m, myId) === viewKey), highest = visible.at(-1)?.id || 0;
    const previous = seen[viewKey] || 0;
    const newestIncoming = visible.filter(m => m.userId !== myId && m.id > previous).at(-1);
    if (channel === "whisper" && newestIncoming) { magicFollow.current = nearBottom.current; setAnimateId(newestIncoming.id); }
    if (highest > previous) setSeen(old => ({ ...old, [viewKey]: highest }));
  }, [messages, ready, open, viewKey, channel, seen]);

  useEffect(() => {
    if (!open) return;
    if (nearBottom.current && log.current && !animateId) log.current.scrollTop = log.current.scrollHeight;
  }, [open, viewKey, shown.length, composing, animateId]);
  const openPanel = useCallback(() => { setOpen(true); setPeek(null); setRollPeek(null); }, []);
  const fold = () => { setOpen(false); setAnimateId(null); dock.current?.focus(); };
  useEffect(() => { window.addEventListener(OPEN_SENDING, openPanel); return () => window.removeEventListener(OPEN_SENDING, openPanel); }, [openPanel]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector('[aria-modal="true"]')) return;
      if (composing) { setComposing(false); setQuote(null); } else { setOpen(false); setAnimateId(null); dock.current?.focus(); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [open, composing]);
  useEffect(() => {
    const latest = rolls.at(-1)?.id ?? null;
    if (!loadedRolls.current) { loadedRolls.current = true; lastRoll.current = latest; return; }
    if (latest !== null && latest > (lastRoll.current || 0) && (lastRoll.current !== null || Date.now() - rollMountedAt.current > 1200) && !(open && channel === "rolls")) {
      setRollUnread(n => n + 1); setRollPeek(rolls.at(-1)!); window.clearTimeout(rollTimer.current); rollTimer.current = window.setTimeout(() => setRollPeek(null), 4500);
    }
    if (latest !== null) lastRoll.current = latest;
    if (open && channel === "rolls") setRollUnread(0);
  }, [rolls, open, channel]);
  const switchTo = (next: Channel, nextThread: string | null = null) => {
    setChannel(next); setThread(nextThread); setAnimateId(null); setComposing(false); setQuote(null); setNewConversation(false); setDeleteKey(null); setError(""); nearBottom.current = true;
    if (next === "rolls") setRollUnread(0);
  };
  const peekOpen = () => { if (peek) switchTo(peek.channel, peek.channel === "whisper" ? keyOf(peek, myId) : null); else switchTo("rolls"); openPanel(); };
  const startConversation = () => {
    const otherId = recipient || others[0]?.id;
    if (!otherId) return;
    const myPersona = !isDM ? "" : persona === "contact" ? contact.trim().slice(0, 40) : characters.find(c => String(c.id) === persona)?.name || "";
    if (isDM && persona === "contact" && !myPersona) { setError("Name the contact first."); return; }
    switchTo("whisper", threadKey({ otherId, myPersona, otherPersona: "" })); setComposing(true);
  };
  const send = async (event: FormEvent) => {
    event.preventDefault(); if (!draft.trim() || sendingRef.current || !canChat) return;
    if (channel === "whisper" && !openRef) return;
    sendingRef.current = true; setSending(true); setError("");
    const sentDraft = draft, sentKey = draftKey;
    try {
      const { message } = await api<{ message: ChatMessage }>(`/api/campaigns/${campaignId}/messages`, { method: "POST", body: JSON.stringify({
        body: sentDraft, channel, replyToId: quote?.id,
        targetUserId: channel === "whisper" ? openRef?.otherId : undefined,
        speakerName: channel === "whisper" && isDM ? openRef?.myPersona || undefined : undefined,
        toSpeaker: channel === "whisper" ? openRef?.otherPersona || undefined : undefined,
        speakerAsGm: channel === "ic" && isDM && partySpeaker === "gm",
        speakerCharacterId: channel === "ic" && isDM && partySpeaker !== "gm" ? Number(partySpeaker) : undefined,
      }) });
      setMessages(old => merge(old, [message])); setDrafts(old => ({ ...old, [sentKey]: "" })); setQuote(null); setComposing(false); nearBottom.current = true;
    } catch (err) { setError(errorText(err)); } finally { sendingRef.current = false; setSending(false); }
  };
  const removeThread = async (key: string) => {
    try { await api(`/api/campaigns/${campaignId}/whisper-threads/hide`, { method: "POST", body: JSON.stringify({ key }) }); setMessages(old => old.filter(m => keyOf(m, myId) !== key)); setDeleteKey(null); }
    catch (err) { setError(errorText(err)); }
  };
  const focusReply = (message?: ChatMessage) => { setQuote(message || null); setAnimateId(null); setComposing(true); window.setTimeout(() => input.current?.focus(), 0); };
  const title = channel === "rolls" ? "Rolls" : channel === "ic" ? "Party correspondence" : channel === "ooc" ? "Table talk" : openRef ? nameFor(openRef) : "Your Sendings";

  return <aside className={`sending-dock${open ? " is-open" : ""}`} aria-label="Sending correspondence">
    {(peek || rollPeek) && <button type="button" className="sending-peek" onClick={peekOpen}>{peek ? `A ${peek.channel === "whisper" ? "Sending" : "message"} from ${peek.speaker || peek.userName}. Tap to read.` : `${rollPeek?.userName} rolled${rollPeek?.total == null ? " in secret" : ` ${rollPeek.total}`}. Open Rolls.`}</button>}
    <button ref={dock} type="button" className={`sending-sealed${unread ? " has-unread" : ""}`} onClick={openPanel} aria-label={`Open Sendings${unread ? `, ${unread} unread` : ""}`} hidden={open}><span className="sending-seal" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="m12 2 2 7 7 3-7 2-2 8-2-8-7-2 7-3Z"/><circle cx="12" cy="12" r="3"/></svg></span><span>{unread ? `${unread} unread Sending${unread === 1 ? "" : "s"}` : rollUnread ? `${rollUnread} new roll${rollUnread === 1 ? "" : "s"}` : "Your correspondence"}</span></button>
    <div className="sending-parchment" ref={body} aria-hidden={!open}>
      <div className="sending-content">
        <header className="sending-heading"><h2>{title}</h2></header>
        <nav className="sending-tabs" aria-label="Correspondence channels">{([["whisper", "Sendings"], ["ic", "Party"], ["ooc", "Table talk"], ["rolls", "Rolls"]] as const).map(([value, label]) => {
          const count = value === "rolls" ? rollUnread : messages.filter(m => m.userId !== myId && m.channel === value && m.id > (seen[keyOf(m, myId) || ""] || 0)).length;
          return <button key={value} type="button" aria-pressed={channel === value} onClick={() => switchTo(value)}>{label}{count > 0 && <span className="sending-count">{count > 99 ? "99+" : count}</span>}</button>;
        })}</nav>
        <div className="sending-tools">{channel === "whisper" && thread ? <button type="button" className="sending-ink-button" onClick={() => switchTo("whisper")}>Back to inbox</button> : <span>{channel === "whisper" ? "Private letters & replies" : channel === "ic" ? "In character" : channel === "ooc" ? "Out of character" : "Dice history"}</span>}{openRef?.myPersona && <span>Writing as {openRef.myPersona}</span>}</div>
        <div className="sending-log" ref={log} onWheel={event => { if (event.deltaY < 0) magicFollow.current = false; }} onTouchMove={() => { magicFollow.current = false; }} onScroll={event => { const el = event.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
          {!ready && !error && <p className="sending-empty">Gathering your correspondence…</p>}
          {channel === "rolls" ? <RollFeed rolls={rolls} /> : channel === "whisper" && !thread ? <>
            {canChat && <button type="button" className="sending-ink-button sending-new" onClick={() => setNewConversation(!newConversation)}>{newConversation ? "Cancel new Sending" : "Write a Sending"}</button>}
            {newConversation && <div className="sending-new-form"><label>To<select value={recipient || others[0]?.id || 0} onChange={e => setRecipient(Number(e.target.value))}>{others.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select></label>{isDM && <><label>Writing as<select value={persona} onChange={e => setPersona(e.target.value)}><option value="">Yourself (GM)</option>{characters.filter(c => c.isNpc).map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}<option value="contact">Another contact…</option></select></label>{persona === "contact" && <label>Contact name<input maxLength={40} value={contact} onChange={e => setContact(e.target.value)} /></label>}</>}<button type="button" className="sending-send" disabled={!others.length} onClick={startConversation}>Start Sending</button>{!others.length && <p className="sending-empty">Invite another campaign member to send a private letter.</p>}</div>}
            {!inbox.length && ready && <p className="sending-empty">No Sendings yet. Letters from players and NPCs will appear here.</p>}
            {inbox.map(([key, item]) => <div className="sending-inbox-row" key={key}>{deleteKey === key ? <div className="sending-delete-confirm"><p>Clear this conversation from your inbox? The other person keeps their copy.</p><button type="button" className="sending-ink-button" onClick={() => void removeThread(key)}>Clear conversation</button><button type="button" className="sending-ink-button" onClick={() => setDeleteKey(null)}>Keep</button></div> : <><button type="button" className="sending-inbox-open" onClick={() => switchTo("whisper", key)}><span className="sending-row-heading">{unreadFor(key) > 0 && <span className="sending-unread-dot" aria-label={`${unreadFor(key)} unread`} />}<strong>{nameFor(item.ref)}</strong><time>{readableTime(item.last.createdAt)}</time></span><span className="sending-excerpt">{item.last.userId === myId ? "You: " : ""}{item.last.body}</span>{item.ref.myPersona && <small>as {item.ref.myPersona}</small>}</button><button type="button" className="sending-clear" aria-label={`Clear conversation with ${nameFor(item.ref)}`} onClick={() => setDeleteKey(key)}>×</button></>}</div>)}
          </> : <>{ready && !shown.length && <p className="sending-empty">{openRef ? `No letters yet. Write to ${nameFor(openRef)}.` : "No messages yet. Start the conversation."}</p>}{shown.map(m => <article className={`sending-message${m.userId === myId ? " is-own" : ""}`} key={m.id} id={`sending-message-${m.id}`}><div className="sending-message-meta"><strong>{m.userId === myId ? m.speaker ? `You as ${m.speaker}` : "You" : m.channel !== "ooc" && m.speaker ? m.speaker : m.userName}</strong><time>{readableTime(m.createdAt)}</time></div>{m.replyTo && <blockquote><strong>{m.replyTo.author}</strong><span>{m.replyTo.body}</span></blockquote>}{m.id === animateId && open && m.channel === "whisper" && m.userId !== myId ? <MagicLetter key={m.id} text={m.body} onProgress={position => { const viewport = log.current; const letter = viewport?.querySelector<HTMLCanvasElement>(".sending-magic-letter canvas"); if (magicFollow.current && viewport && letter) { const offset = letter.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop; viewport.scrollTop = Math.max(0, offset + position - viewport.clientHeight + 35); } }} /> : <p className={m.chatFlair === "chat-first-flame" ? "relic-chat-name" : undefined}>{m.body}</p>}{canChat && <button type="button" className="sending-ink-button sending-message-reply" onClick={() => focusReply(m)}>Reply<span className="sr-only"> to {m.speaker || m.userName}</span></button>}</article>)}</>}
        </div>
        {canChat && composing && (channel !== "whisper" || openRef) && channel !== "rolls" && <form className="sending-compose" onSubmit={send}>{quote && <div className="sending-reply-quote"><span>Replying to {quote.speaker || quote.userName}: {quote.body}</span><button type="button" aria-label="Cancel quoted reply" onClick={() => setQuote(null)}>×</button></div>}{channel === "ic" && isDM && <label>Speaking as<select value={partySpeaker} onChange={e => setPartySpeaker(e.target.value)}><option value="gm">GM</option>{characters.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}</select></label>}<label className="sr-only" htmlFor={`sending-draft-${campaignId}`}>{openRef ? `Reply to ${nameFor(openRef)}` : "Write a message"}</label><textarea id={`sending-draft-${campaignId}`} ref={input} maxLength={4000} rows={2} value={draft} disabled={sending} onChange={e => setDrafts(old => ({ ...old, [draftKey]: e.target.value }))} placeholder={channel === "whisper" ? "Write your Sending…" : "Write your message…"} /><div className="sending-compose-actions"><button type="button" className="sending-ink-button" disabled={sending} onClick={() => { setComposing(false); setQuote(null); }}>Cancel</button><button className="sending-send" disabled={!draft.trim() || sending}>{sending ? "Sending…" : channel === "whisper" ? "Send Sending" : "Send message"}</button></div></form>}
        {error && <div className="sending-error" role="alert">{error}{!ready && <button type="button" className="sending-ink-button" onClick={() => window.location.reload()}>Reload to retry</button>}</div>}
        <footer className="sending-footer"><span role="status">{!connected ? "Reconnecting…" : !ready ? "Loading…" : !canChat ? "Spectator · Read only" : channel === "whisper" && openRef ? "Private Sending" : "Your correspondence"}</span><div><button type="button" className="sending-ink-button" onClick={fold}>Roll up</button>{canChat && channel !== "rolls" && (channel !== "whisper" || thread) && !composing && <button type="button" className="sending-ink-button" onClick={() => focusReply()}>{channel === "whisper" ? "Reply" : "Write"}</button>}</div></footer>
      </div>
    </div>
  </aside>;
}

export function SendingHint() { return <div className="scroll-hint"><p>Your messages and dice history live on your Sending parchment in the bottom-right corner.</p><button type="button" className="ghost" onClick={() => window.dispatchEvent(new Event(OPEN_SENDING))}>Open your Sendings</button></div>; }

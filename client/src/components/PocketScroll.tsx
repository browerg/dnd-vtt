import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api, type ChatMessage, type Member, type RollPayload } from "../api";
import { useAuth } from "../App";
import { playChatSound, playScrollSound } from "../chatSound";
import type { CharacterSummary } from "../sheet";
import ChatPanel from "./ChatPanel";
import "./PocketScroll.css";
import { readScrollPreferences, ScrollIcon } from "./ScrollShell";

/** Anything can open the pocket Scroll by dispatching this on window. */
export const OPEN_SCROLL_EVENT = "vivid:open-scroll";
export const openPocketScroll = () => window.dispatchEvent(new Event(OPEN_SCROLL_EVENT));

const PEEK_MS = 5500;

// Remnant's chat as a phone you carry: tucked into the bottom-right corner
// with only its status bar showing, buzzing and peeking a preview when a
// message arrives, and sliding up to full size when tapped. It loads its own
// chat so it works the same on every campaign screen; rolls come from the
// page, which already owns the roll pipeline (and the 3D dice).
export default function PocketScroll({ campaignId, rolls }: { campaignId: number; rolls: RollPayload[] }) {
  const { user } = useAuth();
  const myId = user?.id ?? 0;
  const storageKey = `scroll:${myId}:${campaignId}`;
  const [role, setRole] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesReady, setMessagesReady] = useState(false);
  const [open, setOpen] = useState(() => { try { return sessionStorage.getItem(`${storageKey}:open`) === "true"; } catch { return false; } });
  useEffect(() => { try { sessionStorage.setItem(`${storageKey}:open`,String(open)); } catch {} }, [open,storageKey]);
  const [peek, setPeek] = useState<ChatMessage | null>(null);
  const [buzzing, setBuzzing] = useState(false);
  const [readingChannel, setReadingChannel] = useState<"ic" | "ooc" | "whisper" | null>(null);
  const [seenIds, setSeenIds] = useState({ic:0,ooc:0,whisper:0});
  const lastIdRef = useRef<number | null>(null);
  const peekTimer = useRef<number>();
  const buzzTimer = useRef<number>();
  const body = useRef<HTMLDivElement>(null);

  const loadDetail = useCallback(
    () =>
      api<{ yourRole: string; members: Member[] }>(`/api/campaigns/${campaignId}`)
        .then((r) => {
          setRole(r.yourRole);
          setMembers(r.members);
        })
        .catch(() => {}),
    [campaignId]
  );
  const loadCharacters = useCallback(
    () =>
      api<{ characters: CharacterSummary[] }>(`/api/campaigns/${campaignId}/characters`)
        .then((r) => setCharacters(r.characters))
        .catch(() => {}),
    [campaignId]
  );

  useEffect(() => {
    void loadDetail();
    void loadCharacters();
    api<{ messages: ChatMessage[] }>(`/api/campaigns/${campaignId}/messages`)
      .then((r) => setMessages(r.messages))
      .catch(() => {})
      .finally(() => setMessagesReady(true));

    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("chat", (m: ChatMessage) => {
      if (m.campaignId === campaignId) setMessages((prev) => [...prev.slice(-199), m]);
    });
    socket.on("appearance:update", (m: { campaignId: number; userId: number; chatFlair: string }) => {
      if (m.campaignId === campaignId)
        setMessages((prev) => prev.map((msg) => (msg.userId === m.userId ? { ...msg, chatFlair: m.chatFlair } : msg)));
    });
    for (const event of ["character:update", "character:delete"]) {
      socket.on(event, (m: { campaignId: number }) => m.campaignId === campaignId && void loadCharacters());
    }
    socket.on("campaign:update", (m: { campaignId: number }) => m.campaignId === campaignId && void loadDetail());
    return () => {
      socket.disconnect();
    };
  }, [campaignId, loadCharacters, loadDetail]);

  // History isn't news: the first batch only sets the high-water mark.
  useEffect(() => {
    if (!messagesReady) return;
    const newest = messages.reduce((max, m) => Math.max(max, m.id), 0);
    if (lastIdRef.current === null) {
      lastIdRef.current = newest;
      setSeenIds({ic:newest,ooc:newest,whisper:newest});
      return;
    }
    const fresh = messages.filter((m) => m.id > (lastIdRef.current ?? 0) && m.userId !== myId);
    lastIdRef.current = Math.max(lastIdRef.current, newest);
    if (open) {
      if (fresh.length) playChatSound(fresh.some(m=>m.channel === "whisper") ? "whisper" : "message");

      return;
    }
    const latest = fresh[fresh.length - 1];
    if (!latest) return;
    // Buzz in the pocket and peek the message.
    setPeek(latest);
    window.clearTimeout(peekTimer.current);
    peekTimer.current = window.setTimeout(() => setPeek(null), PEEK_MS);
    setBuzzing(false);
    requestAnimationFrame(() => setBuzzing(true));
    window.clearTimeout(buzzTimer.current);
    buzzTimer.current = window.setTimeout(() => setBuzzing(false), 700);
    playScrollSound("buzz");
    try {
      if(readScrollPreferences(storageKey).vibration) navigator.vibrate?.([90, 70, 90]);
    } catch {
      /* not every device can vibrate */
    }
  }, [messages, messagesReady, myId, open]);

  useEffect(
    () => () => {
      window.clearTimeout(peekTimer.current);
      window.clearTimeout(buzzTimer.current);
    },
    []
  );

  const openScroll = useCallback(() => {
    setOpen(true);
    setPeek(null);

  }, []);
  const tuck = useCallback(() => setOpen(false), []);

  useEffect(() => {
    window.addEventListener(OPEN_SCROLL_EVENT, openScroll);
    return () => window.removeEventListener(OPEN_SCROLL_EVENT, openScroll);
  }, [openScroll]);

  // Escape tucks it away, unless a dialog is up and owns Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector('[aria-modal="true"]')) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Tucked, the phone is mostly off-screen: keep its controls out of the tab order.
  useLayoutEffect(() => {
    if (body.current) body.current.inert = !open;
  }, [open]);

  useEffect(()=>{if(open && readingChannel) { const newest=messages.filter(m=>m.channel===readingChannel).reduce((max,m)=>Math.max(max,m.id),0);setSeenIds(current=>current[readingChannel]===newest ? current : {...current,[readingChannel]:newest}); }},[open,readingChannel,messages]);
  const unread = messages.filter((m) => m.userId !== myId && m.id > seenIds[m.channel]).length;
  const isDM = role === "dm" || role === "co-dm";

  const sendChat = useCallback(
    async (
      text: string,
      channel: "ic" | "ooc" | "whisper",
      targetUserId?: number,
      speakerCharacterId?: number,
      speakerAsGm?: boolean,
      replyToId?: number,
      speakerName?: string
    ) => {
      await api(`/api/campaigns/${campaignId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: text, channel, targetUserId, speakerCharacterId, speakerAsGm, replyToId, speakerName }),
      });
    },
    [campaignId]
  );

  return (
    <div className={`pocket-scroll${open ? " is-open" : ""}${buzzing ? " is-buzzing" : ""}`}>
      {!open && peek && (
        <button type="button" className="pocket-peek" onClick={openScroll}>
          <span className="pocket-peek-app">
            <ScrollIcon name="messages"/> Scroll · now
          </span>
          <strong>{peek.speaker || peek.userName}</strong>
          <span className="pocket-peek-body">{peek.body}</span>
        </button>
      )}
      {!open && (
        <button
          type="button"
          className="pocket-strip"
          onClick={openScroll}
          aria-label={unread ? `Open your Scroll, ${unread} unread` : "Open your Scroll"}
        >
          {unread > 0 && <span className="pocket-unread">{unread > 99 ? "99+" : unread}</span>}
        </button>
      )}
      <div className="pocket-scroll-body" ref={body}>
        <ChatPanel
          messages={messages}
          messagesReady={messagesReady}
          members={members}
          characters={characters}
          myId={myId}
          canChat={!!role && role !== "spectator"}
          isDM={isDM}
          scroll
          pocket
          scrollStorageKey={storageKey}
          pocketOpen={open}
          onReadChannel={setReadingChannel}
          rolls={rolls}
          onTuck={tuck}
          onSend={sendChat}
        />
      </div>
    </div>
  );
}

/** Stands in for the chat panel in Remnant campaigns: the chat lives on the Scroll. */
export function ScrollHint() {
  return (
    <div className="scroll-hint">
      <ScrollIcon name="messages"/>
      <p>Your chat lives on your Scroll, tucked into the bottom-right corner.</p>
      <button type="button" className="ghost" onClick={openPocketScroll}>
        Open your Scroll
      </button>
    </div>
  );
}

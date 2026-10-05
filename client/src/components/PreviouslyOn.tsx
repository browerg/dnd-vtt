import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { io, type Socket } from "socket.io-client";
import { api } from "../api";
import { useAuth } from "../App";
import "./PreviouslyOn.css";

type HighlightKind = "quest" | "handout" | "roll" | "journal" | "note";
interface Highlight { kind: HighlightKind; text: string }
interface Recap {
  id: number;
  sessionNumber: number;
  title: string;
  body: string;
  highlights: Highlight[];
  authorId: number | null;
  authorName: string;
  createdAt: string;
}
interface DraftLine extends Highlight { keep: boolean }

const ICON: Record<HighlightKind, string> = { quest: "📜", handout: "🗺️", roll: "🎲", journal: "📓", note: "✦" };
const seenKey = (campaignId: number) => `vivid-recap-seen-${campaignId}`;

function lastSeen(campaignId: number): number {
  try { return Number(localStorage.getItem(seenKey(campaignId))) || 0; } catch { return 0; }
}
function markSeen(campaignId: number, id: number) {
  try { localStorage.setItem(seenKey(campaignId), String(id)); } catch { /* Storage can be disabled. */ }
}

// "Previously on…" for a campaign: a topbar button anyone can use to reread
// recaps, an automatic reveal of a recap the player hasn't seen yet, and —
// for the GM — a composer pre-filled with what happened since the last one.
export default function PreviouslyOn({
  campaignId,
  campaignName,
  isDM,
  system,
}: {
  campaignId: number;
  campaignName: string;
  isDM: boolean;
  system: string;
}) {
  const { user } = useAuth();
  const [recaps, setRecaps] = useState<Recap[]>([]);
  const [reading, setReading] = useState<number | null>(null); // index into recaps
  const [composing, setComposing] = useState(false);
  const myId = useRef(user?.id);
  myId.current = user?.id;

  const load = useCallback(
    (autoOpen: boolean) =>
      api<{ recaps: Recap[] }>(`/api/campaigns/${campaignId}/recaps`)
        .then((r) => {
          setRecaps(r.recaps);
          const latest = r.recaps[0];
          if (autoOpen && latest && latest.authorId !== myId.current && latest.id > lastSeen(campaignId)) setReading(0);
        })
        .catch(() => {}),
    [campaignId]
  );

  useEffect(() => {
    void load(true);
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("recap:published", (m: { campaignId: number }) => {
      if (m.campaignId === campaignId) void load(true);
    });
    return () => {
      socket.disconnect();
    };
  }, [campaignId, load]);

  const closeReader = () => {
    if (recaps[0]) markSeen(campaignId, recaps[0].id);
    setReading(null);
  };

  const recap = reading != null ? recaps[reading] : undefined;
  const eyebrow = system === "remnant" ? "Huntsman Network · Mission log" : `Previously, in ${campaignName}…`;

  return (
    <>
      <button
        type="button"
        className="ghost link campaign-nav-link previously-on-trigger"
        onClick={() => (recaps.length ? setReading(0) : isDM ? setComposing(true) : undefined)}
        disabled={!recaps.length && !isDM}
        title={recaps.length ? "Read the latest session recap" : isDM ? "Write the first session recap" : "No recaps yet"}
      >
        📜 Previously on…
      </button>

      {recap &&
        createPortal(
          <div className="recap-overlay" role="dialog" aria-modal="true" aria-label={recap.title}
            onClick={(e) => e.target === e.currentTarget && closeReader()}
            onKeyDown={(e) => e.key === "Escape" && closeReader()}>
            <article className="recap-card">
              <p className="recap-eyebrow">{eyebrow}</p>
              <h2 className="recap-title">{recap.title}</h2>
              <p className="recap-meta">
                {recap.sessionNumber > 0 && <>Session {recap.sessionNumber} · </>}
                {recap.authorName && <>Told by {recap.authorName} · </>}
                {new Date(recap.createdAt.replace(" ", "T") + "Z").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
              </p>
              {recap.body && <div className="recap-body">{recap.body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>}
              {recap.highlights.length > 0 && (
                <ul className="recap-highlights">
                  {recap.highlights.map((h, i) => (
                    <li key={i} style={{ animationDelay: `${0.25 + i * 0.07}s` }}>
                      <span aria-hidden="true">{ICON[h.kind]}</span>
                      {h.text}
                    </li>
                  ))}
                </ul>
              )}
              <footer className="recap-footer">
                <span className="recap-nav">
                  <button type="button" className="ghost mini" disabled={reading! >= recaps.length - 1} onClick={() => setReading((r) => (r ?? 0) + 1)}>
                    ← Older
                  </button>
                  <button type="button" className="ghost mini" disabled={reading === 0} onClick={() => setReading((r) => Math.max(0, (r ?? 0) - 1))}>
                    Newer →
                  </button>
                </span>
                <span className="recap-actions">
                  {isDM && (
                    <button type="button" className="ghost" onClick={() => { closeReader(); setComposing(true); }}>
                      Write new recap
                    </button>
                  )}
                  <button type="button" className="primary" autoFocus onClick={closeReader}>
                    Continue the story
                  </button>
                </span>
              </footer>
            </article>
          </div>,
          document.body
        )}

      {composing && isDM &&
        createPortal(
          <RecapComposer
            campaignId={campaignId}
            onClose={() => setComposing(false)}
            onPublished={(r) => {
              setComposing(false);
              markSeen(campaignId, r.id);
              void load(false);
            }}
          />,
          document.body
        )}
    </>
  );
}

function RecapComposer({
  campaignId,
  onClose,
  onPublished,
}: {
  campaignId: number;
  onClose: () => void;
  onPublished: (recap: Recap) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ sessionNumber: number; highlights: Highlight[] }>(`/api/campaigns/${campaignId}/recaps/draft`)
      .then((r) => {
        setTitle(r.sessionNumber > 0 ? `Session ${r.sessionNumber}` : "");
        setLines(r.highlights.map((h) => ({ ...h, keep: true })));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [campaignId]);

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((all) => all.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ recap: Recap }>(`/api/campaigns/${campaignId}/recaps`, {
        method: "POST",
        body: JSON.stringify({
          title,
          body,
          highlights: lines.filter((l) => l.keep && l.text.trim()).map(({ kind, text }) => ({ kind, text })),
        }),
      });
      onPublished(r.recap);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="recap-overlay" role="dialog" aria-modal="true" aria-label="Write a session recap"
      onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <form className="recap-card recap-composer" onSubmit={publish}>
        <p className="recap-eyebrow">Write a recap</p>
        <label className="recap-field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session 4: The Breach" required autoFocus />
        </label>
        <label className="recap-field">
          <span>What happened</span>
          <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="A few lines in your own voice. Leave a blank line between paragraphs." />
        </label>
        <div className="recap-field">
          <span>Highlights {loading ? "· gathering…" : "· since the last recap"}</span>
          {!loading && lines.length === 0 && <p className="muted small">Nothing recorded since the last recap. Add your own below.</p>}
          <ul className="recap-draft-lines">
            {lines.map((l, i) => (
              <li key={i} className={l.keep ? "" : "is-dropped"}>
                <input type="checkbox" checked={l.keep} onChange={(e) => setLine(i, { keep: e.target.checked })} aria-label="Include this line" />
                <span aria-hidden="true">{ICON[l.kind]}</span>
                <input value={l.text} onChange={(e) => setLine(i, { text: e.target.value })} aria-label="Highlight text" />
              </li>
            ))}
          </ul>
          <button type="button" className="ghost mini" onClick={() => setLines((all) => [...all, { kind: "note", text: "", keep: true }])}>
            + Add a line
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        <footer className="recap-footer">
          <span />
          <span className="recap-actions">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={busy || loading}>
              {busy ? "Publishing…" : "Publish to the table"}
            </button>
          </span>
        </footer>
      </form>
    </div>
  );
}

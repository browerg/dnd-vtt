import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { handleBulletKeyDown } from "../bulletList";

interface Quest {
  id: number;
  title: string;
  description: string;
  status: "active" | "completed" | "failed";
  hidden: boolean;
}

interface Npc {
  id: number;
  name: string;
  description: string;
  location: string;
  alive: boolean;
  hidden: boolean;
  secretNotes?: string;
}

interface JournalEntry {
  id: number;
  authorId: number;
  authorName: string;
  title: string;
  body: string;
  createdAt: string;
}

interface Handout {
  id: number;
  name: string;
  url: string;
  isPdf: boolean;
  revealed: boolean;
}

type Tab = "quests" | "npcs" | "journal" | "handouts";

interface Props {
  campaignId: number;
  isDM: boolean;
  canWrite: boolean; // not a spectator
  myId: number;
  refreshKey: number; // bumped by codex:update socket events
}

const STATUS_LABEL = { active: "Active", completed: "Completed ✓", failed: "Failed ✗" };

export default function CodexPanel({ campaignId, isDM, canWrite, myId, refreshKey }: Props) {
  const [tab, setTab] = useState<Tab>("quests");
  const [quests, setQuests] = useState<Quest[]>([]);
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [handouts, setHandouts] = useState<Handout[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<{ quests: Quest[] }>(`/api/campaigns/${campaignId}/quests`).then((r) => setQuests(r.quests)).catch(() => {});
    api<{ npcs: Npc[] }>(`/api/campaigns/${campaignId}/npcs`).then((r) => setNpcs(r.npcs)).catch(() => {});
    api<{ entries: JournalEntry[] }>(`/api/campaigns/${campaignId}/journal`)
      .then((r) => setEntries(r.entries))
      .catch(() => {});
    api<{ handouts: Handout[] }>(`/api/campaigns/${campaignId}/handouts`)
      .then((r) => setHandouts(r.handouts))
      .catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const act = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const addQuest = (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value;
    const description = (form.elements.namedItem("desc") as HTMLTextAreaElement).value;
    act(async () => {
      await api(`/api/campaigns/${campaignId}/quests`, {
        method: "POST",
        body: JSON.stringify({ title, description }),
      });
      form.reset();
    });
  };

  const addNpc = (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value;
    act(async () => {
      await api(`/api/campaigns/${campaignId}/npcs`, {
        method: "POST",
        body: JSON.stringify({
          name: get("name"),
          location: get("location"),
          description: get("desc"),
          secretNotes: get("secret"),
        }),
      });
      form.reset();
    });
  };

  const addEntry = (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value;
    const body = (form.elements.namedItem("body") as HTMLTextAreaElement).value;
    act(async () => {
      await api(`/api/campaigns/${campaignId}/journal`, {
        method: "POST",
        body: JSON.stringify({ title, body }),
      });
      form.reset();
    });
  };

  const uploadHandout = (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", (form.elements.namedItem("name") as HTMLInputElement).value);
    act(async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/handouts`, { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
      form.reset();
    });
  };

  return (
    <div className="codex">
      <div className="tabs chat-tabs">
        {(["quests", "npcs", "journal", "handouts"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "tab active" : "tab"} onClick={() => setTab(t)}>
            {t === "npcs" ? "NPCs" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}

      {tab === "quests" && (
        <div className="codex-body">
          {quests.length === 0 && <p className="muted">No quests yet.</p>}
          {quests.map((q) => (
            <div key={q.id} className={`codex-item quest-${q.status}`}>
              <div className="row-between">
                <strong>
                  {q.title}
                  {q.hidden && <span className="badge vis-badge">hidden</span>}
                </strong>
                <span className="codex-controls">
                  {isDM ? (
                    <>
                      <select
                        value={q.status}
                        onChange={(e) =>
                          act(() =>
                            api(`/api/campaigns/${campaignId}/quests/${q.id}`, {
                              method: "PUT",
                              body: JSON.stringify({ status: e.target.value }),
                            })
                          )
                        }
                      >
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                      </select>
                      <button
                        className="ghost mini"
                        title={q.hidden ? "Reveal to players" : "Hide from players"}
                        onClick={() =>
                          act(() =>
                            api(`/api/campaigns/${campaignId}/quests/${q.id}`, {
                              method: "PUT",
                              body: JSON.stringify({ hidden: !q.hidden }),
                            })
                          )
                        }
                      >
                        {q.hidden ? "👁" : "🙈"}
                      </button>
                      <button
                        className="ghost mini"
                        onClick={() =>
                          window.confirm(`Delete quest "${q.title}"?`) &&
                          act(() => api(`/api/campaigns/${campaignId}/quests/${q.id}`, { method: "DELETE" }))
                        }
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <span className={`badge status-${q.status}`}>{STATUS_LABEL[q.status]}</span>
                  )}
                </span>
              </div>
              {q.description && <p className="muted small pre-wrap">{q.description}</p>}
            </div>
          ))}
          {isDM && (
            <form onSubmit={addQuest} className="stack codex-form">
              <input name="title" placeholder="New quest title" required />
              <textarea name="desc" rows={2} placeholder="Objectives, rewards, rumors…" />
              <button className="ghost">Add quest</button>
            </form>
          )}
        </div>
      )}

      {tab === "npcs" && (
        <div className="codex-body">
          {npcs.length === 0 && <p className="muted">No NPCs yet.</p>}
          {npcs.map((n) => (
            <div key={n.id} className="codex-item">
              <div className="row-between">
                <strong>
                  {!n.alive && "💀 "}
                  {n.name}
                  {n.location && <span className="muted small"> · {n.location}</span>}
                  {n.hidden && <span className="badge vis-badge">hidden</span>}
                </strong>
                {isDM && (
                  <span className="codex-controls">
                    <button
                      className="ghost mini"
                      title={n.alive ? "Mark dead" : "Mark alive"}
                      onClick={() =>
                        act(() =>
                          api(`/api/campaigns/${campaignId}/npcs/${n.id}`, {
                            method: "PUT",
                            body: JSON.stringify({ alive: !n.alive }),
                          })
                        )
                      }
                    >
                      {n.alive ? "💀" : "❤️"}
                    </button>
                    <button
                      className="ghost mini"
                      title={n.hidden ? "Reveal to players" : "Hide from players"}
                      onClick={() =>
                        act(() =>
                          api(`/api/campaigns/${campaignId}/npcs/${n.id}`, {
                            method: "PUT",
                            body: JSON.stringify({ hidden: !n.hidden }),
                          })
                        )
                      }
                    >
                      {n.hidden ? "👁" : "🙈"}
                    </button>
                    <button
                      className="ghost mini"
                      onClick={() =>
                        window.confirm(`Delete NPC "${n.name}"?`) &&
                        act(() => api(`/api/campaigns/${campaignId}/npcs/${n.id}`, { method: "DELETE" }))
                      }
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
              {n.description && <p className="muted small pre-wrap">{n.description}</p>}
              {isDM && n.secretNotes && (
                <p className="small secret-notes">🤫 {n.secretNotes}</p>
              )}
            </div>
          ))}
          {isDM && (
            <form onSubmit={addNpc} className="stack codex-form">
              <div className="row-between">
                <input name="name" placeholder="NPC name" required />
                <input name="location" placeholder="Location" />
              </div>
              <textarea name="desc" rows={2} placeholder="Who they are (players can see this)" />
              <textarea name="secret" rows={2} placeholder="Secret DM notes (players never see this)" />
              <button className="ghost">Add NPC</button>
            </form>
          )}
        </div>
      )}

      {tab === "journal" && (
        <div className="codex-body">
          {entries.length === 0 && <p className="muted">No entries yet. Write what happened.</p>}
          {entries.map((j) => (
            <div key={j.id} className="codex-item">
              <div className="row-between">
                <strong>{j.title}</strong>
                <span className="codex-controls">
                  <span className="muted small">
                    {j.authorName} · {j.createdAt.slice(0, 10)}
                  </span>
                  {(isDM || j.authorId === myId) && (
                    <button
                      className="ghost mini"
                      onClick={() =>
                        window.confirm(`Delete entry "${j.title}"?`) &&
                        act(() => api(`/api/campaigns/${campaignId}/journal/${j.id}`, { method: "DELETE" }))
                      }
                    >
                      ✕
                    </button>
                  )}
                </span>
              </div>
              {j.body && <p className="muted small pre-wrap">{j.body}</p>}
            </div>
          ))}
          {canWrite && (
            <form onSubmit={addEntry} className="stack codex-form">
              <input name="title" placeholder="Entry title — e.g. Session 3: the crypt" required />
              <textarea name="body" rows={3} placeholder="What happened…" onKeyDown={handleBulletKeyDown} />
              <button className="ghost">Add entry</button>
            </form>
          )}
        </div>
      )}

      {tab === "handouts" && (
        <div className="codex-body">
          {handouts.length === 0 && <p className="muted">Nothing here{isDM ? " yet — upload maps, letters, art…" : "."}</p>}
          <div className="handout-grid">
            {handouts.map((h) => (
              <div key={h.id} className="handout-card">
                <a href={h.url} target="_blank" rel="noreferrer">
                  {h.isPdf ? <span className="handout-pdf">📄</span> : <img src={h.url} alt={h.name} />}
                </a>
                <div className="row-between">
                  <span className="small handout-name">{h.name}</span>
                  {isDM && (
                    <span className="codex-controls">
                      <button
                        className="ghost mini"
                        title={h.revealed ? "Hide from players" : "Reveal to players"}
                        onClick={() =>
                          act(() =>
                            api(`/api/campaigns/${campaignId}/handouts/${h.id}`, {
                              method: "PUT",
                              body: JSON.stringify({ revealed: !h.revealed }),
                            })
                          )
                        }
                      >
                        {h.revealed ? "🙈" : "👁"}
                      </button>
                      <button
                        className="ghost mini"
                        onClick={() =>
                          window.confirm(`Delete handout "${h.name}"?`) &&
                          act(() => api(`/api/campaigns/${campaignId}/handouts/${h.id}`, { method: "DELETE" }))
                        }
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
                {isDM && !h.revealed && <span className="badge vis-badge">hidden</span>}
              </div>
            ))}
          </div>
          {isDM && (
            <form onSubmit={uploadHandout} className="stack codex-form">
              <input name="name" placeholder="Handout name" />
              <input name="file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required />
              <button className="ghost">Upload handout</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

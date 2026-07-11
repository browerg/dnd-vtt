import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, type CampaignSummary } from "../api";
import { useAuth } from "../App";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [system, setSystem] = useState("remnant");
  const [error, setError] = useState("");

  const load = () =>
    api<{ campaigns: CampaignSummary[] }>("/api/campaigns").then((r) => setCampaigns(r.campaigns));

  useEffect(() => {
    load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({ name, description, system }),
      });
      setName("");
      setDescription("");
      setSystem("remnant");
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">⚔️ Tabletop</span>
        <span className="spacer" />
        <span className="muted">{user?.display_name}</span>
        <button className="ghost" onClick={logout}>
          Log out
        </button>
      </header>
      <main className="content">
        <div className="row-between">
          <h2>Your campaigns</h2>
          <button className="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New campaign"}
          </button>
        </div>
        {showForm && (
          <form onSubmit={create} className="card stack">
            <input
              placeholder="Campaign name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <details className="advanced-opts">
              <summary className="muted small">Advanced</summary>
              <label className="stack sys-pick">
                <span className="muted small">
                  Game system — Remnant is the standard here; only change this if you know you need to.
                </span>
                <select value={system} onChange={(e) => setSystem(e.target.value)}>
                  <option value="remnant">Remnant (RWBY)</option>
                  <option value="dnd5e">D&amp;D 5e</option>
                </select>
              </label>
            </details>
            {error && <div className="error">{error}</div>}
            <button className="primary">Create campaign</button>
          </form>
        )}
        {campaigns.length === 0 && !showForm && (
          <p className="muted">No campaigns yet. Create one, or join with an invite link.</p>
        )}
        <div className="grid">
          {campaigns.map((c) => (
            <Link key={c.id} to={`/campaigns/${c.id}`} className="card campaign-card">
              <h3>{c.name}</h3>
              <p className="muted clamp">{c.description || "No description yet."}</p>
              <div className="row-between">
                <span>
                  <span className={`badge role-${c.role}`}>{c.role.toUpperCase()}</span>
                  {c.system === "dnd5e" && <span className="badge vis-badge">D&amp;D 5e</span>}
                </span>
                <span className="muted">
                  {c.member_count} {c.member_count === 1 ? "member" : "members"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

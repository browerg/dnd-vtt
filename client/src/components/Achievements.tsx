import { useEffect, useState } from "react";
import { api } from "../api";

interface Achievement {
  id: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  unlockedAt: string | null;
  rewardCosmeticId: string | null;
}

export default function Achievements() {
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ achievements: Achievement[] }>("/api/achievements");
      setItems(result.achievements);
    } catch (e: any) {
      setError(e.message || "Could not load achievements.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  return (
    <section className="card" aria-labelledby="achievements-heading">
      <div className="row-between">
        <h3 id="achievements-heading">Achievements</h3>
        <button type="button" className="ghost" onClick={() => void load()} disabled={loading}>Refresh</button>
      </div>
      <p className="muted small">Account-wide progress across campaigns, starting with this update. Cosmetic rewards are coming later; your unlocks will be saved.</p>
      <p className="muted small">A maximum roll means every kept die shows its highest face; a minimum means every kept die shows 1. A d20 counts on 20 or 1; 2d10 counts on two 10s or two 1s. Extra dice must also be maximum or minimum. Modifiers and discarded dice do not count. Each roll counts once, and an ordinary result breaks your streak. Manual and blind rolls are excluded and do not interrupt streaks.</p>
      <p className="muted small">The Adventure Begins unlocks for current campaign members other than spectators when the GM first completes a quest, even with no VCoin reward.</p>
      {loading && <p role="status">Loading achievements…</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {!loading && !error && <p className="muted small">{items.filter((item) => item.unlockedAt).length} / {items.length} unlocked</p>}
      <div className="stack">
        {items.map((item) => (
          <article key={item.id} className="card">
            <div className="row-between">
              <strong>{item.name}</strong>
              <span className="badge">{item.unlockedAt ? "Unlocked" : "Locked"}</span>
            </div>
            <p>{item.description}</p>
            <label className="stack">
              <span className="muted small">{item.progress} / {item.target}</span>
              <progress value={item.progress} max={item.target} aria-label={`${item.name} progress`} />
            </label>
            {item.unlockedAt && <p className="muted small">Unlocked {new Date(item.unlockedAt.replace(" ", "T") + "Z").toLocaleDateString()}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

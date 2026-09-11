import { useEffect, useState } from "react";
import { api } from "../api";
import BadgeShowcase, { type ProfileBadge } from "./BadgeShowcase";

interface Achievement {
  id: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  unlockedAt: string | null;
  rewardCosmeticId: string | null;
  badgeImage: string;
}

export default function Achievements() {
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showcase, setShowcase] = useState<ProfileBadge[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ achievements: Achievement[]; showcase: ProfileBadge[] }>("/api/achievements");
      setItems(result.achievements);
      setShowcase(result.showcase);
    } catch (e: any) {
      setError(e.message || "Could not load achievements.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const refresh = () => { void load(); };
    refresh();
    window.addEventListener("achievements:updated", refresh);
    return () => window.removeEventListener("achievements:updated", refresh);
  }, []);

  const toggleBadge = async (id: string) => {
    const ids = showcase.map((badge) => badge.id);
    const badgeIds = ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ showcase: ProfileBadge[] }>("/api/achievements/showcase", {
        method: "PUT", body: JSON.stringify({ badgeIds }),
      });
      setShowcase(result.showcase);
      setNotice("Profile badges saved.");
    } catch (e: any) { setError(e.message || "Could not save badges."); }
    finally { setSaving(false); }
  };

  return (
    <section className="card" aria-labelledby="achievements-heading">
      <div className="row-between">
        <h3 id="achievements-heading">Achievements</h3>
        <button type="button" className="ghost" onClick={() => void load()} disabled={loading || saving}>Refresh</button>
      </div>
      <p className="muted small">Your trophy shelf. Display up to three earned badges on your profile for your campaign members to see.</p>
      <BadgeShowcase badges={showcase} />
      {notice && <p role="status">{notice}</p>}
      <details className="achievement-rules"><summary>How achievements work</summary>
      <p className="muted small">Account-wide progress across campaigns. Badge artwork unlocks with each achievement; additional cosmetic rewards may be added later.</p>
      <p className="muted small">A maximum roll means every kept die shows its highest face; a minimum means every kept die shows 1. A d20 counts on 20 or 1; 2d10 counts on two 10s or two 1s. Extra dice must also be maximum or minimum. Modifiers and discarded dice do not count. Each roll counts once, and an ordinary result breaks your streak. Manual and blind rolls are excluded and do not interrupt streaks.</p>
      <p className="muted small">The Adventure Begins unlocks for current campaign members other than spectators when the GM first completes a quest, even with no VCoin reward.</p>
      </details>
      {loading && <p role="status">Loading achievements…</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {!loading && !error && <p className="muted small">{items.filter((item) => item.unlockedAt).length} / {items.length} unlocked</p>}
      <div className="achievement-gallery">
        {items.map((item) => (
          <article key={item.id} className={`card achievement-medal${item.unlockedAt ? "" : " is-locked"}`}>
            <img src={item.badgeImage} alt="" width="140" height="140" loading="lazy" />
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
            <button type="button" className={showcase.some((badge) => badge.id === item.id) ? "primary" : "ghost"}
              aria-pressed={showcase.some((badge) => badge.id === item.id)}
              disabled={!item.unlockedAt || saving || loading || (showcase.length >= 3 && !showcase.some((badge) => badge.id === item.id))}
              onClick={() => void toggleBadge(item.id)}>
              {!item.unlockedAt ? "Earn to display" : showcase.some((badge) => badge.id === item.id) ? "Remove from profile" : "Display on profile"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

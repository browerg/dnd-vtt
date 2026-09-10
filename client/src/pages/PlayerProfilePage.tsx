import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Avatar } from "../components/Avatar";
import BadgeShowcase, { type ProfileBadge } from "../components/BadgeShowcase";

export default function PlayerProfilePage() {
  const { userId } = useParams();
  const [data, setData] = useState<{ profile: { id: number; display_name: string; avatarPath: string }; showcase: ProfileBadge[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData(null); setError("");
    api<NonNullable<typeof data>>(`/api/achievements/profiles/${userId}`)
      .then((result) => { if (active) setData(result); })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [userId]);
  return <div className="shell">
    <header className="topbar"><Link to="/" className="ghost link">← Campaigns</Link><span className="brand">Player Profile</span></header>
    <main className="content">
      {error && <p className="error" role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading profile…</p>}
      {data && <section className="card">
        <div className="profile-head"><Avatar name={data.profile.display_name} src={data.profile.avatarPath || undefined} id={data.profile.id} size={96} /><h1>{data.profile.display_name}</h1></div>
        <h3>Featured achievements</h3><BadgeShowcase badges={data.showcase} />
      </section>}
    </main>
  </div>;
}

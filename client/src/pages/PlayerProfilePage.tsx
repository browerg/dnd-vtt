import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import type { ProfileBadge } from "../components/BadgeShowcase";
import ProfileIdentity, { type ProfileIdentityData } from "../components/ProfileIdentity";

export default function PlayerProfilePage() {
  const { userId } = useParams();
  const [data, setData] = useState<{ profile: ProfileIdentityData; showcase: ProfileBadge[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData(null); setError("");
    api<NonNullable<typeof data>>(`/api/achievements/profiles/${userId}`)
      .then((result) => { if (active) setData(result); })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [userId]);
  return <div className="personal-profile" data-profile-style={data?.profile.profileStyle ?? "astral"}>
    <header className="profile-navigation"><Link to="/">← Campaigns</Link><span className="profile-wordmark">VIVID REALMS</span><Link to="/profile">My profile ↗</Link></header>
    <main className="profile-layout">
      {error && <p className="error" role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading profile…</p>}
      {data && <ProfileIdentity profile={data.profile} badges={data.showcase} />}
      <footer className="profile-footer">NO TWO ADVENTURES LEAVE THE SAME MARK.</footer>
    </main>
  </div>;
}

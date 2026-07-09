import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { api, type Member } from "../api";

interface CampaignDetail {
  campaign: { id: number; name: string; description: string; created_at: string };
  members: Member[];
  yourRole: string;
}

export default function CampaignPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [online, setOnline] = useState<Set<number>>(new Set());
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<CampaignDetail>(`/api/campaigns/${campaignId}`)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [campaignId]);

  useEffect(() => {
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("presence", (p: { campaignId: number; onlineUserIds: number[] }) => {
      if (p.campaignId === campaignId) setOnline(new Set(p.onlineUserIds));
    });
    return () => {
      socket.disconnect();
    };
  }, [campaignId]);

  const createInvite = async () => {
    const r = await api<{ code: string }>(`/api/campaigns/${campaignId}/invites`, {
      method: "POST",
      body: JSON.stringify({ role: "player" }),
    });
    setInviteUrl(`${window.location.origin}/join/${r.code}`);
    setCopied(false);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  };

  if (error) return <div className="page-center error">{error}</div>;
  if (!detail) return <div className="page-center muted">Loading…</div>;

  const isDM = detail.yourRole === "dm" || detail.yourRole === "co-dm";

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="ghost link">
          ← Campaigns
        </Link>
        <span className="brand">{detail.campaign.name}</span>
        <span className="spacer" />
        <span className={`badge role-${detail.yourRole}`}>{detail.yourRole.toUpperCase()}</span>
      </header>
      <main className="content columns">
        <section className="card">
          <h3>About this campaign</h3>
          <p className="muted">{detail.campaign.description || "No description yet."}</p>
          {isDM && (
            <div className="stack invite-box">
              <button className="primary" onClick={createInvite}>
                Create invite link
              </button>
              {inviteUrl && (
                <div className="row-between invite-url">
                  <code>{inviteUrl}</code>
                  <button className="ghost" onClick={copy}>
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
        <section className="card">
          <h3>Party</h3>
          <ul className="member-list">
            {detail.members.map((m) => (
              <li key={m.id} className="row-between">
                <span>
                  <span className={online.has(m.id) ? "dot online" : "dot"} />
                  {m.display_name}
                </span>
                <span className={`badge role-${m.role}`}>{m.role.toUpperCase()}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

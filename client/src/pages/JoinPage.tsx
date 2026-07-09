import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../App";

interface InviteInfo {
  invite: { code: string; role: string; campaign_id: number; name: string; description: string };
}

export default function JoinPage() {
  const { code } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    api<InviteInfo>(`/api/invites/${code}`)
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, [code, user, navigate]);

  const join = async () => {
    try {
      const r = await api<{ campaignId: number }>(`/api/invites/${code}/join`, { method: "POST" });
      navigate(`/campaigns/${r.campaignId}`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (error) return <div className="page-center error">{error}</div>;
  if (!info) return <div className="page-center muted">Loading…</div>;

  return (
    <div className="page-center">
      <div className="card login-card">
        <h2>You're invited!</h2>
        <p>
          Join <strong>{info.invite.name}</strong> as a{" "}
          <span className={`badge role-${info.invite.role}`}>{info.invite.role.toUpperCase()}</span>
        </p>
        <p className="muted">{info.invite.description || ""}</p>
        <button className="primary" onClick={join}>
          Join campaign
        </button>
      </div>
    </div>
  );
}

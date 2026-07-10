import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { api, type Member, type RollPayload } from "../api";
import { animateRoll } from "../dice3d";
import type { CharacterSummary } from "../sheet";
import DicePanel from "../components/DicePanel";
import RollFeed from "../components/RollFeed";

interface CampaignDetail {
  campaign: { id: number; name: string; description: string; created_at: string };
  members: Member[];
  yourRole: string;
}

export default function CampaignPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [online, setOnline] = useState<Set<number>>(new Set());
  const [rolls, setRolls] = useState<RollPayload[]>([]);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [newCharName, setNewCharName] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const loadCharacters = useCallback(
    () =>
      api<{ characters: CharacterSummary[] }>(`/api/campaigns/${campaignId}/characters`)
        .then((r) => setCharacters(r.characters))
        .catch(() => {}),
    [campaignId]
  );

  useEffect(() => {
    api<CampaignDetail>(`/api/campaigns/${campaignId}`)
      .then(setDetail)
      .catch((e) => setError(e.message));
    api<{ rolls: RollPayload[] }>(`/api/campaigns/${campaignId}/rolls`)
      .then((r) => setRolls(r.rolls))
      .catch(() => {});
    loadCharacters();
  }, [campaignId, loadCharacters]);

  useEffect(() => {
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("presence", (p: { campaignId: number; onlineUserIds: number[] }) => {
      if (p.campaignId === campaignId) setOnline(new Set(p.onlineUserIds));
    });
    socket.on("roll", (roll: RollPayload) => {
      if (roll.campaignId !== campaignId) return;
      setRolls((prev) => [...prev.slice(-99), roll]);
      if (roll.detail) animateRoll(roll.detail);
    });
    socket.on("character:update", (msg: { campaignId: number }) => {
      if (msg.campaignId === campaignId) loadCharacters();
    });
    socket.on("character:delete", (msg: { campaignId: number }) => {
      if (msg.campaignId === campaignId) loadCharacters();
    });
    return () => {
      socket.disconnect();
    };
  }, [campaignId, loadCharacters]);

  const createCharacter = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCharName.trim()) return;
    const r = await api<{ id: number }>(`/api/campaigns/${campaignId}/characters`, {
      method: "POST",
      body: JSON.stringify({ name: newCharName }),
    });
    navigate(`/campaigns/${campaignId}/characters/${r.id}`);
  };

  const doRoll = useCallback(
    async (body: { formula: string; label: string; mode: string; visibility: string }) => {
      await api(`/api/campaigns/${campaignId}/rolls`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      // The result comes back through the socket like everyone else's rolls.
    },
    [campaignId]
  );

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
  const canRoll = detail.yourRole !== "spectator";

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
        <div className="column">
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
          {canRoll && (
            <section className="card">
              <h3>Roll dice</h3>
              <DicePanel onRoll={doRoll} />
            </section>
          )}
        </div>
        <div className="column">
          <section className="card">
            <h3>Characters</h3>
            <ul className="member-list">
              {characters.map((c) => (
                <li key={c.id} className="row-between">
                  <Link to={`/campaigns/${campaignId}/characters/${c.id}`} className="char-link">
                    <strong>{c.name}</strong>
                    {c.summary && <span className="muted"> · {c.summary}</span>}
                    <span className="muted"> ({c.ownerName})</span>
                  </Link>
                  <span className={c.hp <= 0 ? "hp-pill dead" : c.hp <= c.maxHp / 3 ? "hp-pill hurt" : "hp-pill"}>
                    {c.hp}/{c.maxHp}
                  </span>
                </li>
              ))}
            </ul>
            {canRoll && (
              <form onSubmit={createCharacter} className="row-between new-char">
                <input
                  placeholder="New character name"
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                />
                <button className="ghost">Create</button>
              </form>
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
          <section className="card feed-card">
            <h3>Rolls</h3>
            <RollFeed rolls={rolls} />
          </section>
        </div>
      </main>
    </div>
  );
}

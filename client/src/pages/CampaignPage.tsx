import CampaignThemeBrand from "../components/CampaignThemeBrand";
import CampaignThemePicker from "../components/CampaignThemePicker";
import { useCampaignTheme, type ThemeId } from "../theme";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { api, type ChatMessage, type Member, type RollPayload } from "../api";
import { animateRoll } from "../dice3d";
import type { CharacterSummary } from "../sheet";
import { useAuth } from "../App";
import DiceDock from "../components/DiceDock";
import RollDock from "../components/RollDock";
import AnnouncementCenter from "../components/AnnouncementCenter";
import ChatPanel from "../components/ChatPanel";
import CodexPanel from "../components/CodexPanel";
import RemnantReference from "../components/RemnantReference";
import { Avatar } from "../components/Avatar";

interface CampaignDetail {
  campaign: {
    id: number;
    name: string;
    description: string;
    system: string;
    chapter: string;
    session_number: number;
    house_rules: string;
    announcement: string;
    theme: string;
    created_at: string;
  };
  members: Member[];
  yourRole: string;
}

export default function CampaignPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [editingHub, setEditingHub] = useState(false);
  const [codexRefresh, setCodexRefresh] = useState(0);
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

  const loadDetail = useCallback(
    () =>
      api<CampaignDetail>(`/api/campaigns/${campaignId}`)
        .then(setDetail)
        .catch((e) => setError(e.message)),
    [campaignId]
  );

  useEffect(() => {
    loadDetail();
    api<{ rolls: RollPayload[] }>(`/api/campaigns/${campaignId}/rolls`)
      .then((r) => setRolls(r.rolls))
      .catch(() => {});
    api<{ messages: ChatMessage[] }>(`/api/campaigns/${campaignId}/messages`)
      .then((r) => setMessages(r.messages))
      .catch(() => {});
    loadCharacters();
  }, [campaignId, loadCharacters, loadDetail]);

  useEffect(() => {
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("presence", (p: { campaignId: number; onlineUserIds: number[] }) => {
      if (p.campaignId === campaignId) setOnline(new Set(p.onlineUserIds));
    });
    socket.on("roll", async (roll: RollPayload) => {
      if (roll.campaignId !== campaignId) return;
      // Let the 3D dice land and settle before the number hits the feed —
      // the queue keeps multiple in-flight rolls in arrival order.
      if (roll.detail) await animateRoll(roll.detail, roll.diceTheme, { userName: roll.userName, label: roll.label });
      setRolls((prev) => [...prev.slice(-99), roll]);
    });
    socket.on("character:update", (msg: { campaignId: number }) => {
      if (msg.campaignId === campaignId) loadCharacters();
    });
    socket.on("character:delete", (msg: { campaignId: number }) => {
      if (msg.campaignId === campaignId) loadCharacters();
    });
    socket.on("chat", (msg: ChatMessage) => {
      if (msg.campaignId === campaignId) setMessages((prev) => [...prev.slice(-199), msg]);
    });
    socket.on("campaign:update", (msg: { campaignId: number }) => {
      if (msg.campaignId === campaignId) loadDetail();
    });
    socket.on("codex:update", (msg: { campaignId: number }) => {
      if (msg.campaignId === campaignId) setCodexRefresh((n) => n + 1);
    });
    return () => {
      socket.disconnect();
    };
  }, [campaignId, loadCharacters, loadDetail]);

  const sendChat = useCallback(
    async (body: string, channel: "ic" | "ooc" | "whisper", targetUserId?: number) => {
      await api(`/api/campaigns/${campaignId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body, channel, targetUserId }),
      });
    },
    [campaignId]
  );

  const saveHub = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    const c = detail.campaign;
    await api(`/api/campaigns/${campaignId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: c.name,
        description: c.description,
        chapter: c.chapter,
        sessionNumber: c.session_number,
        houseRules: c.house_rules,
        announcement: c.announcement,
      }),
    });
    setEditingHub(false);
  };

  const patchCampaign = (patch: Partial<CampaignDetail["campaign"]>) =>
    setDetail((prev) => (prev ? { ...prev, campaign: { ...prev.campaign, ...patch } } : prev));

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
    async (body: {
      formula: string;
      label: string;
      mode: string;
      visibility: string;
      manual?: boolean;
      total?: number;
    }) => {
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

  const themeView = useCampaignTheme({
    campaignId,
    userId: user?.id,
    system: detail?.campaign.system,
    campaignTheme: detail?.campaign.theme,
  });
  const updateCampaignTheme = (theme: ThemeId) => patchCampaign({ theme });

  if (error) return <div className="page-center error">{error}</div>;
  if (!detail) return <div className="page-center muted">Loading…</div>;

  const isDM = detail.yourRole === "dm" || detail.yourRole === "co-dm";
  const canRoll = detail.yourRole !== "spectator";

  return (
    <div className="shell campaign-themed" data-system={detail.campaign.system} data-theme={themeView.themeId}>
      <AnnouncementCenter campaignId={campaignId} />
      <header className="topbar campaign-topbar">
        <Link to="/" className="ghost link campaign-back-link">{"\u2190"}</Link>
        <CampaignThemeBrand
          campaignName={detail.campaign.name}
          chapter={detail.campaign.chapter}
          sessionNumber={detail.campaign.session_number}
          themeId={themeView.themeId}
          pageLabel={detail.campaign.system === "remnant" ? "Campaign control" : "Campaign hub"}
        />
        <span className="spacer" />
        <Link to={`/campaigns/${campaignId}`} className="ghost link campaign-nav-link">Dashboard</Link>
        <Link to={`/campaigns/${campaignId}/map`} className="ghost link campaign-nav-link">
          {detail.campaign.system === "remnant" ? "Tactical map" : "Battle map"}
        </Link>
        <Link to={`/campaigns/${campaignId}/bestiary`} className="ghost link campaign-nav-link">
          {detail.campaign.system === "remnant" ? "Grimm archive" : "Bestiary"}
        </Link>
        <CampaignThemePicker
          campaignId={campaignId}
          role={detail.yourRole}
          system={detail.campaign.system}
          campaignTheme={detail.campaign.theme}
          view={themeView}
          onCampaignThemeChange={updateCampaignTheme}
        />
        <span className={`badge role-${detail.yourRole}`}>{detail.yourRole.toUpperCase()}</span>
      </header>
      <main className="content columns">
        <div className="column">
          <section className="card">
            <div className="row-between">
              <h3>{detail.campaign.system === "remnant" ? "Mission control" : "Campaign hub"}</h3>
              <span className="muted hub-meta">
                {detail.campaign.chapter && <>{detail.campaign.chapter} · </>}
                Session {detail.campaign.session_number}
              </span>
            </div>
            {detail.campaign.announcement && !editingHub && (
              <div className="announcement">📣 {detail.campaign.announcement}</div>
            )}
            {!editingHub ? (
              <>
                <p className="muted">{detail.campaign.description || "No description yet."}</p>
                {detail.campaign.house_rules && (
                  <details className="house-rules">
                    <summary>House rules</summary>
                    <p className="muted">{detail.campaign.house_rules}</p>
                  </details>
                )}
                {isDM && (
                  <button className="ghost mini" onClick={() => setEditingHub(true)}>
                    Edit hub
                  </button>
                )}
              </>
            ) : (
              <form onSubmit={saveHub} className="stack">
                <label>
                  Announcement
                  <input
                    value={detail.campaign.announcement}
                    onChange={(e) => patchCampaign({ announcement: e.target.value })}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    rows={2}
                    value={detail.campaign.description}
                    onChange={(e) => patchCampaign({ description: e.target.value })}
                  />
                </label>
                <div className="row-between">
                  <label>
                    Current chapter
                    <input
                      value={detail.campaign.chapter}
                      onChange={(e) => patchCampaign({ chapter: e.target.value })}
                    />
                  </label>
                  <label>
                    Session #
                    <input
                      type="number"
                      value={detail.campaign.session_number}
                      onChange={(e) =>
                        patchCampaign({ session_number: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                  </label>
                </div>
                <label>
                  House rules
                  <textarea
                    rows={3}
                    value={detail.campaign.house_rules}
                    onChange={(e) => patchCampaign({ house_rules: e.target.value })}
                  />
                </label>
                <div className="row-between">
                  <button className="primary">Save hub</button>
                  <button type="button" className="ghost" onClick={() => { setEditingHub(false); loadDetail(); }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {isDM && !editingHub && (
              <div className="stack invite-box">
                <button className="primary" onClick={createInvite}>
                  Create invite link
                </button>
                <a className="ghost link export-link" href={`/api/campaigns/${campaignId}/export`} download>
                  ⬇ Download campaign backup (JSON)
                </a>
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
            <h3>Codex</h3>
            <CodexPanel
              campaignId={campaignId}
              isDM={isDM}
              canWrite={canRoll}
              myId={user?.id ?? 0}
              refreshKey={codexRefresh}
            />
          </section>
          <section className="card">
            <h3>Chat</h3>
            <ChatPanel
              messages={messages}
              members={detail.members}
              myId={user?.id ?? 0}
              canChat={canRoll}
              onSend={sendChat}
            />
          </section>
        </div>
        <div className="column">
          <section className="card">
            <h3>Characters</h3>
            <ul className="member-list">
              {characters.map((c) => {
                const canView = isDM || c.ownerId === user?.id || (c.isNpc && c.playerControllable);
                const label = (
                  <>
                    <strong>{c.name}</strong>
                    {c.isNpc && <span className="badge npc-badge">NPC</span>}
                    {c.summary && <span className="muted"> · {c.summary}</span>}
                    <span className="muted"> ({c.ownerName})</span>
                  </>
                );
                return (
                  <li key={c.id} className="row-between">
                    <span className="avatar">
                      {c.portraitUrl ? <img src={c.portraitUrl} alt="" /> : c.name[0]?.toUpperCase() ?? "?"}
                    </span>
                    {canView ? (
                      <Link to={`/campaigns/${campaignId}/characters/${c.id}`} className="char-link">
                        {label}
                      </Link>
                    ) : (
                      <span className="char-link locked" title="This sheet is private to its player and the DM">
                        {label} <span className="lock">🔒</span>
                      </span>
                    )}
                    <span className={c.hp <= 0 ? "hp-pill dead" : c.hp <= c.maxHp / 3 ? "hp-pill hurt" : "hp-pill"}>
                      {c.hp}/{c.maxHp}
                    </span>
                  </li>
                );
              })}
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
          {detail.campaign.system === "remnant" && (
            <section className="card">
              <h3>Quick reference</h3>
              <RemnantReference />
            </section>
          )}
          <section className="card">
            <h3>Party</h3>
            <ul className="member-list">
              {detail.members.map((m) => (
                <li key={m.id} className="row-between">
                  <span>
                    <span className={online.has(m.id) ? "dot online" : "dot"} />
                    <Avatar name={m.display_name} src={m.avatar_path || undefined} id={m.id} size={22} />
                    {m.display_name}
                  </span>
                  <span className={`badge role-${m.role}`}>{m.role.toUpperCase()}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      {canRoll && <DiceDock onRoll={doRoll} system={detail.campaign.system} defaultOpen />}
      <RollDock rolls={rolls} defaultOpen />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import GridLayout, { WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { api, type ChatMessage, type Member, type RollPayload } from "../api";
import { animateRoll } from "../dice3d";
import type { CharacterSummary } from "../sheet";
import { useAuth } from "../App";
import DiceDock from "../components/DiceDock";
import RollDock from "../components/RollDock";
import { PANEL_BY_ID, availablePanels, type PanelCtx } from "../dashboard/panels";
import {
  GRID_COLS,
  clearLayout,
  defaultLayout,
  loadLayout,
  saveLayout,
  type GridItem,
} from "../dashboard/layouts";

const Grid = WidthProvider(GridLayout);

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
    created_at: string;
  };
  members: Member[];
  yourRole: string;
}

export default function CampaignDashboardPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { user } = useAuth();

  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [online, setOnline] = useState<Set<number>>(new Set());
  const [rolls, setRolls] = useState<RollPayload[]>([]);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [codexRefresh, setCodexRefresh] = useState(0);
  const [error, setError] = useState("");

  const [layout, setLayout] = useState<GridItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const initialized = useRef(false);

  const loadCharacters = useCallback(
    () =>
      api<{ characters: CharacterSummary[] }>(`/api/campaigns/${campaignId}/characters`)
        .then((r) => setCharacters(r.characters))
        .catch(() => {}),
    [campaignId]
  );

  const loadDetail = useCallback(
    () => api<CampaignDetail>(`/api/campaigns/${campaignId}`).then(setDetail).catch((e) => setError(e.message)),
    [campaignId]
  );

  useEffect(() => {
    loadDetail();
    api<{ rolls: RollPayload[] }>(`/api/campaigns/${campaignId}/rolls`).then((r) => setRolls(r.rolls)).catch(() => {});
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
      if (roll.detail) await animateRoll(roll.detail, roll.diceTheme);
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

  const doRoll = useCallback(
    async (body: { formula: string; label: string; mode: string; visibility: string; manual?: boolean; total?: number }) => {
      await api(`/api/campaigns/${campaignId}/rolls`, { method: "POST", body: JSON.stringify(body) });
    },
    [campaignId]
  );

  const sendChat = useCallback(
    async (body: string, channel: "ic" | "ooc" | "whisper", targetUserId?: number) => {
      await api(`/api/campaigns/${campaignId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body, channel, targetUserId }),
      });
    },
    [campaignId]
  );

  // Once we know the viewer's role, load their saved layout or fall back to the
  // role-appropriate default.
  useEffect(() => {
    if (initialized.current || !detail || !user) return;
    initialized.current = true;
    setLayout(loadLayout(campaignId, user.id) ?? defaultLayout(detail.yourRole));
  }, [detail, user, campaignId]);

  const persistLayout = useCallback(
    (next: GridItem[]) => {
      setLayout(next);
      if (user) saveLayout(campaignId, user.id, next);
    },
    [campaignId, user]
  );

  const onLayoutChange = (next: GridItem[]) => {
    if (!initialized.current) return;
    persistLayout(next.map((it) => ({ ...it })));
  };

  const removePanel = (panelId: string) => persistLayout(layout.filter((it) => it.i !== panelId));

  const addPanel = (panelId: string) => {
    const def = PANEL_BY_ID[panelId];
    if (!def || layout.some((it) => it.i === panelId)) return;
    persistLayout([
      ...layout,
      { i: panelId, x: 0, y: Infinity, w: def.defaultW, h: def.defaultH, minW: def.minW, minH: def.minH },
    ]);
    setShowAdd(false);
  };

  const resetLayout = () => {
    if (!user || !detail) return;
    clearLayout(campaignId, user.id);
    setLayout(defaultLayout(detail.yourRole));
  };

  const isDM = detail?.yourRole === "dm" || detail?.yourRole === "co-dm";
  const canWrite = !!detail && detail.yourRole !== "spectator";
  const system = detail?.campaign.system ?? "dnd5e";

  const myCharacterId = useMemo(() => {
    if (!user) return null;
    return characters.find((c) => c.ownerId === user.id)?.id ?? null;
  }, [characters, user]);

  const ctx: PanelCtx | null = useMemo(() => {
    if (!detail || !user) return null;
    return {
      campaignId,
      campaign: detail.campaign,
      system,
      isDM: !!isDM,
      canWrite,
      myId: user.id,
      members: detail.members,
      online,
      characters,
      rolls,
      messages,
      myCharacterId,
      codexRefresh,
      doRoll,
      sendChat,
    };
  }, [detail, user, campaignId, system, isDM, canWrite, online, characters, rolls, messages, myCharacterId, codexRefresh, doRoll, sendChat]);

  if (error) return <div className="page-center error">{error}</div>;
  if (!detail || !ctx) return <div className="page-center muted">Loading…</div>;

  const present = new Set(layout.map((it) => it.i));
  const addable = availablePanels(detail.yourRole, system).filter((p) => !present.has(p.id));

  return (
    <div className="shell dashboard-shell">
      <header className="topbar">
        <Link to="/" className="ghost link">
          ← Campaigns
        </Link>
        <span className="brand">{detail.campaign.name}</span>
        <span className="spacer" />
        <Link to={`/campaigns/${campaignId}/hub`} className="ghost link">
          🏰 Hub
        </Link>
        <Link to={`/campaigns/${campaignId}/map`} className="ghost link">
          🗺️ Map
        </Link>
        <Link to={`/campaigns/${campaignId}/bestiary`} className="ghost link">
          📖 Bestiary
        </Link>
        {editing && (
          <div className="add-panel-wrap">
            <button className="ghost" onClick={() => setShowAdd((s) => !s)} disabled={addable.length === 0}>
              ＋ Panel
            </button>
            {showAdd && (
              <div className="add-panel-menu">
                {addable.map((p) => (
                  <button key={p.id} className="add-panel-item" onClick={() => addPanel(p.id)}>
                    <span>{p.icon}</span> {p.title}
                  </button>
                ))}
                {addable.length === 0 && <span className="muted small">All panels placed.</span>}
              </div>
            )}
          </div>
        )}
        {editing && (
          <button className="ghost" onClick={resetLayout} title="Restore the default layout">
            ↺ Reset
          </button>
        )}
        <button
          className={editing ? "primary" : "ghost"}
          onClick={() => {
            setEditing((e) => !e);
            setShowAdd(false);
          }}
        >
          {editing ? "✓ Done" : "✎ Edit layout"}
        </button>
        <span className={`badge role-${detail.yourRole}`}>{detail.yourRole.toUpperCase()}</span>
      </header>

      <Grid
        className={`dashboard-grid${editing ? " editing" : ""}`}
        layout={layout}
        cols={GRID_COLS}
        rowHeight={28}
        margin={[14, 14]}
        containerPadding={[18, 18]}
        isDraggable={editing}
        isResizable={editing}
        draggableHandle=".panel-drag"
        compactType={null}
        preventCollision
        onLayoutChange={onLayoutChange}
      >
        {layout.map((item) => {
          const def = PANEL_BY_ID[item.i];
          if (!def || (def.system && def.system !== system)) return <div key={item.i} style={{ display: "none" }} />;
          return (
            <div key={item.i} className="panel">
              <div className={`panel-head${editing ? " panel-drag" : ""}`}>
                <span className="panel-title">
                  <span className="panel-icon">{def.icon}</span> {def.title}
                </span>
                {editing && (
                  <button className="panel-remove" title="Remove panel" onClick={() => removePanel(item.i)}>
                    ✕
                  </button>
                )}
              </div>
              <div className="panel-body">{def.render(ctx)}</div>
            </div>
          );
        })}
      </Grid>

      {/* Quick dice + roll notifications, reachable from every campaign screen. */}
      {canWrite && <DiceDock onRoll={doRoll} system={system} />}
      <RollDock rolls={rolls} />
    </div>
  );
}

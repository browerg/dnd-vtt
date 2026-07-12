import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ChatMessage, Member, RollPayload } from "../api";
import type { CharacterSummary } from "../sheet";
import SheetView from "../components/SheetView";
import RollFeed from "../components/RollFeed";
import DicePanel from "../components/DicePanel";
import ChatPanel from "../components/ChatPanel";
import CodexPanel from "../components/CodexPanel";
import RemnantReference from "../components/RemnantReference";

// Shared data + callbacks handed to every panel. The dashboard owns the socket
// and state; panels are thin views over this context.
export interface PanelCtx {
  campaignId: number;
  campaign: {
    name: string;
    description: string;
    announcement: string;
    chapter: string;
    session_number: number;
    system: string;
  };
  system: string;
  isDM: boolean;
  canWrite: boolean;
  myId: number;
  members: Member[];
  online: Set<number>;
  characters: CharacterSummary[];
  rolls: RollPayload[];
  messages: ChatMessage[];
  myCharacterId: number | null;
  codexRefresh: number;
  doRoll: (body: {
    formula: string;
    label: string;
    mode: string;
    visibility: string;
    manual?: boolean;
    total?: number;
  }) => Promise<void>;
  sendChat: (body: string, channel: "ic" | "ooc" | "whisper", targetUserId?: number) => Promise<void>;
}

export interface PanelDef {
  id: string;
  title: string;
  icon: string;
  /** which roles may use this panel; omitted = everyone */
  roles?: string[];
  /** only relevant for certain systems, e.g. quick-ref is remnant-only */
  system?: string;
  minW: number;
  minH: number;
  defaultW: number;
  defaultH: number;
  render: (ctx: PanelCtx) => ReactNode;
}

const hpClass = (hp: number, maxHp: number) =>
  hp <= 0 ? "hp-pill dead" : hp <= maxHp / 3 ? "hp-pill hurt" : "hp-pill";

export const PANELS: PanelDef[] = [
  {
    id: "sheet",
    title: "My character",
    icon: "📋",
    minW: 4,
    minH: 8,
    defaultW: 8,
    defaultH: 18,
    render: (ctx) =>
      ctx.myCharacterId ? (
        <SheetView campaignId={ctx.campaignId} characterId={ctx.myCharacterId} />
      ) : (
        <div className="panel-empty muted">
          <p>You don't have a character in this campaign yet.</p>
          <Link className="ghost link" to={`/campaigns/${ctx.campaignId}/hub`}>
            Create one on the hub →
          </Link>
        </div>
      ),
  },
  {
    id: "dice",
    title: "Dice",
    icon: "🎲",
    minW: 3,
    minH: 6,
    defaultW: 4,
    defaultH: 10,
    render: (ctx) =>
      ctx.canWrite ? (
        <DicePanel onRoll={ctx.doRoll} system={ctx.system} />
      ) : (
        <p className="muted">Spectators can't roll.</p>
      ),
  },
  {
    id: "rolls",
    title: "Roll log",
    icon: "📜",
    minW: 3,
    minH: 5,
    defaultW: 4,
    defaultH: 12,
    render: (ctx) => <RollFeed rolls={ctx.rolls} />,
  },
  {
    id: "party",
    title: "Party",
    icon: "🛡️",
    minW: 2,
    minH: 4,
    defaultW: 3,
    defaultH: 6,
    render: (ctx) => (
      <ul className="member-list">
        {ctx.members.map((m) => (
          <li key={m.id} className="row-between">
            <span>
              <span className={ctx.online.has(m.id) ? "dot online" : "dot"} />
              {m.display_name}
            </span>
            <span className={`badge role-${m.role}`}>{m.role.toUpperCase()}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: "roster",
    title: "Characters",
    icon: "👥",
    minW: 3,
    minH: 4,
    defaultW: 4,
    defaultH: 8,
    render: (ctx) => (
      <ul className="member-list">
        {ctx.characters.map((c) => (
          <li key={c.id} className="row-between">
            <span className="avatar">
              {c.portraitUrl ? <img src={c.portraitUrl} alt="" /> : c.name[0]?.toUpperCase() ?? "?"}
            </span>
            <Link to={`/campaigns/${ctx.campaignId}/characters/${c.id}`} className="char-link">
              <strong>{c.name}</strong>
              {c.summary && <span className="muted"> · {c.summary}</span>}
              <span className="muted"> ({c.ownerName})</span>
            </Link>
            <span className={hpClass(c.hp, c.maxHp)}>
              {c.hp}/{c.maxHp}
            </span>
          </li>
        ))}
        {ctx.characters.length === 0 && <li className="muted">No characters yet.</li>}
      </ul>
    ),
  },
  {
    id: "quickref",
    title: "Quick reference",
    icon: "📖",
    system: "remnant",
    minW: 3,
    minH: 6,
    defaultW: 4,
    defaultH: 12,
    render: () => <RemnantReference />,
  },
  {
    id: "codex",
    title: "Codex",
    icon: "🗂️",
    minW: 4,
    minH: 6,
    defaultW: 6,
    defaultH: 14,
    render: (ctx) => (
      <CodexPanel
        campaignId={ctx.campaignId}
        isDM={ctx.isDM}
        canWrite={ctx.canWrite}
        myId={ctx.myId}
        refreshKey={ctx.codexRefresh}
      />
    ),
  },
  {
    id: "chat",
    title: "Chat",
    icon: "💬",
    minW: 3,
    minH: 6,
    defaultW: 4,
    defaultH: 12,
    render: (ctx) => (
      <ChatPanel
        messages={ctx.messages}
        members={ctx.members}
        myId={ctx.myId}
        canChat={ctx.canWrite}
        onSend={ctx.sendChat}
      />
    ),
  },
  {
    id: "hub",
    title: "Campaign",
    icon: "🏰",
    minW: 3,
    minH: 4,
    defaultW: 4,
    defaultH: 7,
    render: (ctx) => (
      <div className="stack">
        {ctx.campaign.announcement && <div className="announcement">📣 {ctx.campaign.announcement}</div>}
        <span className="muted hub-meta">
          {ctx.campaign.chapter && <>{ctx.campaign.chapter} · </>}
          Session {ctx.campaign.session_number}
        </span>
        <p className="muted">{ctx.campaign.description || "No description yet."}</p>
        <Link className="ghost link" to={`/campaigns/${ctx.campaignId}/hub`}>
          Open full hub (invites, export, edit) →
        </Link>
      </div>
    ),
  },
];

export const PANEL_BY_ID = Object.fromEntries(PANELS.map((p) => [p.id, p]));

// Panels a given viewer is allowed to place, given their role and the system.
export function availablePanels(role: string, system: string): PanelDef[] {
  const isDM = role === "dm" || role === "co-dm";
  return PANELS.filter((p) => {
    if (p.system && p.system !== system) return false;
    if (p.roles && !p.roles.includes(isDM ? "dm" : role)) return false;
    return true;
  });
}

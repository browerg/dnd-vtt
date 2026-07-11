import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { api } from "../api";
import { useAuth } from "../App";
import type { CharacterSummary } from "../sheet";

interface MapInfo {
  id: number;
  campaignId: number;
  name: string;
  imageUrl: string;
  isVideo: boolean;
  youtubeId: string;
  gridSize: number;
  gridOn: boolean;
  active: boolean;
  fogOn: boolean;
  fogCells: string[];
}

interface Combatant {
  id: number;
  tokenId: number | null;
  name: string;
  initiative: number;
}

interface CombatState {
  active: boolean;
  round: number;
  turn: number;
  combatants: Combatant[];
}

type Tool = "move" | "reveal" | "hide" | "ruler";

interface RulerLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Token {
  id: number;
  mapId: number;
  characterId: number | null;
  monsterId: number | null;
  ownerId: number | null;
  name: string;
  color: string;
  x: number;
  y: number;
  size: number;
  hp: number | null;
  maxHp: number | null;
  aura: number | null;
  auraMax: number | null;
}

interface MonsterHit {
  id: number;
  name: string;
  system?: string;
  cr: number;
  type: string;
  size: string;
  hp: number;
  ac: number;
  threat?: number;
  armor?: number;
}

interface MonsterDetail {
  id: number;
  name: string;
  cr: number;
  size: string;
  type: string;
  armor_class: number;
  hit_points: number;
  hit_dice: string;
  speed: Record<string, number | boolean>;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  senses: string;
  languages: string;
  special_abilities: { name: string; desc: string }[] | null;
  actions: { name: string; desc: string; attack_bonus?: number; damage_dice?: string; damage_bonus?: number }[] | null;
  // Remnant Grimm shape
  system?: string;
  threat?: number;
  ferocity?: number;
  armor?: number;
  traits?: { name: string; desc: string }[];
}

interface Ping {
  key: number;
  x: number;
  y: number;
  userName: string;
}

interface View {
  x: number;
  y: number;
  scale: number;
}

export default function MapPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { user } = useAuth();

  const [map, setMap] = useState<MapInfo | null>(null);
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [role, setRole] = useState("");
  const [system, setSystem] = useState("dnd5e");
  const [ruler, setRuler] = useState<RulerLine | null>(null);
  const [remoteRulers, setRemoteRulers] = useState<Record<string, RulerLine>>({});
  const rulerTimers = useRef<Record<string, number>>({});
  const rulerEmit = useRef(0);
  const [pings, setPings] = useState<Ping[]>([]);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 0.8 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [customName, setCustomName] = useState("");
  const [customColor, setCustomColor] = useState("#b04545");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [tool, setTool] = useState<Tool>("move");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [combat, setCombat] = useState<CombatState>({ active: false, round: 0, turn: 0, combatants: [] });
  const [combatantPick, setCombatantPick] = useState("");
  const [monsterQuery, setMonsterQuery] = useState("");
  const [monsterHits, setMonsterHits] = useState<MonsterHit[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [statblock, setStatblock] = useState<MonsterDetail | null>(null);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const fogSaveTimer = useRef<number>();

  const socketRef = useRef<Socket | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const dragRef = useRef<
    | { kind: "pan"; startX: number; startY: number; viewX: number; viewY: number; moved: boolean }
    | { kind: "token"; tokenId: number; offsetX: number; offsetY: number; moved: boolean }
    | { kind: "fog"; reveal: boolean }
    | { kind: "ruler" }
    | null
  >(null);
  const lastEmit = useRef(0);
  const pingKey = useRef(0);

  const isDM = role === "dm" || role === "co-dm";

  const loadAll = useCallback(async () => {
    try {
      const [active, list, detail, chars, combatRes] = await Promise.all([
        api<{ map: MapInfo | null; tokens: Token[] }>(`/api/campaigns/${campaignId}/maps/active`),
        api<{ maps: MapInfo[] }>(`/api/campaigns/${campaignId}/maps`),
        api<{ yourRole: string; campaign: { system: string } }>(`/api/campaigns/${campaignId}`),
        api<{ characters: CharacterSummary[] }>(`/api/campaigns/${campaignId}/characters`),
        api<{ state: CombatState }>(`/api/campaigns/${campaignId}/combat`),
      ]);
      setMap(active.map);
      setTokens(active.tokens);
      setMaps(list.maps);
      setRole(detail.yourRole);
      setSystem(detail.campaign.system);
      setCharacters(chars.characters);
      setCombat(combatRes.state);
      setRevealed(new Set(active.map?.fogCells ?? []));
      setLoaded(true);
    } catch (e: any) {
      setError(e.message);
    }
  }, [campaignId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // YouTube embeds are cross-origin, so we can't read their intrinsic size —
  // treat them as a fixed 16:9 stage that the grid and fog draw over.
  useEffect(() => {
    if (map?.youtubeId) setImgSize({ w: 1920, h: 1080 });
  }, [map?.id, map?.youtubeId]);

  // Monster search (debounced).
  useEffect(() => {
    if (!monsterQuery.trim()) {
      setMonsterHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      api<{ monsters: MonsterHit[] }>(
        `/api/monsters?campaignId=${campaignId}&q=${encodeURIComponent(monsterQuery)}`
      )
        .then((r) => setMonsterHits(r.monsters))
        .catch(() => {});
    }, 250);
    return () => window.clearTimeout(t);
  }, [monsterQuery]);

  // Stat block for the selected monster token.
  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null;
  useEffect(() => {
    if (!selectedToken?.monsterId) {
      setStatblock(null);
      return;
    }
    let stale = false;
    api<{ monster: MonsterDetail }>(`/api/monsters/${selectedToken.monsterId}`)
      .then((r) => !stale && setStatblock(r.monster))
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [selectedToken?.monsterId]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("map:update", (m: { campaignId: number }) => {
      if (m.campaignId === campaignId) loadAll();
    });
    socket.on("token:create", (m: { campaignId: number; token: Token }) => {
      if (m.campaignId === campaignId) setTokens((prev) => [...prev.filter((t) => t.id !== m.token.id), m.token]);
    });
    socket.on("token:update", (m: { campaignId: number; token: Token }) => {
      if (m.campaignId !== campaignId) return;
      // Ignore echoes of a token we're mid-drag on; our pointer is the truth.
      const d = dragRef.current;
      if (d?.kind === "token" && d.tokenId === m.token.id) return;
      setTokens((prev) => prev.map((t) => (t.id === m.token.id ? m.token : t)));
    });
    socket.on("token:delete", (m: { campaignId: number; tokenId: number }) => {
      if (m.campaignId === campaignId) setTokens((prev) => prev.filter((t) => t.id !== m.tokenId));
    });
    socket.on("character:update", () => loadAll());
    socket.on("combat:update", (m: { campaignId: number; state: CombatState }) => {
      if (m.campaignId === campaignId) setCombat(m.state);
    });
    socket.on(
      "fog:update",
      (m: { campaignId: number; mapId: number; fogOn: boolean; fogCells: string[] }) => {
        if (m.campaignId !== campaignId) return;
        setMap((prev) => (prev && prev.id === m.mapId ? { ...prev, fogOn: m.fogOn } : prev));
        setRevealed(new Set(m.fogCells));
      }
    );
    socket.on("map:ping", (m: { campaignId: number; x: number; y: number; userName: string }) => {
      if (m.campaignId !== campaignId) return;
      const ping: Ping = { key: ++pingKey.current, x: m.x, y: m.y, userName: m.userName };
      setPings((prev) => [...prev, ping]);
      setTimeout(() => setPings((prev) => prev.filter((p) => p.key !== ping.key)), 2200);
    });
    socket.on(
      "map:ruler",
      (m: { campaignId: number; x1: number; y1: number; x2: number; y2: number; active: boolean; userName: string }) => {
        if (m.campaignId !== campaignId) return;
        window.clearTimeout(rulerTimers.current[m.userName]);
        const drop = () =>
          setRemoteRulers((prev) => {
            const next = { ...prev };
            delete next[m.userName];
            return next;
          });
        if (!m.active) return drop();
        setRemoteRulers((prev) => ({ ...prev, [m.userName]: { x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2 } }));
        // Safety net: if the sender vanishes mid-drag, don't leave a ghost tape.
        rulerTimers.current[m.userName] = window.setTimeout(drop, 4000);
      }
    );
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [campaignId, loadAll]);

  // ---- coordinate helpers ----
  const toMapCoords = (clientX: number, clientY: number) => {
    const rect = viewportRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.scale, y: (clientY - rect.top - v.y) / v.scale };
  };

  const canMove = (t: Token) => isDM || (t.ownerId !== null && t.ownerId === user?.id);

  // ---- fog helpers ----
  const pushFog = useCallback(
    (cells: Set<string>) => {
      if (!map) return;
      window.clearTimeout(fogSaveTimer.current);
      fogSaveTimer.current = window.setTimeout(() => {
        api(`/api/campaigns/${campaignId}/maps/${map.id}/fog`, {
          method: "PUT",
          body: JSON.stringify({ cells: [...cells] }),
        }).catch(() => {});
      }, 350);
    },
    [campaignId, map]
  );

  const paintFog = (clientX: number, clientY: number, reveal: boolean) => {
    if (!map) return;
    const p = toMapCoords(clientX, clientY);
    const g = map.gridSize;
    const key = `${Math.floor(p.x / g)},${Math.floor(p.y / g)}`;
    setRevealed((prev) => {
      if (prev.has(key) === reveal) return prev;
      const next = new Set(prev);
      if (reveal) next.add(key);
      else next.delete(key);
      pushFog(next);
      return next;
    });
  };

  const setFog = (body: Record<string, unknown>) =>
    map &&
    api(`/api/campaigns/${campaignId}/maps/${map.id}/fog`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

  const revealAll = () => {
    if (!map || imgSize.w === 0) return;
    const g = map.gridSize;
    const all = new Set<string>();
    for (let cx = 0; cx < Math.ceil(imgSize.w / g); cx++)
      for (let cy = 0; cy < Math.ceil(imgSize.h / g); cy++) all.add(`${cx},${cy}`);
    setRevealed(all);
    setFog({ cells: [...all] });
  };

  const hideAll = () => {
    setRevealed(new Set());
    setFog({ cells: [] });
  };

  // ---- pointer handlers ----
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // stale/unknown pointer id — capture is best-effort, dragging still works
    }
    if (tool === "ruler") {
      const p = toMapCoords(e.clientX, e.clientY);
      dragRef.current = { kind: "ruler" };
      setRuler({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }
    if (isDM && tool !== "move" && map?.fogOn) {
      dragRef.current = { kind: "fog", reveal: tool === "reveal" };
      paintFog(e.clientX, e.clientY, tool === "reveal");
      return;
    }
    const tokenEl = (e.target as Element).closest("[data-token-id]");
    if (tokenEl) {
      const tokenId = Number(tokenEl.getAttribute("data-token-id"));
      const token = tokens.find((t) => t.id === tokenId);
      if (token && canMove(token)) {
        const p = toMapCoords(e.clientX, e.clientY);
        dragRef.current = {
          kind: "token",
          tokenId,
          offsetX: p.x - token.x,
          offsetY: p.y - token.y,
          moved: false,
        };
        return;
      }
    }
    dragRef.current = {
      kind: "pan",
      startX: e.clientX,
      startY: e.clientY,
      viewX: view.x,
      viewY: view.y,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === "ruler") {
      const p = toMapCoords(e.clientX, e.clientY);
      setRuler((prev) => (prev ? { ...prev, x2: p.x, y2: p.y } : prev));
      const now = performance.now();
      if (now - rulerEmit.current > 50) {
        rulerEmit.current = now;
        setRuler((prev) => {
          if (prev) socketRef.current?.emit("map:ruler", { campaignId, ...prev, active: true });
          return prev;
        });
      }
      return;
    }
    if (d.kind === "fog") {
      paintFog(e.clientX, e.clientY, d.reveal);
      return;
    }
    if (d.kind === "pan") {
      if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 3) d.moved = true;
      setView((v) => ({ ...v, x: d.viewX + e.clientX - d.startX, y: d.viewY + e.clientY - d.startY }));
      return;
    }
    d.moved = true;
    const p = toMapCoords(e.clientX, e.clientY);
    const x = p.x - d.offsetX;
    const y = p.y - d.offsetY;
    setTokens((prev) => prev.map((t) => (t.id === d.tokenId ? { ...t, x, y } : t)));
    const now = performance.now();
    if (now - lastEmit.current > 50) {
      lastEmit.current = now;
      socketRef.current?.emit("token:move", { campaignId, tokenId: d.tokenId, x, y });
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.kind === "ruler") {
      setRuler(null);
      socketRef.current?.emit("map:ruler", { campaignId, x1: 0, y1: 0, x2: 0, y2: 0, active: false });
      return;
    }
    if (d?.kind === "pan" && !d.moved) setSelectedTokenId(null);
    if (!d || d.kind !== "token" || !map) return;
    if (!d.moved) {
      setSelectedTokenId(d.tokenId);
      return;
    }
    setTokens((prev) =>
      prev.map((t) => {
        if (t.id !== d.tokenId) return t;
        let { x, y } = t;
        if (map.gridOn && d.moved) {
          // Snap the token's top-left corner to the nearest cell.
          const g = map.gridSize;
          const half = (t.size * g) / 2;
          x = Math.round((t.x - half) / g) * g + half;
          y = Math.round((t.y - half) / g) * g + half;
        }
        socketRef.current?.emit("token:move", { campaignId, tokenId: t.id, x, y });
        return { ...t, x, y };
      })
    );
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = viewportRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setView((v) => {
      const scale = Math.min(3, Math.max(0.15, v.scale * (e.deltaY < 0 ? 1.12 : 0.89)));
      const k = scale / v.scale;
      return { scale, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k };
    });
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const p = toMapCoords(e.clientX, e.clientY);
    socketRef.current?.emit("map:ping", { campaignId, x: p.x, y: p.y });
  };

  // ---- DM actions ----
  const uploadMap = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const file = (form.elements.namedItem("image") as HTMLInputElement).files?.[0];
    const name = (form.elements.namedItem("mapname") as HTMLInputElement).value;
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);
    fd.append("name", name || file.name.replace(/\.[^.]+$/, ""));
    setError("");
    const res = await fetch(`/api/campaigns/${campaignId}/maps`, { method: "POST", body: fd });
    if (!res.ok) setError((await res.json()).error ?? "Upload failed");
    form.reset();
  };

  const patchMap = (body: Record<string, unknown>) =>
    map && api(`/api/campaigns/${campaignId}/maps/${map.id}`, { method: "PUT", body: JSON.stringify(body) });

  const placeCharacter = async (characterId: number) => {
    if (!map) return;
    setError("");
    try {
      await api(`/api/campaigns/${campaignId}/maps/${map.id}/tokens`, {
        method: "POST",
        body: JSON.stringify({ characterId }),
      });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const placeCustom = async (e: FormEvent) => {
    e.preventDefault();
    if (!map || !customName.trim()) return;
    await api(`/api/campaigns/${campaignId}/maps/${map.id}/tokens`, {
      method: "POST",
      body: JSON.stringify({ name: customName, color: customColor }),
    });
    setCustomName("");
  };

  const removeToken = (tokenId: number) =>
    map && api(`/api/campaigns/${campaignId}/maps/${map.id}/tokens/${tokenId}`, { method: "DELETE" });

  const spawnMonster = async (monsterId: number) => {
    if (!map) return;
    setError("");
    try {
      await api(`/api/campaigns/${campaignId}/maps/${map.id}/tokens`, {
        method: "POST",
        body: JSON.stringify({ monsterId }),
      });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const rollDice = (formula: string, label: string) =>
    api(`/api/campaigns/${campaignId}/rolls`, {
      method: "POST",
      body: JSON.stringify({ formula, label, mode: "normal", visibility: "public" }),
    }).catch((e: any) => setError(e.message));

  const setTokenHp = (token: Token, hp: number) =>
    map &&
    api(`/api/campaigns/${campaignId}/maps/${map.id}/tokens/${token.id}/hp`, {
      method: "PUT",
      body: JSON.stringify({ hp }),
    }).catch((e: any) => setError(e.message));

  const mod = (score: number) => Math.floor((score - 10) / 2);
  const fmtMod = (m: number) => (m >= 0 ? `+${m}` : `${m}`);
  const fmtCr = (cr: number) => ({ 0.125: "1/8", 0.25: "1/4", 0.5: "1/2" }[cr] ?? `${cr}`);

  const hpEditor = (token: Token) => (
    <span className="hp-editor">
      HP{" "}
      <button className="ghost mini" onClick={() => setTokenHp(token, (token.hp ?? 0) - 5)}>
        -5
      </button>
      <button className="ghost mini" onClick={() => setTokenHp(token, (token.hp ?? 0) - 1)}>
        -1
      </button>
      <strong>
        {token.hp}/{token.maxHp}
      </strong>
      <button className="ghost mini" onClick={() => setTokenHp(token, (token.hp ?? 0) + 1)}>
        +1
      </button>
      <button className="ghost mini" onClick={() => setTokenHp(token, (token.hp ?? 0) + 5)}>
        +5
      </button>
    </span>
  );

  if (error && !loaded) return <div className="page-center error">{error}</div>;
  if (!loaded) return <div className="page-center muted">Loading…</div>;

  const g = map?.gridSize ?? 70;
  const currentCombatant = combat.active ? combat.combatants[combat.turn] : undefined;

  // Distance in grid squares; Remnant reads it as a range band, 5e as feet.
  const rulerLabel = (r: RulerLine) => {
    const cells = Math.hypot(r.x2 - r.x1, r.y2 - r.y1) / g;
    if (system === "remnant") {
      const band = cells <= 2 ? "Close" : cells <= 10 ? "Mid" : cells <= 24 ? "Long" : "Extreme";
      return `${band} · ${cells.toFixed(1)} sq`;
    }
    return `${Math.round(cells * 5)} ft · ${cells.toFixed(1)} sq`;
  };
  const activeRulers = (ruler ? [{ name: "", r: ruler }] : []).concat(
    Object.entries(remoteRulers).map(([name, r]) => ({ name, r }))
  );

  let fogPath = "";
  if (map?.fogOn && imgSize.w > 0) {
    const cols = Math.ceil(imgSize.w / g);
    const rows = Math.ceil(imgSize.h / g);
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if (!revealed.has(`${cx},${cy}`)) fogPath += `M${cx * g} ${cy * g}h${g}v${g}h${-g}z`;
      }
    }
  }

  return (
    <div className="shell map-shell">
      <header className="topbar">
        <Link to={`/campaigns/${campaignId}`} className="ghost link">
          ← Campaign
        </Link>
        <span className="brand">{map ? map.name : "Battle map"}</span>
        <span className="spacer" />
        {map && (
          <button
            className={tool === "ruler" ? "ghost mini active-tool" : "ghost mini"}
            title="Measure distance — drag across the map"
            onClick={() => setTool(tool === "ruler" ? "move" : "ruler")}
          >
            📏 Ruler
          </button>
        )}
        {isDM && map && (
          <>
            <label className="grid-toggle">
              <input
                type="checkbox"
                checked={map.fogOn}
                onChange={(e) => {
                  setMap((prev) => (prev ? { ...prev, fogOn: e.target.checked } : prev));
                  setFog({ fogOn: e.target.checked });
                }}
              />
              Fog
            </label>
            {map.fogOn && (
              <div className="seg" role="group" aria-label="Fog tool">
                {(["move", "reveal", "hide"] as Tool[]).map((t) => (
                  <button
                    key={t}
                    className={tool === t ? "seg-btn active" : "seg-btn"}
                    onClick={() => setTool(t)}
                  >
                    {t === "move" ? "Move" : t === "reveal" ? "Reveal" : "Hide"}
                  </button>
                ))}
              </div>
            )}
            {map.fogOn && (
              <>
                <button className="ghost mini" onClick={revealAll}>
                  Reveal all
                </button>
                <button className="ghost mini" onClick={hideAll}>
                  Hide all
                </button>
              </>
            )}
            <label className="grid-toggle">
              <input type="checkbox" checked={map.gridOn} onChange={(e) => patchMap({ gridOn: e.target.checked })} />
              Grid
            </label>
            <input
              className="grid-size"
              type="number"
              title="Grid cell size (px)"
              value={map.gridSize}
              onChange={(e) => {
                const gridSize = parseInt(e.target.value, 10);
                if (gridSize >= 10) patchMap({ gridSize });
              }}
            />
            <select
              value={map.id}
              onChange={(e) =>
                api(`/api/campaigns/${campaignId}/maps/${e.target.value}`, {
                  method: "PUT",
                  body: JSON.stringify({ active: true }),
                })
              }
            >
              {maps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </>
        )}
        <span className="muted zoom-label">{Math.round(view.scale * 100)}%</span>
      </header>

      <div className="map-layout">
        <div
          ref={viewportRef}
          className="map-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onWheel={onWheel}
          onDoubleClick={onDoubleClick}
        >
          {!map ? (
            <div className="page-center muted">
              {isDM ? "Upload a map to get started →" : "The DM hasn't set a map yet."}
            </div>
          ) : (
            <div
              className="map-world"
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            >
              {map.youtubeId ? (
                <div className="yt-stage" style={{ width: 1920, height: 1080 }}>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${map.youtubeId}?autoplay=1&mute=1&loop=1&playlist=${map.youtubeId}&controls=0&rel=0&playsinline=1&modestbranding=1`}
                    title={map.name}
                    allow="autoplay; encrypted-media"
                    allowFullScreen={false}
                  />
                </div>
              ) : map.isVideo ? (
                <video
                  src={map.imageUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  onLoadedMetadata={(e) =>
                    setImgSize({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })
                  }
                />
              ) : (
                <img
                  src={map.imageUrl}
                  alt={map.name}
                  draggable={false}
                  onLoad={(e) =>
                    setImgSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
                  }
                />
              )}
              {map.gridOn && imgSize.w > 0 && (
                <svg className="grid-overlay" width={imgSize.w} height={imgSize.h}>
                  <defs>
                    <pattern id="grid" width={g} height={g} patternUnits="userSpaceOnUse">
                      <path d={`M ${g} 0 L 0 0 0 ${g}`} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              )}
              {tokens.map((t) => {
                const px = t.size * g;
                return (
                  <div
                    key={t.id}
                    data-token-id={t.id}
                    className={`token${canMove(t) ? " movable" : ""}${
                      currentCombatant?.tokenId === t.id ? " current-turn" : ""
                    }${selectedTokenId === t.id ? " selected" : ""}`}
                    style={{
                      left: t.x - px / 2,
                      top: t.y - px / 2,
                      width: px,
                      height: px,
                      background: t.color,
                    }}
                    title={t.name}
                  >
                    <span className="token-initials">
                      {t.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                    <span className="token-name">{t.name}</span>
                    {t.auraMax != null && t.aura != null && (
                      <span className="token-aura">
                        <span
                          className="token-aura-fill"
                          style={{
                            width: `${Math.max(0, Math.min(100, (t.aura / Math.max(1, t.auraMax)) * 100))}%`,
                          }}
                        />
                      </span>
                    )}
                    {t.maxHp != null && t.hp != null && (
                      <span className="token-hp">
                        <span
                          className="token-hp-fill"
                          style={{
                            width: `${Math.max(0, Math.min(100, (t.hp / Math.max(1, t.maxHp)) * 100))}%`,
                          }}
                        />
                      </span>
                    )}
                  </div>
                );
              })}
              {map.fogOn && fogPath && (
                <svg className="fog-overlay" width={imgSize.w} height={imgSize.h}>
                  <path d={fogPath} fill={isDM ? "rgba(8,6,14,0.45)" : "rgba(8,6,14,0.97)"} />
                </svg>
              )}
              {pings.map((p) => (
                <div key={p.key} className="ping" style={{ left: p.x, top: p.y }}>
                  <span className="ping-ring" />
                  <span className="ping-name">{p.userName}</span>
                </div>
              ))}
              {activeRulers.map(({ name, r }) => (
                <div key={name || "you"}>
                  <svg className="ruler-svg" width={imgSize.w || 1920} height={imgSize.h || 1080}>
                    <line className={`ruler-stroke${name ? " remote" : ""}`} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
                    <circle className="ruler-dot" cx={r.x1} cy={r.y1} r={5} />
                    <circle className="ruler-dot" cx={r.x2} cy={r.y2} r={5} />
                  </svg>
                  <span className="ruler-label" style={{ left: (r.x1 + r.x2) / 2, top: (r.y1 + r.y2) / 2 }}>
                    {rulerLabel(r)}
                    {name && <span className="ruler-user"> · {name}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="map-sidebar">
          {error && <div className="error">{error}</div>}
          {isDM && selectedToken && statblock && (
            <section className="statblock">
              <div className="row-between">
                <h4>{selectedToken.name}</h4>
                <button className="ghost mini" onClick={() => setSelectedTokenId(null)}>
                  ✕
                </button>
              </div>
              {statblock.system === "remnant" ? (
                <>
                  <p className="muted small">
                    {statblock.size} {statblock.type} · Threat {statblock.threat}
                  </p>
                  <div className="row-between statline">
                    <span>
                      Armor <strong>{statblock.armor}</strong>
                    </span>
                    {hpEditor(selectedToken)}
                  </div>
                  <div className="row-between statline">
                    <span>
                      Ferocity <strong>d{statblock.ferocity}</strong>
                    </span>
                    <span className="action-rolls">
                      <button
                        className="ghost mini"
                        onClick={() =>
                          rollDice(`2d10+1d${statblock.ferocity}`, `${selectedToken.name}: Attack`)
                        }
                      >
                        attack 2d10+1d{statblock.ferocity}
                      </button>
                      <button
                        className="ghost mini"
                        onClick={() => rollDice(`1d${statblock.ferocity}`, `${selectedToken.name}: Damage`)}
                      >
                        dmg 1d{statblock.ferocity}
                      </button>
                    </span>
                  </div>
                  {(statblock.traits ?? []).map((a) => (
                    <details key={a.name} className="mon-ability">
                      <summary>{a.name}</summary>
                      <p className="muted small">{a.desc}</p>
                    </details>
                  ))}
                </>
              ) : (
                <>
              <p className="muted small">
                {statblock.size} {statblock.type} · CR {fmtCr(statblock.cr)}
              </p>
              <div className="row-between statline">
                <span>
                  AC <strong>{statblock.armor_class}</strong>
                </span>
                {hpEditor(selectedToken)}
              </div>
              <p className="muted small">
                {["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]
                  .map(
                    (k, i) =>
                      `${["STR", "DEX", "CON", "INT", "WIS", "CHA"][i]} ${fmtMod(mod((statblock as any)[k]))}`
                  )
                  .join(" · ")}
              </p>
              {(statblock.special_abilities ?? []).map((a) => (
                <details key={a.name} className="mon-ability">
                  <summary>{a.name}</summary>
                  <p className="muted small">{a.desc}</p>
                </details>
              ))}
              {(statblock.actions ?? []).map((a) => (
                <div key={a.name} className="mon-action">
                  <div className="row-between">
                    <strong className="small">{a.name}</strong>
                    <span className="action-rolls">
                      {a.attack_bonus != null && (
                        <button
                          className="ghost mini"
                          onClick={() =>
                            rollDice(`1d20+${a.attack_bonus}`, `${selectedToken.name}: ${a.name} (to hit)`)
                          }
                        >
                          hit {fmtMod(a.attack_bonus)}
                        </button>
                      )}
                      {a.damage_dice && (
                        <button
                          className="ghost mini"
                          onClick={() =>
                            rollDice(
                              `${a.damage_dice}${a.damage_bonus ? `+${a.damage_bonus}` : ""}`,
                              `${selectedToken.name}: ${a.name} damage`
                            )
                          }
                        >
                          dmg {a.damage_dice}
                          {a.damage_bonus ? `+${a.damage_bonus}` : ""}
                        </button>
                      )}
                    </span>
                  </div>
                  <details className="mon-ability">
                    <summary className="muted small">details</summary>
                    <p className="muted small">{a.desc}</p>
                  </details>
                </div>
              ))}
                </>
              )}
            </section>
          )}
          <section>
            <h4>{combat.active ? `Combat — round ${combat.round}` : "Initiative"}</h4>
            {combat.combatants.map((c, i) => (
              <div
                key={c.id}
                className={`row-between sidebar-row${combat.active && i === combat.turn ? " current-row" : ""}`}
              >
                <span>
                  {combat.active && i === combat.turn ? "▶ " : ""}
                  {c.name}
                </span>
                <span className="init-badge">
                  {c.initiative}
                  {isDM && (
                    <button
                      className="ghost mini"
                      title="Remove"
                      onClick={() =>
                        api(`/api/campaigns/${campaignId}/combat/combatants/${c.id}`, { method: "DELETE" })
                      }
                    >
                      ✕
                    </button>
                  )}
                </span>
              </div>
            ))}
            {combat.combatants.length === 0 && <p className="muted small">No combatants yet.</p>}
            {isDM && (
              <div className="stack combat-controls">
                {!combat.active ? (
                  <>
                    <div className="row-between">
                      <select value={combatantPick} onChange={(e) => setCombatantPick(e.target.value)}>
                        <option value="">Add from map…</option>
                        {tokens
                          .filter((t) => !combat.combatants.some((c) => c.tokenId === t.id))
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                      <button
                        className="ghost mini"
                        disabled={!combatantPick}
                        onClick={async () => {
                          setError("");
                          try {
                            await api(`/api/campaigns/${campaignId}/combat/combatants`, {
                              method: "POST",
                              body: JSON.stringify({ tokenId: Number(combatantPick) }),
                            });
                            setCombatantPick("");
                          } catch (e: any) {
                            setError(e.message);
                          }
                        }}
                      >
                        Roll & add
                      </button>
                    </div>
                    {combat.combatants.length > 0 && (
                      <button
                        className="primary"
                        onClick={() => api(`/api/campaigns/${campaignId}/combat/start`, { method: "POST" })}
                      >
                        ⚔️ Start combat
                      </button>
                    )}
                  </>
                ) : (
                  <div className="row-between">
                    <button
                      className="primary"
                      onClick={() => api(`/api/campaigns/${campaignId}/combat/next`, { method: "POST" })}
                    >
                      Next turn →
                    </button>
                    <button
                      className="ghost"
                      onClick={() => api(`/api/campaigns/${campaignId}/combat/end`, { method: "POST" })}
                    >
                      End
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
          <section>
            <h4>Characters</h4>
            {characters.map((c) => {
              const onMap = tokens.some((t) => t.characterId === c.id);
              const mine = c.ownerId === user?.id;
              return (
                <div key={c.id} className="row-between sidebar-row">
                  <span className={onMap ? "" : "muted"}>{c.name}</span>
                  {map && (isDM || mine) && !onMap && (
                    <button className="ghost mini" onClick={() => placeCharacter(c.id)}>
                      Place
                    </button>
                  )}
                </div>
              );
            })}
          </section>
          <section>
            <h4>Tokens on map</h4>
            {tokens.map((t) => (
              <div key={t.id} className="row-between sidebar-row">
                <span>
                  <span className="swatch" style={{ background: t.color }} />
                  {t.name}
                </span>
                {(isDM || canMove(t)) && (
                  <button className="ghost mini" onClick={() => removeToken(t.id)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </section>
          {isDM && (
            <>
              <section>
                <h4>Maps</h4>
                {maps.map((m) => (
                  <div key={m.id} className="row-between sidebar-row">
                    <button
                      className={`map-pick${m.active ? " active" : ""}`}
                      onClick={() =>
                        !m.active &&
                        api(`/api/campaigns/${campaignId}/maps/${m.id}`, {
                          method: "PUT",
                          body: JSON.stringify({ active: true }),
                        })
                      }
                    >
                      {m.active ? "▶ " : ""}
                      {m.name}
                      {m.youtubeId ? " ▶️" : m.isVideo ? " 🎞️" : ""}
                    </button>
                    <button
                      className="ghost mini"
                      title="Delete map"
                      onClick={async () => {
                        if (!window.confirm(`Delete "${m.name}"? Its tokens and fog go with it.`)) return;
                        setError("");
                        try {
                          await api(`/api/campaigns/${campaignId}/maps/${m.id}`, { method: "DELETE" });
                        } catch (e: any) {
                          setError(e.message);
                        }
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </section>
              {map && (
                <section>
                  <h4>Monsters</h4>
                  <input
                    placeholder="Search monsters (SRD + custom)…"
                    value={monsterQuery}
                    onChange={(e) => setMonsterQuery(e.target.value)}
                  />
                  <Link to={`/campaigns/${campaignId}/bestiary`} className="muted small">
                    Open bestiary — create &amp; edit monsters
                  </Link>
                  <div className="monster-hits">
                    {monsterHits.map((m) => (
                      <div key={m.id} className="row-between sidebar-row">
                        <span className="mon-hit">
                          {m.name}{" "}
                          <span className="muted">
                            {m.system === "remnant" ? `Threat ${m.threat}` : `CR ${fmtCr(m.cr)}`}
                          </span>
                        </span>
                        <button className="ghost mini" onClick={() => spawnMonster(m.id)}>
                          Spawn
                        </button>
                      </div>
                    ))}
                    {monsterQuery.trim() && monsterHits.length === 0 && (
                      <p className="muted small">No monsters match.</p>
                    )}
                  </div>
                </section>
              )}
              {map && (
                <section>
                  <h4>Custom token</h4>
                  <form onSubmit={placeCustom} className="stack">
                    <div className="row-between">
                      <input
                        placeholder="Goblin, chest, door…"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                      />
                      <input
                        type="color"
                        className="color-pick"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                      />
                    </div>
                    <button className="ghost">Place token</button>
                  </form>
                </section>
              )}
              <section>
                <h4>Upload map</h4>
                <form onSubmit={uploadMap} className="stack">
                  <input name="mapname" placeholder="Map name" />
                  <input
                    name="image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                    required
                  />
                  <button className="ghost">Upload</button>
                </form>
                <form
                  className="stack yt-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const url = (form.elements.namedItem("yturl") as HTMLInputElement).value;
                    setError("");
                    try {
                      await api(`/api/campaigns/${campaignId}/maps`, {
                        method: "POST",
                        body: JSON.stringify({
                          youtubeUrl: url,
                          name: (form.elements.namedItem("ytname") as HTMLInputElement).value,
                        }),
                      });
                      form.reset();
                    } catch (err: any) {
                      setError(err.message);
                    }
                  }}
                >
                  <input name="ytname" placeholder="Map name" />
                  <input name="yturl" placeholder="…or paste a YouTube link" required />
                  <button className="ghost">Add YouTube map</button>
                </form>
                <p className="muted small">
                  Heads up: YouTube maps can show ads mid-session — uploaded files never do.
                </p>
              </section>
            </>
          )}
          <p className="muted map-hint">Drag to pan · scroll to zoom · double-click to ping</p>
        </aside>
      </div>
    </div>
  );
}

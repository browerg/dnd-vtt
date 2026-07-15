import CampaignThemeBrand from "../components/CampaignThemeBrand";
import CampaignThemePicker from "../components/CampaignThemePicker";
import { useCampaignTheme, type ThemeId } from "../theme";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { api, type RollPayload } from "../api";
import { useAuth } from "../App";
import { animateRoll } from "../dice3d";
import { CONDITIONS, type CharacterSummary } from "../sheet";
import { REMNANT_CONDITIONS } from "../remnant";
import DiceDock from "../components/DiceDock";
import RollDock from "../components/RollDock";
import AnnouncementCenter from "../components/AnnouncementCenter";
import MapObjects from "../components/MapObjects";
import SceneDirector from "../components/SceneDirector";
import PreparedTokenTray, { type MonsterPreparation } from "../components/PreparedTokenTray";
import YouTubeMapPlayer from "../components/YouTubeMapPlayer";
import "./MapTokenArt.css";
import "./MapObjects.css";
import "./SceneDirector.css";
import "./PreparedTokenTray.css";
import "./MapAudio.css";

interface MapInfo {
  id: number;
  campaignId: number;
  name: string;
  imageUrl: string;
  isVideo: boolean;
  youtubeId: string;
  audioUrl: string;
  youtubeAudio: boolean;
  gridSize: number;
  gridOn: boolean;
  active: boolean;
  fogOn: boolean;
  fogCells: string[];
  strokes: Stroke[];
}

interface Stroke {
  id: string;
  color: string;
  size: number;
  points: number[]; // flat [x1, y1, x2, y2, …] in map coords
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

type Tool = "move" | "reveal" | "hide" | "ruler" | "draw" | "erase";

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
  portraitUrl: string;
  imageUrl: string;
  imageScale: number;
  conditions: string[];
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

interface PreparedTokenDrag {
  id: number;
  name: string;
  size: number;
  imageUrl: string;
  color: string;
}

interface PreparedTokenDropPreview extends PreparedTokenDrag {
  x: number;
  y: number;
}

interface PreparedEncounterDrag {
  id: number;
  name: string;
  members: {
    id: number;
    name: string;
    imageUrl: string;
    color: string;
    size: number;
    offsetX: number;
    offsetY: number;
  }[];
}

interface PreparedEncounterDropPreview extends PreparedEncounterDrag {
  x: number;
  y: number;
}

export default function MapPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { user } = useAuth();

  const [map, setMap] = useState<MapInfo | null>(null);
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [enteringTokenIds, setEnteringTokenIds] = useState<Set<number>>(new Set());
  const [brokenAuraTokenIds, setBrokenAuraTokenIds] = useState<Set<number>>(new Set());
  const [combatEffectNotice, setCombatEffectNotice] = useState("");
  const combatEffectReadyRef = useRef(false);
  const previousTokenIdsRef = useRef<Set<number>>(new Set());
  const previousAuraRef = useRef<Record<number, number | null>>({});
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [role, setRole] = useState("");
  const [system, setSystem] = useState("dnd5e");
  const [campaignTheme, setCampaignTheme] = useState("");
  const [campaignName, setCampaignName] = useState("Campaign");
  const [campaignChapter, setCampaignChapter] = useState("");
  const [campaignSession, setCampaignSession] = useState(0);
  const [rolls, setRolls] = useState<RollPayload[]>([]);
  const [ruler, setRuler] = useState<RulerLine | null>(null);
  const [remoteRulers, setRemoteRulers] = useState<Record<string, RulerLine>>({});
  const rulerTimers = useRef<Record<string, number>>({});
  const rulerEmit = useRef(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const drawingRef = useRef<Stroke | null>(null);
  drawingRef.current = drawing;
  const [drawColor, setDrawColor] = useState("#cfa64f");
  const mapIdRef = useRef<number | null>(null);
  const [pings, setPings] = useState<Ping[]>([]);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 0.8 });
  const [preparedTokenDropPreview, setPreparedTokenDropPreview] =
    useState<PreparedTokenDropPreview | null>(null);
  const [preparedEncounterDropPreview, setPreparedEncounterDropPreview] =
    useState<PreparedEncounterDropPreview | null>(null);
  const [preparedTokenDropBusy, setPreparedTokenDropBusy] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [customName, setCustomName] = useState("");
  const [customColor, setCustomColor] = useState("#b04545");
  const [customImagePreview, setCustomImagePreview] = useState("");
  const [tokenArtBusy, setTokenArtBusy] = useState<number | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(() => {
    const saved = Number(localStorage.getItem("battle-map-volume"));
    return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.2;
  });
  const [youtubeSoundEnabled, setYoutubeSoundEnabled] = useState(false);
  const [youtubeVolume, setYoutubeVolume] = useState(() => {
    const saved = Number(localStorage.getItem("battle-map-youtube-volume"));
    return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.2;
  });
  const [mapAudioBusy, setMapAudioBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [tool, setTool] = useState<Tool>("move");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [combat, setCombat] = useState<CombatState>({ active: false, round: 0, turn: 0, combatants: [] });
  const [combatantPick, setCombatantPick] = useState("");
  const [monsterQuery, setMonsterQuery] = useState("");
  const [monsterHits, setMonsterHits] = useState<MonsterHit[]>([]);
  const [monsterToPrepare, setMonsterToPrepare] = useState<MonsterPreparation | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [statblock, setStatblock] = useState<MonsterDetail | null>(null);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  mapIdRef.current = map?.id ?? null;
  const fogSaveTimer = useRef<number>();

  // RWBY token entrance and Aura transition effects.
  useEffect(() => {
    const currentIds = new Set(tokens.map((token) => token.id));
    const currentAura: Record<number, number | null> = {};
    const newEncounterIds: number[] = [];
    const newlyBrokenAuraIds: number[] = [];

    for (const token of tokens) {
      currentAura[token.id] = token.aura;
      if (
        combatEffectReadyRef.current &&
        !previousTokenIdsRef.current.has(token.id) &&
        token.monsterId != null
      ) {
        newEncounterIds.push(token.id);
      }

      const previousAura = previousAuraRef.current[token.id];
      if (
        combatEffectReadyRef.current &&
        previousAura != null &&
        previousAura > 0 &&
        token.aura != null &&
        token.aura <= 0
      ) {
        newlyBrokenAuraIds.push(token.id);
      }
    }

    previousTokenIdsRef.current = currentIds;
    previousAuraRef.current = currentAura;

    if (!combatEffectReadyRef.current) {
      combatEffectReadyRef.current = true;
      return;
    }

    if (newEncounterIds.length > 0) {
      setEnteringTokenIds((previous) => new Set([...previous, ...newEncounterIds]));
      setCombatEffectNotice(
        newEncounterIds.length === 1 ? "A Grimm enters the battlefield." : "Grimm enter the battlefield."
      );
      window.setTimeout(() => {
        setEnteringTokenIds((previous) => {
          const next = new Set(previous);
          newEncounterIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 1800);
      window.setTimeout(() => setCombatEffectNotice(""), 3200);
    }

    if (newlyBrokenAuraIds.length > 0) {
      setBrokenAuraTokenIds((previous) => new Set([...previous, ...newlyBrokenAuraIds]));
      const brokenNames = tokens
        .filter((token) => newlyBrokenAuraIds.includes(token.id))
        .map((token) => token.name);
      setCombatEffectNotice(
        brokenNames.length === 1 ? `${brokenNames[0]}'s AURA IS BROKEN` : "AURA BREAK"
      );
      window.setTimeout(() => {
        setBrokenAuraTokenIds((previous) => {
          const next = new Set(previous);
          newlyBrokenAuraIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 1700);
      window.setTimeout(() => setCombatEffectNotice(""), 3600);
    }
  }, [tokens]);

  const socketRef = useRef<Socket | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const dragRef = useRef<
    | { kind: "pan"; startX: number; startY: number; viewX: number; viewY: number; moved: boolean }
    | { kind: "token"; tokenId: number; offsetX: number; offsetY: number; moved: boolean }
    | { kind: "fog"; reveal: boolean }
    | { kind: "ruler" }
    | { kind: "draw" }
    | { kind: "erase" }
    | null
  >(null);
  const lastEmit = useRef(0);
  const pingKey = useRef(0);

  useEffect(
    () => () => {
      if (customImagePreview) URL.revokeObjectURL(customImagePreview);
    },
    [customImagePreview]
  );


  useEffect(() => {
    setAudioPlaying(false);
    setYoutubeSoundEnabled(false);
  }, [map?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = audioVolume;
    localStorage.setItem("battle-map-volume", String(audioVolume));
  }, [audioVolume, map?.audioUrl]);

  useEffect(() => {
    localStorage.setItem("battle-map-youtube-volume", String(youtubeVolume));
  }, [youtubeVolume]);

  const toggleMapMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setError("");
    try {
      if (audio.paused) {
        await audio.play();
        setAudioPlaying(true);
      } else {
        audio.pause();
        setAudioPlaying(false);
      }
    } catch {
      setError("Your browser blocked audio. Click Play music again after interacting with the page.");
    }
  };

  const isDM = role === "dm" || role === "co-dm";
  const canRoll = role !== "" && role !== "spectator";
  const themeView = useCampaignTheme({
    campaignId,
    userId: user?.id,
    system,
    campaignTheme,
  });
  const updateCampaignTheme = (theme: ThemeId) => setCampaignTheme(theme);

  // Seed the roll log; live rolls arrive over the socket above.
  useEffect(() => {
    api<{ rolls: RollPayload[] }>(`/api/campaigns/${campaignId}/rolls`)
      .then((r) => setRolls(r.rolls))
      .catch(() => {});
  }, [campaignId]);

  const doRoll = useCallback(
    async (body: {
      formula: string;
      label: string;
      mode: string;
      visibility: string;
      manual?: boolean;
      total?: number;
    }) => {
      await api(`/api/campaigns/${campaignId}/rolls`, { method: "POST", body: JSON.stringify(body) });
    },
    [campaignId]
  );

  const loadAll = useCallback(async () => {
    try {
      const [active, list, detail, chars, combatRes] = await Promise.all([
        api<{ map: MapInfo | null; tokens: Token[] }>(`/api/campaigns/${campaignId}/maps/active`),
        api<{ maps: MapInfo[] }>(`/api/campaigns/${campaignId}/maps`),
        api<{ yourRole: string; campaign: { system: string; theme: string; name: string; chapter: string; session_number: number } }>(`/api/campaigns/${campaignId}`),
        api<{ characters: CharacterSummary[] }>(`/api/campaigns/${campaignId}/characters`),
        api<{ state: CombatState }>(`/api/campaigns/${campaignId}/combat`),
      ]);
      setMap(active.map);
      setTokens(active.tokens);
      setMaps(list.maps);
      setRole(detail.yourRole);
      setSystem(detail.campaign.system);
      setCampaignTheme(detail.campaign.theme ?? "");
      setCampaignName(detail.campaign.name);
      setCampaignChapter(detail.campaign.chapter ?? "");
      setCampaignSession(detail.campaign.session_number ?? 0);
      setStrokes(active.map?.strokes ?? []);
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
    socket.on("draw:update", (m: { campaignId: number; mapId: number; strokes: Stroke[] }) => {
      if (m.campaignId === campaignId && m.mapId === mapIdRef.current) setStrokes(m.strokes);
    });
    socket.on(
      "fog:update",
      (m: { campaignId: number; mapId: number; fogOn: boolean; fogCells: string[] }) => {
        if (m.campaignId !== campaignId) return;
        setMap((prev) => (prev && prev.id === m.mapId ? { ...prev, fogOn: m.fogOn } : prev));
        setRevealed(new Set(m.fogCells));
      }
    );
    socket.on("roll", async (roll: RollPayload) => {
      if (roll.campaignId !== campaignId) return;
      // Same pipeline as the hub: let the 3D dice settle before the number lands.
      if (roll.detail) await animateRoll(roll.detail, roll.diceTheme, { userName: roll.userName, label: roll.label });
      setRolls((prev) => [...prev.slice(-99), roll]);
    });
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

  // ---- drawing helpers ----
  const saveStrokes = (next: Stroke[]) => {
    setStrokes(next);
    if (map)
      api(`/api/campaigns/${campaignId}/maps/${map.id}/draw`, {
        method: "PUT",
        body: JSON.stringify({ strokes: next }),
      }).catch((e: any) => setError(e.message));
  };

  const eraseAt = (clientX: number, clientY: number) => {
    const p = toMapCoords(clientX, clientY);
    const threshold = 14 / viewRef.current.scale;
    const hit = strokes.find((s) => {
      for (let i = 0; i < s.points.length; i += 2) {
        if (Math.hypot(s.points[i] - p.x, s.points[i + 1] - p.y) < threshold) return true;
      }
      return false;
    });
    if (hit) saveStrokes(strokes.filter((s) => s.id !== hit.id));
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
    if (tool === "draw" && role !== "spectator") {
      const p = toMapCoords(e.clientX, e.clientY);
      dragRef.current = { kind: "draw" };
      setDrawing({
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        color: drawColor,
        size: 4,
        points: [p.x, p.y],
      });
      return;
    }
    if (tool === "erase" && role !== "spectator") {
      dragRef.current = { kind: "erase" };
      eraseAt(e.clientX, e.clientY);
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
    if (d.kind === "draw") {
      const p = toMapCoords(e.clientX, e.clientY);
      setDrawing((prev) => {
        if (!prev) return prev;
        const n = prev.points.length;
        // Skip micro-movements so strokes stay light.
        if (Math.hypot(p.x - prev.points[n - 2], p.y - prev.points[n - 1]) < 2) return prev;
        return { ...prev, points: [...prev.points, p.x, p.y] };
      });
      return;
    }
    if (d.kind === "erase") {
      eraseAt(e.clientX, e.clientY);
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
    if (d?.kind === "draw") {
      const s = drawingRef.current;
      setDrawing(null);
      if (s && s.points.length >= 4) saveStrokes([...strokes, s]);
      return;
    }
    if (d?.kind === "erase") return;
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

  const readPreparedTokenDrag = (event: React.DragEvent): PreparedTokenDrag | null => {
    const raw = event.dataTransfer.getData("application/x-prepared-token");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!Number.isInteger(parsed.id) || !Number.isFinite(parsed.size)) return null;
      return {
        id: parsed.id,
        name: String(parsed.name ?? "Prepared token"),
        size: Math.min(4, Math.max(1, Number(parsed.size) || 1)),
        imageUrl: String(parsed.imageUrl ?? ""),
        color: String(parsed.color ?? "#a03636"),
      };
    } catch {
      return null;
    }
  };

  const readPreparedEncounterDrag = (
    event: React.DragEvent
  ): PreparedEncounterDrag | null => {
    const raw = event.dataTransfer.getData("application/x-prepared-encounter");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!Number.isInteger(parsed.id) || !Array.isArray(parsed.members)) return null;
      return {
        id: parsed.id,
        name: String(parsed.name ?? "Prepared encounter"),
        members: parsed.members
          .map((member: any) => ({
            id: Number(member.id),
            name: String(member.name ?? "Token"),
            imageUrl: String(member.imageUrl ?? ""),
            color: String(member.color ?? "#a03636"),
            size: Math.min(4, Math.max(1, Number(member.size) || 1)),
            offsetX: Number(member.offsetX) || 0,
            offsetY: Number(member.offsetY) || 0,
          }))
          .filter((member: any) => Number.isInteger(member.id)),
      };
    } catch {
      return null;
    }
  };

  const onPreparedTokenDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    const isToken = event.dataTransfer.types.includes("application/x-prepared-token");
    const isEncounter = event.dataTransfer.types.includes("application/x-prepared-encounter");
    if (!isToken && !isEncounter) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = isEncounter ? "copy" : "move";
    if (!map) return;

    const point = toMapCoords(event.clientX, event.clientY);

    if (isEncounter) {
      const encounter = readPreparedEncounterDrag(event);
      if (!encounter) return;
      let x = point.x;
      let y = point.y;
      if (map.gridOn) {
        x = Math.round(x / map.gridSize) * map.gridSize;
        y = Math.round(y / map.gridSize) * map.gridSize;
      }
      setPreparedTokenDropPreview(null);
      setPreparedEncounterDropPreview({ ...encounter, x, y });
      return;
    }

    const dragged = readPreparedTokenDrag(event);
    if (!dragged) return;
    let x = point.x;
    let y = point.y;
    if (map.gridOn) {
      const half = (dragged.size * map.gridSize) / 2;
      x = Math.round((x - half) / map.gridSize) * map.gridSize + half;
      y = Math.round((y - half) / map.gridSize) * map.gridSize + half;
    }
    setPreparedEncounterDropPreview(null);
    setPreparedTokenDropPreview({ ...dragged, x, y });
  };

  const onPreparedTokenDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    if (!map) return;

    const encounter = readPreparedEncounterDrag(event);
    if (encounter) {
      event.preventDefault();
      const point = toMapCoords(event.clientX, event.clientY);
      let x = point.x;
      let y = point.y;
      if (map.gridOn) {
        x = Math.round(x / map.gridSize) * map.gridSize;
        y = Math.round(y / map.gridSize) * map.gridSize;
      }

      setPreparedTokenDropBusy(true);
      setError("");
      try {
        await api(
          `/api/campaigns/${campaignId}/prepared-encounters/${encounter.id}/deploy`,
          {
            method: "POST",
            body: JSON.stringify({ mapId: map.id, x, y }),
          }
        );
      } catch (e: any) {
        setError(e.message);
      } finally {
        setPreparedTokenDropBusy(false);
        setPreparedEncounterDropPreview(null);
      }
      return;
    }

    const dragged = readPreparedTokenDrag(event);
    if (!dragged) return;
    event.preventDefault();

    const point = toMapCoords(event.clientX, event.clientY);
    let x = point.x;
    let y = point.y;
    if (map.gridOn) {
      const half = (dragged.size * map.gridSize) / 2;
      x = Math.round((x - half) / map.gridSize) * map.gridSize + half;
      y = Math.round((y - half) / map.gridSize) * map.gridSize + half;
    }

    setPreparedTokenDropBusy(true);
    setError("");
    try {
      await api(`/api/campaigns/${campaignId}/prepared-tokens/${dragged.id}/deploy`, {
        method: "POST",
        body: JSON.stringify({ mapId: map.id, x, y }),
      });
      window.dispatchEvent(new Event("prepared-tokens:refresh"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPreparedTokenDropBusy(false);
      setPreparedTokenDropPreview(null);
    }
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

  const uploadMapMusic = async (event: FormEvent) => {
    event.preventDefault();
    if (!map) return;
    const form = event.currentTarget as HTMLFormElement;
    const file = (form.elements.namedItem("mapAudio") as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError("Map music must be under 50 MB.");
      return;
    }
    const body = new FormData();
    body.append("audio", file);
    setMapAudioBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/maps/${map.id}/music`,
        { method: "POST", body }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Music upload failed.");
      setMap(result.map);
      form.reset();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMapAudioBusy(false);
    }
  };

  const removeMapMusic = async () => {
    if (!map) return;
    setMapAudioBusy(true);
    setError("");
    try {
      await api(`/api/campaigns/${campaignId}/maps/${map.id}/music`, { method: "DELETE" });
      setMap((current) => (current ? { ...current, audioUrl: "" } : current));
      setAudioPlaying(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMapAudioBusy(false);
    }
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

  const uploadTokenImage = async (tokenId: number, file: File) => {
    if (!map) throw new Error("No active map.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Token images must be under 10 MB.");

    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch(
      `/api/campaigns/${campaignId}/maps/${map.id}/tokens/${tokenId}/image`,
      { method: "POST", body: formData }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Token image upload failed.");
    return body as { token: Token };
  };

  const chooseCustomImage = (file?: File) => {
    if (customImagePreview) URL.revokeObjectURL(customImagePreview);
    setCustomImagePreview(file ? URL.createObjectURL(file) : "");
  };

  const placeCustom = async (e: FormEvent) => {
    e.preventDefault();
    if (!map || !customName.trim()) return;

    const form = e.currentTarget as HTMLFormElement;
    const file = (form.elements.namedItem("tokenImage") as HTMLInputElement).files?.[0];
    const size = Number((form.elements.namedItem("tokenSize") as HTMLSelectElement).value) || 1;

    setError("");
    try {
      const created = await api<{ token: Token }>(
        `/api/campaigns/${campaignId}/maps/${map.id}/tokens`,
        {
          method: "POST",
          body: JSON.stringify({ name: customName, color: customColor, size }),
        }
      );
      if (file) await uploadTokenImage(created.token.id, file);
      setCustomName("");
      setCustomImagePreview("");
      form.reset();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const updateTokenAppearance = async (
    token: Token,
    changes: { size?: number; imageScale?: number; color?: string }
  ) => {
    if (!map) return;
    setError("");
    try {
      const result = await api<{ token: Token }>(
        `/api/campaigns/${campaignId}/maps/${map.id}/tokens/${token.id}/appearance`,
        { method: "PUT", body: JSON.stringify(changes) }
      );
      setTokens((prev) => prev.map((item) => (item.id === token.id ? result.token : item)));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const uploadSelectedTokenArt = async (e: FormEvent, token: Token) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const file = (form.elements.namedItem("selectedTokenImage") as HTMLInputElement).files?.[0];
    if (!file) return;

    setTokenArtBusy(token.id);
    setError("");
    try {
      const result = await uploadTokenImage(token.id, file);
      setTokens((prev) => prev.map((item) => (item.id === token.id ? result.token : item)));
      form.reset();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTokenArtBusy(null);
    }
  };

  const removeTokenArt = async (token: Token) => {
    if (!map) return;
    setTokenArtBusy(token.id);
    setError("");
    try {
      const result = await api<{ token: Token }>(
        `/api/campaigns/${campaignId}/maps/${map.id}/tokens/${token.id}/image`,
        { method: "DELETE" }
      );
      setTokens((prev) => prev.map((item) => (item.id === token.id ? result.token : item)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTokenArtBusy(null);
    }
  };

  const removeToken = async (tokenId: number) => {
    if (!map) return;
    const token = tokens.find((item) => item.id === tokenId);
    if (isDM && token && token.characterId == null) {
      const returnToTray = window.confirm(
        `Return "${token.name}" to Prepared Tokens?

Choose Cancel to permanently delete it instead.`
      );
      if (returnToTray) {
        await api(
          `/api/campaigns/${campaignId}/maps/${map.id}/tokens/${tokenId}/return-to-tray`,
          { method: "POST" }
        );
        window.dispatchEvent(new Event("prepared-tokens:refresh"));
        return;
      }
      if (!window.confirm(`Permanently delete "${token.name}"?`)) return;
    }
    await api(`/api/campaigns/${campaignId}/maps/${map.id}/tokens/${tokenId}`, {
      method: "DELETE",
    });
  };

  const prepareMonster = (monster: MonsterHit) =>
    setMonsterToPrepare({
      id: monster.id,
      name: monster.name,
      hp: monster.hp,
      size: monster.size,
    });

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

  const toggleTokenCondition = (token: Token, cond: string) =>
    map &&
    api(`/api/campaigns/${campaignId}/maps/${map.id}/tokens/${token.id}/conditions`, {
      method: "PUT",
      body: JSON.stringify({
        conditions: token.conditions.includes(cond)
          ? token.conditions.filter((x) => x !== cond)
          : [...token.conditions, cond],
      }),
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
    <div className="shell map-shell campaign-themed" data-system={system} data-theme={themeView.themeId}>
      <AnnouncementCenter campaignId={campaignId} />
      {combatEffectNotice && (
        <div className="rwby-combat-effect-notice" role="status">
          <span>Combat effect</span>
          <strong>{combatEffectNotice}</strong>
        </div>
      )}
      {map && <SceneDirector campaignId={campaignId} mapId={map.id} isDM={isDM} />}
      <header className="topbar campaign-topbar">
        <Link to={`/campaigns/${campaignId}`} className="ghost link campaign-back-link">{"\u2190"}</Link>
        <CampaignThemeBrand
          campaignName={campaignName}
          chapter={campaignChapter}
          sessionNumber={campaignSession}
          themeId={themeView.themeId}
          pageLabel={map?.name || (system === "remnant" ? "Tactical map" : "Battle map")}
        />
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
        {map && role !== "spectator" && (
          <>
            <button
              className={tool === "draw" ? "ghost mini active-tool" : "ghost mini"}
              title="Sketch on the map — everyone sees it"
              onClick={() => setTool(tool === "draw" ? "move" : "draw")}
            >
              ✏️ Draw
            </button>
            {(tool === "draw" || tool === "erase") && (
              <>
                <input
                  type="color"
                  className="color-pick ink-pick"
                  title="Ink color"
                  value={drawColor}
                  onChange={(e) => setDrawColor(e.target.value)}
                />
                <button
                  className={tool === "erase" ? "ghost mini active-tool" : "ghost mini"}
                  title="Erase a drawing — click or drag over it"
                  onClick={() => setTool(tool === "erase" ? "draw" : "erase")}
                >
                  Erase
                </button>
                {isDM && strokes.length > 0 && (
                  <button className="ghost mini" title="Remove every drawing" onClick={() => saveStrokes([])}>
                    Clear ink
                  </button>
                )}
              </>
            )}
          </>
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
        <CampaignThemePicker
          campaignId={campaignId}
          role={role}
          system={system}
          campaignTheme={campaignTheme}
          view={themeView}
          onCampaignThemeChange={updateCampaignTheme}
        />
        <span className="muted zoom-label">{Math.round(view.scale * 100)}%</span>
      </header>

      {map?.audioUrl && (
        <div className="battle-map-audio-dock">
          <audio
            ref={audioRef}
            src={map.audioUrl}
            loop
            preload="metadata"
            onPlay={() => setAudioPlaying(true)}
            onPause={() => setAudioPlaying(false)}
          />
          <button type="button" className="ghost mini" onClick={toggleMapMusic}>
            {audioPlaying ? "Pause music" : "Play music"}
          </button>
          <label>
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioVolume}
              onChange={(event) => setAudioVolume(Number(event.target.value))}
            />
          </label>
        </div>
      )}
      {map?.youtubeId && map.youtubeAudio && (
        <div className="battle-map-youtube-audio-dock">
          <button
            type="button"
            className="ghost mini"
            onClick={() => setYoutubeSoundEnabled((enabled) => !enabled)}
          >
            {youtubeSoundEnabled ? "Mute YouTube" : "Enable YouTube sound"}
          </button>
          <label>
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={youtubeVolume}
              onChange={(event) => setYoutubeVolume(Number(event.target.value))}
            />
            <strong>{Math.round(youtubeVolume * 100)}%</strong>
          </label>
        </div>
      )}

      {(preparedTokenDropPreview || preparedEncounterDropPreview) && (
        <div className="prepared-token-drop-status">
          {preparedTokenDropBusy
            ? "Deploying..."
            : preparedEncounterDropPreview
              ? `Drop encounter: ${preparedEncounterDropPreview.name}`
              : `Drop ${preparedTokenDropPreview?.name} onto this square`}
        </div>
      )}
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
          onDragOver={onPreparedTokenDragOver}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setPreparedTokenDropPreview(null);
              setPreparedEncounterDropPreview(null);
            }
          }}
          onDrop={onPreparedTokenDrop}
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
                <YouTubeMapPlayer
                  videoId={map.youtubeId}
                  title={map.name}
                  soundEnabled={map.youtubeAudio && youtubeSoundEnabled}
                  volume={youtubeVolume}
                />
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
              {(strokes.length > 0 || drawing) && (
                <svg className="draw-overlay" width={imgSize.w || 1920} height={imgSize.h || 1080}>
                  {strokes.concat(drawing ? [drawing] : []).map((s) => (
                    <polyline
                      key={s.id}
                      points={Array.from(
                        { length: s.points.length / 2 },
                        (_, i) => `${s.points[2 * i]},${s.points[2 * i + 1]}`
                      ).join(" ")}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={s.size}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>
              )}
              <MapObjects
                campaignId={campaignId}
                mapId={map.id}
                isDM={isDM}
                gridSize={g}
              />
              {tokens.map((t) => {
                const px = t.size * g;
                const hasCutout = Boolean(t.imageUrl);
                return (
                  <div
                    key={t.id}
                    data-token-id={t.id}
                    className={`token${hasCutout ? " image-token" : ""}${canMove(t) ? " movable" : ""}${
                      currentCombatant?.tokenId === t.id ? " current-turn" : ""
                    }${selectedTokenId === t.id ? " selected" : ""}${
                      t.auraMax != null && t.aura != null && t.aura > 0 ? " aura-active" : ""
                    }${
                      t.auraMax != null &&
                      t.aura != null &&
                      t.aura > 0 &&
                      t.aura / Math.max(1, t.auraMax) <= 0.25
                        ? " aura-critical"
                        : ""
                    }${brokenAuraTokenIds.has(t.id) ? " aura-breaking" : ""}${
                      enteringTokenIds.has(t.id) ? " grimm-entering" : ""
                    }`}
                    style={{
                      left: t.x - px / 2,
                      top: t.y - px / 2,
                      width: px,
                      height: px,
                      background: hasCutout
                        ? "transparent"
                        : t.portraitUrl
                          ? `url(${t.portraitUrl}) center/cover no-repeat, ${t.color}`
                          : t.color,
                    }}
                    title={t.name}
                  >
                    {t.auraMax != null && t.aura != null && t.aura > 0 && (
                      <span className="token-aura-shell" aria-hidden="true" />
                    )}
                    {brokenAuraTokenIds.has(t.id) && (
                      <span className="token-aura-break-ring" aria-hidden="true" />
                    )}
                    {enteringTokenIds.has(t.id) && (
                      <span className="token-grimm-smoke" aria-hidden="true" />
                    )}
                    {hasCutout && (
                      <img
                        className="token-cutout"
                        src={t.imageUrl}
                        alt=""
                        draggable={false}
                        style={{ transform: `scale(${t.imageScale || 1})` }}
                      />
                    )}
                    {!hasCutout && !t.portraitUrl && (
                      <span className="token-initials">
                        {t.name
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((word) => word[0])
                          .join("")
                          .toUpperCase()}
                      </span>
                    )}
                    {t.conditions.length > 0 && (
                      <span className="token-cond" title={t.conditions.join(", ")}>
                        {t.conditions.length}
                      </span>
                    )}
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
              {preparedEncounterDropPreview && (
                <div
                  className="prepared-encounter-drop-preview"
                  style={{
                    left: preparedEncounterDropPreview.x,
                    top: preparedEncounterDropPreview.y,
                  }}
                >
                  {preparedEncounterDropPreview.members.map((member) => (
                    <div
                      className="prepared-encounter-member-preview"
                      key={member.id}
                      style={{
                        left: member.offsetX * g - (member.size * g) / 2,
                        top: member.offsetY * g - (member.size * g) / 2,
                        width: member.size * g,
                        height: member.size * g,
                        background: member.imageUrl ? "transparent" : member.color,
                      }}
                    >
                      {member.imageUrl && (
                        <img src={member.imageUrl} alt="" draggable={false} />
                      )}
                    </div>
                  ))}
                  <span>{preparedEncounterDropPreview.name}</span>
                </div>
              )}
              {preparedTokenDropPreview && (
                <div
                  className="prepared-token-drop-preview"
                  style={{
                    left:
                      preparedTokenDropPreview.x -
                      (preparedTokenDropPreview.size * g) / 2,
                    top:
                      preparedTokenDropPreview.y -
                      (preparedTokenDropPreview.size * g) / 2,
                    width: preparedTokenDropPreview.size * g,
                    height: preparedTokenDropPreview.size * g,
                    background: preparedTokenDropPreview.imageUrl
                      ? "transparent"
                      : preparedTokenDropPreview.color,
                  }}
                >
                  {preparedTokenDropPreview.imageUrl && (
                    <img src={preparedTokenDropPreview.imageUrl} alt="" draggable={false} />
                  )}
                  <span>{preparedTokenDropPreview.name}</span>
                </div>
              )}
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
          {selectedToken && (isDM || canMove(selectedToken)) && (
            <section className="token-art-panel">
              <div className="row-between">
                <h4>Token appearance</h4>
                <button className="ghost mini" onClick={() => setSelectedTokenId(null)}>
                  {"\u2715"}
                </button>
              </div>

              <div className={`token-art-preview${selectedToken.imageUrl ? " has-cutout" : ""}`}>
                {selectedToken.imageUrl ? (
                  <img
                    src={selectedToken.imageUrl}
                    alt=""
                    style={{ transform: `scale(${selectedToken.imageScale || 1})` }}
                  />
                ) : (
                  <span style={{ background: selectedToken.color }}>
                    {selectedToken.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                )}
              </div>

              <form
                className="stack token-art-upload"
                onSubmit={(event) => uploadSelectedTokenArt(event, selectedToken)}
              >
                <label className="small">
                  PNG cutout or token art
                  <input
                    name="selectedTokenImage"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    required
                  />
                </label>
                <button className="ghost mini" disabled={tokenArtBusy === selectedToken.id}>
                  {tokenArtBusy === selectedToken.id
                    ? "Uploading..."
                    : selectedToken.imageUrl
                      ? "Replace image"
                      : "Upload image"}
                </button>
              </form>

              <label className="token-art-control">
                <span>Footprint</span>
                <select
                  value={selectedToken.size}
                  onChange={(event) =>
                    updateTokenAppearance(selectedToken, { size: Number(event.target.value) })
                  }
                >
                  <option value={1}>1 square</option>
                  <option value={2}>2 x 2</option>
                  <option value={3}>3 x 3</option>
                  <option value={4}>4 x 4</option>
                </select>
              </label>

              {selectedToken.imageUrl && (
                <label className="token-art-control token-scale-control">
                  <span>
                    Art scale <strong>{Math.round((selectedToken.imageScale || 1) * 100)}%</strong>
                  </span>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.05"
                    value={selectedToken.imageScale || 1}
                    onChange={(event) => {
                      const imageScale = Number(event.target.value);
                      setTokens((prev) =>
                        prev.map((item) =>
                          item.id === selectedToken.id ? { ...item, imageScale } : item
                        )
                      );
                    }}
                    onPointerUp={(event) =>
                      updateTokenAppearance(selectedToken, {
                        imageScale: Number(event.currentTarget.value),
                      })
                    }
                    onKeyUp={(event) =>
                      updateTokenAppearance(selectedToken, {
                        imageScale: Number(event.currentTarget.value),
                      })
                    }
                  />
                </label>
              )}

              {selectedToken.imageUrl && (
                <button
                  type="button"
                  className="ghost mini token-art-remove"
                  disabled={tokenArtBusy === selectedToken.id}
                  onClick={() => removeTokenArt(selectedToken)}
                >
                  Remove image and use standard token
                </button>
              )}
              <p className="muted small token-art-tip">
                Transparent PNGs work best. The footprint controls occupied squares; art scale
                only changes the visible cutout.
              </p>
            </section>
          )}
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
              <details className="mon-ability">
                <summary>
                  Conditions{selectedToken.conditions.length > 0 ? ` (${selectedToken.conditions.length})` : ""}
                </summary>
                <div className="condition-chips statblock-conds">
                  {(statblock.system === "remnant" ? REMNANT_CONDITIONS : CONDITIONS).map((c) => (
                    <button
                      key={c}
                      className={selectedToken.conditions.includes(c) ? "chip active" : "chip"}
                      onClick={() => toggleTokenCondition(selectedToken, c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </details>
            </section>
          )}
          <section>
            <h4>{combat.active ? `Combat — round ${combat.round}` : "Initiative"}</h4>
            {combat.combatants.map((c, i) => {
              const tok = tokens.find((t) => t.id === c.tokenId);
              return (
                <div
                  key={c.id}
                  className={`row-between sidebar-row${combat.active && i === combat.turn ? " current-row" : ""}${
                    tok ? " clickable" : ""
                  }`}
                  onClick={() => tok && setSelectedTokenId(tok.id)}
                >
                  <span className="init-name">
                    {combat.active && i === combat.turn ? "▶ " : ""}
                    {c.name}
                    {tok && tok.hp != null && tok.maxHp != null && (
                      <span className={`small init-hp${tok.hp <= 0 ? " dead" : ""}`}>
                        {" "}
                        {tok.hp}/{tok.maxHp}
                      </span>
                    )}
                    {tok && tok.conditions.length > 0 && (
                      <span className="init-conds" title={tok.conditions.join(", ")}>
                        {" "}
                        ⚠{tok.conditions.length}
                      </span>
                    )}
                  </span>
                  <span className="init-badge">
                    {c.initiative}
                    {isDM && (
                      <button
                        className="ghost mini"
                        title="Remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          api(`/api/campaigns/${campaignId}/combat/combatants/${c.id}`, { method: "DELETE" });
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
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
            {characters
              // Don't leak secret NPC names to players — only the DM (or a
              // shared, player-controllable NPC) shows in the list.
              .filter((c) => !c.isNpc || isDM || c.playerControllable)
              .map((c) => {
                const onMap = tokens.some((t) => t.characterId === c.id);
                const mine = c.ownerId === user?.id;
                return (
                  <div key={c.id} className="row-between sidebar-row">
                    <span className={onMap ? "" : "muted"}>
                      {c.name}
                      {c.isNpc && <span className="badge npc-badge">NPC</span>}
                    </span>
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
                  {t.imageUrl ? (
                    <img className="token-list-thumb" src={t.imageUrl} alt="" />
                  ) : (
                    <span className="swatch" style={{ background: t.color }} />
                  )}
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
                <PreparedTokenTray
                  campaignId={campaignId}
                  mapId={map.id}
                  monster={monsterToPrepare}
                  onCloseMonster={() => setMonsterToPrepare(null)}
                />
              )}
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
                        <button className="ghost mini" onClick={() => prepareMonster(m)}>
                          Prepare
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
                  <form onSubmit={placeCustom} className="stack custom-token-form">
                    <div className="row-between">
                      <input
                        placeholder="Dragon, chest, door..."
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        required
                      />
                      <input
                        type="color"
                        className="color-pick"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        title="Fallback token color"
                      />
                    </div>
                    <label className="small">
                      Footprint
                      <select name="tokenSize" defaultValue="1">
                        <option value="1">1 square</option>
                        <option value="2">2 x 2</option>
                        <option value="3">3 x 3</option>
                        <option value="4">4 x 4</option>
                      </select>
                    </label>
                    <label className="custom-token-image-pick small">
                      Transparent PNG or image (optional)
                      <input
                        name="tokenImage"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => chooseCustomImage(event.target.files?.[0])}
                      />
                    </label>
                    {customImagePreview && (
                      <div className="custom-token-preview">
                        <img src={customImagePreview} alt="New token preview" />
                        <span>Cutout preview</span>
                      </div>
                    )}
                    <button className="ghost">Place token</button>
                  </form>
                </section>
              )}
              {map && (
                <section className="map-audio-settings">
                  <h4>Map audio</h4>
                  <form className="stack" onSubmit={uploadMapMusic}>
                    <label className="small">
                      Looping music or ambience
                      <input
                        name="mapAudio"
                        type="file"
                        accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4"
                        required
                      />
                    </label>
                    <button className="ghost mini" disabled={mapAudioBusy}>
                      {mapAudioBusy ? "Uploading..." : map.audioUrl ? "Replace music" : "Upload music"}
                    </button>
                  </form>
                  {map.audioUrl && (
                    <button
                      type="button"
                      className="ghost mini map-audio-remove"
                      disabled={mapAudioBusy}
                      onClick={removeMapMusic}
                    >
                      Remove uploaded music
                    </button>
                  )}
                  {map.youtubeId && (
                    <label className="map-youtube-audio-toggle">
                      <input
                        type="checkbox"
                        checked={map.youtubeAudio}
                        onChange={(event) => {
                          const youtubeAudio = event.target.checked;
                          setMap((current) => (current ? { ...current, youtubeAudio } : current));
                          setYoutubeSoundEnabled(false);
                          patchMap({ youtubeAudio });
                        }}
                      />
                      Use audio from this YouTube map
                    </label>
                  )}
                  <p className="muted small map-audio-note">
                    Each player must click once before their browser allows sound.
                  </p>
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
      {canRoll && <DiceDock onRoll={doRoll} system={system} />}
      <RollDock rolls={rolls} />
    </div>
  );
}

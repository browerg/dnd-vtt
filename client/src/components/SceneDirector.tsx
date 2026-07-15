import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { io } from "socket.io-client";
import { api } from "../api";

interface Scene {
  id: number;
  mapId: number;
  name: string;
  announcement: string;
  enemyCount: number;
  encounterGroupId: number | null;
  encounterGroupName: string;
  encounterAnchorX: number;
  encounterAnchorY: number;
  createdAt: string;
  updatedAt: string;
}

interface EncounterGroupOption {
  id: number;
  name: string;
  members: {
    id: number;
    name: string;
    imageUrl?: string;
    color?: string;
    size?: number;
    offsetX?: number;
    offsetY?: number;
  }[];
}

interface ScenePlacementResult {
  requestId: string;
  sceneId?: number;
  cancelled?: boolean;
  x?: number;
  y?: number;
}

interface Props {
  campaignId: number;
  mapId: number;
  isDM: boolean;
}

export default function SceneDirector({ campaignId, mapId, isDM }: Props) {
  const [open, setOpen] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [encounterGroups, setEncounterGroups] = useState<EncounterGroupOption[]>([]);
  const [busy, setBusy] = useState<number | "new" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newEncounterGroupId, setNewEncounterGroupId] = useState("");
  const [newEncounterPlacement, setNewEncounterPlacement] = useState<{ x: number; y: number } | null>(null);
  const placementRequestRef = useState(() => ({ current: "" }))[0];

  const load = useCallback(async () => {
    try {
      const [sceneResult, groupResult] = await Promise.all([
        api<{ scenes: Scene[] }>(
          `/api/campaigns/${campaignId}/maps/${mapId}/scenes`
        ),
        api<{ groups: EncounterGroupOption[] }>(
          `/api/campaigns/${campaignId}/prepared-encounters`
        ),
      ]);
      setScenes(sceneResult.scenes);
      setEncounterGroups(groupResult.groups);
    } catch (e: any) {
      setError(e.message);
    }
  }, [campaignId, mapId]);

  useEffect(() => {
    if (isDM) void load();
  }, [isDM, load]);

  useEffect(() => {
    const onPlacementResult = (event: Event) => {
      const detail = (event as CustomEvent<ScenePlacementResult>).detail;
      if (!detail || detail.requestId !== placementRequestRef.current) return;
      placementRequestRef.current = "";
      setOpen(true);
      if (detail.cancelled || !Number.isFinite(detail.x) || !Number.isFinite(detail.y)) return;

      if (detail.sceneId) {
        void api(`/api/campaigns/${campaignId}/maps/${mapId}/scenes/${detail.sceneId}`, {
          method: "PUT",
          body: JSON.stringify({
            encounterAnchorX: detail.x,
            encounterAnchorY: detail.y,
          }),
        }).then(load).catch((e: any) => setError(e.message));
      } else {
        setNewEncounterPlacement({ x: Number(detail.x), y: Number(detail.y) });
      }
    };
    window.addEventListener("scene-encounter:placement-result", onPlacementResult);
    return () => window.removeEventListener("scene-encounter:placement-result", onPlacementResult);
  }, [campaignId, mapId, load, placementRequestRef]);

  const beginPlacement = (
    group: EncounterGroupOption,
    sceneId?: number
  ) => {
    const requestId = `scene-placement-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    placementRequestRef.current = requestId;
    setOpen(false);
    window.dispatchEvent(new CustomEvent("scene-encounter:placement-request", {
      detail: { requestId, sceneId, group },
    }));
  };

  useEffect(() => {
    const socket = io();
    socket.emit("campaign:join", campaignId);
    socket.on("scene:announcement", (message: {
      campaignId: number;
      mapId: number;
      sceneName: string;
      message: string;
    }) => {
      if (message.campaignId !== campaignId || message.mapId !== mapId) return;
      setNotice(message.message);
      window.setTimeout(() => setNotice(""), 5200);
    });
    return () => {
      socket.emit("campaign:leave", campaignId);
      socket.disconnect();
    };
  }, [campaignId, mapId]);

  const saveScene = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("new");
    setError("");
    try {
      await api(`/api/campaigns/${campaignId}/maps/${mapId}/scenes`, {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          announcement: data.get("announcement"),
          encounterGroupId: Number(newEncounterGroupId) || null,
          encounterAnchorX: newEncounterPlacement?.x ?? 4,
          encounterAnchorY: newEncounterPlacement?.y ?? 4,
        }),
      });
      form.reset();
      setNewEncounterGroupId("");
      setNewEncounterPlacement(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const activate = async (scene: Scene) => {
    const ok = confirm(
      `Activate "${scene.name}"?\n\nPlayer positions, player health, doors, chests, switches, and loot will stay exactly as they are.`
    );
    if (!ok) return;
    setBusy(scene.id);
    try {
      await api(`/api/campaigns/${campaignId}/maps/${mapId}/scenes/${scene.id}/activate`, {
        method: "POST",
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const rename = async (scene: Scene) => {
    const name = prompt("Scene name", scene.name)?.trim();
    if (!name || name === scene.name) return;
    await api(`/api/campaigns/${campaignId}/maps/${mapId}/scenes/${scene.id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    await load();
  };

  const editAnnouncement = async (scene: Scene) => {
    const announcement = prompt("Announcement shown when activated", scene.announcement) ?? null;
    if (announcement === null) return;
    await api(`/api/campaigns/${campaignId}/maps/${mapId}/scenes/${scene.id}`, {
      method: "PUT",
      body: JSON.stringify({ announcement }),
    });
    await load();
  };

  const editEncounterGroup = async (scene: Scene) => {
    const choices = encounterGroups
      .map((group) => `${group.id}: ${group.name}`)
      .join("\n");
    const picked = prompt(
      `Prepared encounter group ID for "${scene.name}" (blank removes it):\n\n${choices}`,
      scene.encounterGroupId ? String(scene.encounterGroupId) : ""
    );
    if (picked === null) return;
    const groupId = Number(picked) || null;

    await api(`/api/campaigns/${campaignId}/maps/${mapId}/scenes/${scene.id}`, {
      method: "PUT",
      body: JSON.stringify({ encounterGroupId: groupId }),
    });

    if (!groupId) {
      await load();
      return;
    }

    const group = encounterGroups.find((candidate) => candidate.id === groupId);
    if (!group) {
      setError("That prepared encounter group could not be found.");
      await load();
      return;
    }
    beginPlacement(group, scene.id);
  };

  const recapture = async (scene: Scene) => {
    if (!confirm(`Replace "${scene.name}" with the current enemy positions, fog, and drawings?`)) return;
    setBusy(scene.id);
    await api(`/api/campaigns/${campaignId}/maps/${mapId}/scenes/${scene.id}/recapture`, {
      method: "POST",
    });
    await load();
    setBusy(null);
  };

  const duplicate = async (scene: Scene) => {
    await api(`/api/campaigns/${campaignId}/maps/${mapId}/scenes/${scene.id}/duplicate`, {
      method: "POST",
    });
    await load();
  };

  const remove = async (scene: Scene) => {
    if (!confirm(`Delete "${scene.name}"?`)) return;
    await api(`/api/campaigns/${campaignId}/maps/${mapId}/scenes/${scene.id}`, {
      method: "DELETE",
    });
    await load();
  };

  return createPortal(
    <>
      {isDM && (
        <button className="scene-director-button" type="button" onClick={() => setOpen(true)}>
          ◈ Scene Director
        </button>
      )}

      {open && isDM && (
        <div className="scene-director-backdrop" onClick={() => setOpen(false)}>
          <section className="scene-director-panel" onClick={(event) => event.stopPropagation()}>
            <div className="row-between">
              <div>
                <span className="scene-director-kicker">Selective snapshots</span>
                <h2>Scene Director</h2>
              </div>
              <button className="ghost mini" onClick={() => setOpen(false)}>×</button>
            </div>

            <p className="muted scene-director-explainer">
              Scenes restore enemy/custom tokens, fog, and drawings. Player tokens and interactive
              objects are always preserved.
            </p>

            {error && <div className="error">{error}</div>}

            <form className="scene-director-new stack" onSubmit={saveScene}>
              <label>
                Scene name
                <input name="name" placeholder="Grimm ambush" required />
              </label>
              <label>
                Prepared encounter group
                <select
                  value={newEncounterGroupId}
                  onChange={(event) => {
                    setNewEncounterGroupId(event.target.value);
                    setNewEncounterPlacement(null);
                  }}
                >
                  <option value="">None — use only captured map tokens</option>
                  {encounterGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.members.length})
                    </option>
                  ))}
                </select>
              </label>
              {newEncounterGroupId && (
                <div className="scene-director-placement-row">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      const group = encounterGroups.find(
                        (candidate) => candidate.id === Number(newEncounterGroupId)
                      );
                      if (group) beginPlacement(group);
                    }}
                  >
                    {newEncounterPlacement ? "Change placement on map" : "Choose placement on map"}
                  </button>
                  <span className={newEncounterPlacement ? "placement-ready" : "muted"}>
                    {newEncounterPlacement ? "✓ Placement selected" : "Click the map where the group should appear"}
                  </span>
                </div>
              )}
              <label>
                Activation announcement
                <textarea name="announcement" rows={2} placeholder="A howl tears through the forest..." />
              </label>
              <button
                disabled={
                  busy === "new" ||
                  (Boolean(newEncounterGroupId) && !newEncounterPlacement)
                }
              >
                {busy === "new" ? "Saving..." : "Save current encounter"}
              </button>
            </form>

            <div className="scene-director-list">
              {scenes.length === 0 && <p className="muted">No scenes saved for this map yet.</p>}
              {scenes.map((scene) => (
                <article className="scene-director-card" key={scene.id}>
                  <div className="row-between">
                    <div>
                      <h3>{scene.name}</h3>
                      <span className="muted">{scene.enemyCount} encounter token{scene.enemyCount === 1 ? "" : "s"}</span>
                    </div>
                    <button disabled={busy === scene.id} onClick={() => activate(scene)}>
                      {busy === scene.id ? "Working..." : "Activate"}
                    </button>
                  </div>
                  {scene.encounterGroupName && (
                    <p className="scene-director-linked-encounter">
                      Linked encounter: <strong>{scene.encounterGroupName}</strong> · placement saved
                    </p>
                  )}
                  {scene.announcement && <p className="scene-director-announcement">“{scene.announcement}”</p>}
                  <div className="scene-director-actions">
                    <button className="ghost mini" onClick={() => recapture(scene)}>Recapture</button>
                    <button className="ghost mini" onClick={() => rename(scene)}>Rename</button>
                    <button className="ghost mini" onClick={() => editAnnouncement(scene)}>Announcement</button>
                    <button className="ghost mini" onClick={() => editEncounterGroup(scene)}>Encounter</button>
                    {scene.encounterGroupId && (
                      <button
                        className="ghost mini"
                        onClick={() => {
                          const group = encounterGroups.find(
                            (candidate) => candidate.id === scene.encounterGroupId
                          );
                          if (group) beginPlacement(group, scene.id);
                        }}
                      >
                        Change placement
                      </button>
                    )}
                    <button className="ghost mini" onClick={() => duplicate(scene)}>Duplicate</button>
                    <button className="danger mini" onClick={() => remove(scene)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {notice && (
        <div className="scene-director-notice">
          <span>Scene transition</span>
          <strong>{notice}</strong>
        </div>
      )}
    </>,
    document.body
  );
}

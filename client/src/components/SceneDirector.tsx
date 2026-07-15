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
  createdAt: string;
  updatedAt: string;
}

interface Props {
  campaignId: number;
  mapId: number;
  isDM: boolean;
}

export default function SceneDirector({ campaignId, mapId, isDM }: Props) {
  const [open, setOpen] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [busy, setBusy] = useState<number | "new" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await api<{ scenes: Scene[] }>(
        `/api/campaigns/${campaignId}/maps/${mapId}/scenes`
      );
      setScenes(result.scenes);
    } catch (e: any) {
      setError(e.message);
    }
  }, [campaignId, mapId]);

  useEffect(() => {
    if (isDM) void load();
  }, [isDM, load]);

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
        }),
      });
      form.reset();
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
                Activation announcement
                <textarea name="announcement" rows={2} placeholder="A howl tears through the forest..." />
              </label>
              <button disabled={busy === "new"}>
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
                  {scene.announcement && <p className="scene-director-announcement">“{scene.announcement}”</p>}
                  <div className="scene-director-actions">
                    <button className="ghost mini" onClick={() => recapture(scene)}>Recapture</button>
                    <button className="ghost mini" onClick={() => rename(scene)}>Rename</button>
                    <button className="ghost mini" onClick={() => editAnnouncement(scene)}>Announcement</button>
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

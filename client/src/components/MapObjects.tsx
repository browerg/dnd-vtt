import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { io, type Socket } from "socket.io-client";
import { api } from "../api";

interface MapObject {
  id: number;
  mapId: number;
  type: string;
  name: string;
  description: string;
  dmNotes: string;
  loot: string;
  state: string;
  hidden: boolean;
  x: number;
  y: number;
  size: number;
  imageUrl: string;
  interactionLabel: string;
  triggerMessage: string;
  triggerState: string;
  revealObjectId: number | null;
}

interface Props {
  campaignId: number;
  mapId: number;
  isDM: boolean;
  gridSize: number;
}

const ICONS: Record<string, string> = {
  chest: "▣",
  door: "▥",
  trap: "⚠",
  switch: "◆",
  clue: "?",
  terminal: "⌘",
  dust: "✦",
  custom: "●",
};

const TYPES = ["chest", "door", "trap", "switch", "clue", "terminal", "dust", "custom"];
const STATES = ["closed", "open", "locked", "unlocked", "armed", "disarmed", "active", "inactive"];

export default function MapObjects({ campaignId, mapId, isDM, gridSize }: Props) {
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [selected, setSelected] = useState<MapObject | null>(null);
  const [viewing, setViewing] = useState<MapObject | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [triggerNotice, setTriggerNotice] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api<{ objects: MapObject[] }>(
        `/api/campaigns/${campaignId}/maps/${mapId}/objects`
      );
      setObjects(result.objects);
      setSelected((current) =>
        current ? result.objects.find((item) => item.id === current.id) ?? null : null
      );
    } catch (e: any) {
      setError(e.message);
    }
  }, [campaignId, mapId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.emit("campaign:join", campaignId);
    socket.on("map-object:update", (message: { campaignId: number; mapId: number }) => {
      if (message.campaignId === campaignId && message.mapId === mapId) void load();
    });
    socket.on("map-object:trigger", (message: { campaignId: number; mapId: number; message: string }) => {
      if (message.campaignId !== campaignId || message.mapId !== mapId) return;
      setTriggerNotice(message.message);
      window.setTimeout(() => setTriggerNotice(""), 4200);
    });
    return () => {
      socket.emit("campaign:leave", campaignId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [campaignId, mapId, load]);

  const patchObject = async (object: MapObject, patch: Partial<MapObject>) => {
    const optimistic = { ...object, ...patch };
    setObjects((current) => current.map((item) => (item.id === object.id ? optimistic : item)));
    setSelected((current) => (current?.id === object.id ? optimistic : current));
    try {
      const result = await api<{ object: MapObject }>(
        `/api/campaigns/${campaignId}/maps/${mapId}/objects/${object.id}`,
        { method: "PUT", body: JSON.stringify(patch) }
      );
      setObjects((current) => current.map((item) => (item.id === object.id ? result.object : item)));
      setSelected((current) => (current?.id === object.id ? result.object : current));
    } catch (e: any) {
      setError(e.message);
      void load();
    }
  };

  const beginDrag = (event: ReactPointerEvent, object: MapObject) => {
    if (!isDM) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: object.id,
      offsetX: event.clientX - object.x,
      offsetY: event.clientY - object.y,
    };
    setSelected(object);
  };

  const drag = (event: ReactPointerEvent, object: MapObject) => {
    const active = dragRef.current;
    if (!active || active.id !== object.id || !isDM) return;
    event.stopPropagation();
    const next = {
      x: event.clientX - active.offsetX,
      y: event.clientY - active.offsetY,
    };
    setObjects((current) =>
      current.map((item) => (item.id === object.id ? { ...item, ...next } : item))
    );
    setSelected((current) => (current?.id === object.id ? { ...current, ...next } : current));
  };

  const endDrag = (event: ReactPointerEvent, object: MapObject) => {
    const active = dragRef.current;
    if (!active || active.id !== object.id || !isDM) return;
    event.stopPropagation();
    dragRef.current = null;
    const latest = objects.find((item) => item.id === object.id) ?? object;
    void patchObject(object, { x: latest.x, y: latest.y });
  };

  const addObject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("x", "400");
    data.set("y", "300");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/maps/${mapId}/objects`, {
        method: "POST",
        body: data,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not add object.");
      setAdding(false);
      form.reset();
      await load();
      setSelected(result.object);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const input = form.elements.namedItem("image") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("image", file);
    setBusy(true);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/maps/${mapId}/objects/${selected.id}/image`,
        { method: "POST", body }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Image upload failed.");
      setSelected(result.object);
      await load();
      form.reset();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const interactWithObject = async (object: MapObject) => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ object: MapObject; message: string }>(
        `/api/campaigns/${campaignId}/maps/${mapId}/objects/${object.id}/interact`,
        { method: "POST" }
      );
      setViewing(result.object);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeObject = async (object: MapObject) => {
    if (!confirm(`Delete ${object.name}?`)) return;
    await api(`/api/campaigns/${campaignId}/maps/${mapId}/objects/${object.id}`, {
      method: "DELETE",
    });
    setSelected(null);
    await load();
  };

  const duplicateObject = async (object: MapObject) => {
    await api(`/api/campaigns/${campaignId}/maps/${mapId}/objects/${object.id}/duplicate`, {
      method: "POST",
    });
    await load();
  };

  return (
    <>
      <div className="map-object-layer">
        {objects.map((object) => {
          const px = object.size * gridSize;
          return (
            <button
              key={object.id}
              type="button"
              className={`map-object map-object-${object.type}${object.hidden ? " is-hidden" : ""}${
                selected?.id === object.id ? " is-selected" : ""
              }`}
              style={{ left: object.x - px / 2, top: object.y - px / 2, width: px, height: px }}
              title={isDM && object.hidden ? `${object.name} (hidden)` : object.name}
              onPointerDown={(event) => beginDrag(event, object)}
              onPointerMove={(event) => drag(event, object)}
              onPointerUp={(event) => endDrag(event, object)}
              onClick={(event) => {
                event.stopPropagation();
                if (isDM) setSelected(object);
                else setViewing(object);
              }}
            >
              {object.imageUrl ? (
                <img src={object.imageUrl} alt="" draggable={false} />
              ) : (
                <span className="map-object-icon">{ICONS[object.type] ?? ICONS.custom}</span>
              )}
              <span className="map-object-label">{object.name}</span>
              {isDM && object.hidden && <span className="map-object-hidden-badge">DM</span>}
            </button>
          );
        })}
      </div>

      {createPortal(
        <>
          {isDM && (
            <button
              type="button"
              className="map-object-add-button"
              onClick={() => {
                setAdding(true);
                setSelected(null);
              }}
            >
              + Map object
            </button>
          )}

          {(adding || selected) && isDM && (
            <div className="map-object-editor" onPointerDown={(event) => event.stopPropagation()}>
              <div className="row-between">
                <h3>{adding ? "Add map object" : selected?.name}</h3>
                <button className="ghost mini" onClick={() => { setAdding(false); setSelected(null); }}>×</button>
              </div>
              {error && <div className="error">{error}</div>}

              {adding ? (
                <form className="stack" onSubmit={addObject}>
                  <label>Type<select name="type" defaultValue="chest">{TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
                  <label>Name<input name="name" defaultValue="Treasure chest" required /></label>
                  <label>Player description<textarea name="description" rows={3} /></label>
                  <label>DM notes<textarea name="dmNotes" rows={2} /></label>
                  <label>Loot<textarea name="loot" rows={2} /></label>
                  <label>State<select name="state" defaultValue="closed">{STATES.map((state) => <option key={state}>{state}</option>)}</select></label>
                  <label>Size<select name="size" defaultValue="1"><option value=".5">Half square</option><option value="1">1 square</option><option value="2">2 × 2</option><option value="3">3 × 3</option><option value="4">4 × 4</option></select></label>
                  <label>Artwork<input name="image" type="file" accept="image/png,image/jpeg,image/webp" /></label>
                  <label className="map-object-check"><input name="hidden" type="checkbox" value="true" /> Hidden from players</label>
                  <button disabled={busy}>{busy ? "Adding..." : "Add object"}</button>
                </form>
              ) : selected ? (
                <div className="stack">
                  <label>Name<input value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} onBlur={() => patchObject(selected, { name: selected.name })} /></label>
                  <label>Type<select value={selected.type} onChange={(e) => patchObject(selected, { type: e.target.value })}>{TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
                  <label>State<select value={selected.state} onChange={(e) => patchObject(selected, { state: e.target.value })}>{STATES.map((state) => <option key={state}>{state}</option>)}</select></label>
                  <label>Player description<textarea rows={3} value={selected.description} onChange={(e) => setSelected({ ...selected, description: e.target.value })} onBlur={() => patchObject(selected, { description: selected.description })} /></label>
                  <label>Loot<textarea rows={2} value={selected.loot} onChange={(e) => setSelected({ ...selected, loot: e.target.value })} onBlur={() => patchObject(selected, { loot: selected.loot })} /></label>
                  <label>DM notes<textarea rows={2} value={selected.dmNotes} onChange={(e) => setSelected({ ...selected, dmNotes: e.target.value })} onBlur={() => patchObject(selected, { dmNotes: selected.dmNotes })} /></label>
                  <fieldset className="map-object-trigger-fields">
                    <legend>Object trigger</legend>
                    <label>Interaction button<input value={selected.interactionLabel} placeholder="Open chest" onChange={(e) => setSelected({ ...selected, interactionLabel: e.target.value })} onBlur={() => patchObject(selected, { interactionLabel: selected.interactionLabel })} /></label>
                    <label>Announcement<textarea rows={2} value={selected.triggerMessage} placeholder="The lock snaps open..." onChange={(e) => setSelected({ ...selected, triggerMessage: e.target.value })} onBlur={() => patchObject(selected, { triggerMessage: selected.triggerMessage })} /></label>
                    <label>Change state<select value={selected.triggerState} onChange={(e) => patchObject(selected, { triggerState: e.target.value })}><option value="">No state change</option>{STATES.map((state) => <option key={state}>{state}</option>)}</select></label>
                    <label>Reveal hidden object<select value={selected.revealObjectId ?? ""} onChange={(e) => patchObject(selected, { revealObjectId: e.target.value ? Number(e.target.value) : null })}><option value="">Reveal nothing</option>{objects.filter((item) => item.id !== selected.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                  </fieldset>
                  <label>Size<input type="range" min=".5" max="4" step=".25" value={selected.size} onChange={(e) => setSelected({ ...selected, size: Number(e.target.value) })} onPointerUp={() => patchObject(selected, { size: selected.size })} /></label>
                  <label className="map-object-check"><input type="checkbox" checked={selected.hidden} onChange={(e) => patchObject(selected, { hidden: e.target.checked })} /> Hidden from players</label>
                  <form className="stack" onSubmit={uploadImage}>
                    <input name="image" type="file" accept="image/png,image/jpeg,image/webp" required />
                    <button className="ghost mini" disabled={busy}>{selected.imageUrl ? "Replace artwork" : "Upload artwork"}</button>
                  </form>
                  <div className="map-object-actions">
                    <button className="ghost mini" onClick={() => setViewing(selected)}>Preview</button>
                    <button className="ghost mini" onClick={() => duplicateObject(selected)}>Duplicate</button>
                    <button className="danger mini" onClick={() => removeObject(selected)}>Delete</button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {triggerNotice && <div className="map-object-trigger-notice">{triggerNotice}</div>}
          {viewing && (
            <div className="map-object-modal-backdrop" onClick={() => setViewing(null)}>
              <article className="map-object-modal" onClick={(event) => event.stopPropagation()}>
                <button className="map-object-modal-close" onClick={() => setViewing(null)}>×</button>
                {viewing.imageUrl && <img src={viewing.imageUrl} alt="" />}
                <span className="map-object-type">{viewing.type} · {viewing.state}</span>
                <h2>{viewing.name}</h2>
                <p>{viewing.description || "There is nothing obvious to learn from it yet."}</p>
                {viewing.interactionLabel && (
                  <button
                    type="button"
                    className="map-object-interact-button"
                    disabled={busy}
                    onClick={() => interactWithObject(viewing)}
                  >
                    {busy ? "Working..." : viewing.interactionLabel}
                  </button>
                )}
                {viewing.loot &&
                  (isDM || viewing.type !== "chest" || viewing.state === "open") && (
                    <div className="map-object-loot">
                      <strong>Contents</strong>
                      <p>{viewing.loot}</p>
                    </div>
                  )}
                {viewing.type === "chest" &&
                  viewing.loot &&
                  !isDM &&
                  viewing.state !== "open" && (
                    <div className="map-object-loot is-locked">
                      <strong>Contents</strong>
                      <p>The contents are hidden until the chest is opened.</p>
                    </div>
                  )}
                {isDM && viewing.dmNotes && <div className="map-object-dm-notes"><strong>DM notes</strong><p>{viewing.dmNotes}</p></div>}
              </article>
            </div>
          )}
        </>,
        document.body
      )}
    </>
  );
}

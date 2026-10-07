import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, uploadItemImage } from "../api";
import { handleBulletKeyDown } from "../bulletList";
import type { Character } from "../sheet";
import { AtelierCharacterCard, AtelierMissionView } from "./AtelierPanels";
import { characterCard, parseMission } from "./atelierModel";

/** The player's own character as the comp's card; reloads when the roster does. */
export function AtelierCharacterLive({
  campaignId,
  characterId,
  refreshKey,
}: {
  campaignId: number;
  characterId: number;
  refreshKey: unknown;
}) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<{ character: Character; canEdit: boolean }>(`/api/campaigns/${campaignId}/characters/${characterId}`)
      .then((r) => {
        if (!active) return;
        setCharacter(r.character);
        setCanEdit(r.canEdit);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [campaignId, characterId, refreshKey]);

  // Upload through the sheet's image route, then store the URL on the sheet.
  const setWeaponImage = async (file: File) => {
    const url = await uploadItemImage(campaignId, characterId, file);
    const fresh = await api<{ character: Character }>(`/api/campaigns/${campaignId}/characters/${characterId}`);
    const data = { ...fresh.character.data, weaponImageUrl: url };
    await api(`/api/campaigns/${campaignId}/characters/${characterId}`, {
      method: "PUT",
      body: JSON.stringify({ name: fresh.character.name, data }),
    });
    setCharacter({ ...fresh.character, data });
  };

  if (error) return <p className="error small">{error}</p>;
  if (!character) return <p className="atelier-empty">Loading…</p>;
  return <AtelierCharacterCard card={characterCard(character, campaignId)} onWeaponImage={canEdit ? setWeaponImage : undefined} />;
}

/**
 * The private notes, read as a mission brief. Editing swaps in the same
 * autosaving notepad; leaving edit mode flushes any pending save first.
 */
export function AtelierMissionLive({
  campaignId,
  editing,
  onEdit,
}: {
  campaignId: number;
  editing: boolean;
  onEdit: () => void;
}) {
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<number>();
  const pending = useRef<string | null>(null);

  useEffect(() => {
    setLoaded(false);
    api<{ body: string }>(`/api/campaigns/${campaignId}/notes`)
      .then((r) => setBody(r.body))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [campaignId]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (pending.current == null) return;
    const text = pending.current;
    pending.current = null;
    try {
      await api(`/api/campaigns/${campaignId}/notes`, { method: "PUT", body: JSON.stringify({ body: text }) });
      setState("saved");
    } catch {
      setState("error");
    }
  }, [campaignId]);

  useEffect(() => {
    if (!editing) void flush();
  }, [editing, flush]);
  useEffect(() => () => void flush(), [flush]);

  const mission = useMemo(() => parseMission(body), [body]);

  if (!editing) return <AtelierMissionView mission={mission} onEdit={onEdit} />;

  return (
    <div className="notes-panel atelier-notes-edit">
      <div className="notes-head">
        <span className="muted small">🔒 Private to you · first line is the title, • lines are steps, 📍 sets the place</span>
        <span className={`save-state small ${state}`}>
          {state === "saving" ? "Saving…" : state === "error" ? "Save failed!" : state === "saved" ? "Saved" : ""}
        </span>
      </div>
      <textarea
        className="notes-area"
        autoFocus
        disabled={!loaded}
        value={body}
        placeholder={"Investigate the Emerald Forest\n📍 Mistral Region\nWhat the Council asked for…\n• Locate the source\nTrack the Grimm presence."}
        onKeyDown={handleBulletKeyDown}
        onChange={(e) => {
          setBody(e.target.value);
          pending.current = e.target.value;
          setState("saving");
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => void flush(), 600);
        }}
      />
      <button type="button" className="atelier-done" onClick={onEdit}>
        Done
      </button>
    </div>
  );
}

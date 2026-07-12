import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api } from "./api";
import { useAuth } from "./App";
import type { Character } from "./sheet";

// Load a character, autosave edits (debounced), and stay live-synced with other
// editors — the same machinery SheetView uses internally, factored out so the
// Inventory panel (or any focused editor) can drive one field without stomping
// the rest of the sheet.
export function useCharacterData(campaignId: number, characterId: number | null) {
  const { user } = useAuth();
  const [character, setCharacter] = useState<Character | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const saveTimer = useRef<number>();
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!characterId) {
      setCharacter(null);
      return;
    }
    api<{ character: Character; canEdit: boolean }>(`/api/campaigns/${campaignId}/characters/${characterId}`)
      .then((r) => {
        setCharacter(r.character);
        setCanEdit(r.canEdit);
      })
      .catch(() => {});
  }, [campaignId, characterId]);

  useEffect(() => {
    if (!characterId) return;
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("character:update", (msg: { campaignId: number; updatedBy: number; character: Character }) => {
      if (msg.campaignId !== campaignId || msg.character.id !== characterId) return;
      if (msg.updatedBy === user?.id) return;
      if (dirtyRef.current) return; // never stomp our own unsaved edits
      setCharacter(msg.character);
    });
    return () => {
      socket.disconnect();
    };
  }, [campaignId, characterId, user?.id]);

  const persist = useCallback(
    (next: Character) => {
      window.clearTimeout(saveTimer.current);
      setSaveState("saving");
      saveTimer.current = window.setTimeout(async () => {
        try {
          await api(`/api/campaigns/${campaignId}/characters/${characterId}`, {
            method: "PUT",
            body: JSON.stringify({ name: next.name, data: next.data }),
          });
          dirtyRef.current = false;
          setSaveState("saved");
        } catch {
          setSaveState("error");
        }
      }, 700);
    },
    [campaignId, characterId]
  );

  const update = useCallback(
    (patch: Record<string, unknown>) => {
      setCharacter((prev) => {
        if (!prev) return prev;
        const next = { ...prev, data: { ...prev.data, ...patch } };
        dirtyRef.current = true;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return { character, canEdit, saveState, update };
}

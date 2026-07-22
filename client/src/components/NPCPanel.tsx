import { useState } from "react";
import { api } from "../api";
import SheetView from "./SheetView";
import type { PanelCtx } from "../dashboard/panels";

export default function NPCPanel({ ctx }: { ctx: PanelCtx }) {
  const { campaignId, isDM, characters, members, myId } = ctx;
  const npcs = characters.filter(
    (character) =>
      character.isNpc &&
      (isDM || character.assignedPlayerIds?.includes(myId))
  );
  const players = members.filter((member) => member.role === "player");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const activeId =
    selectedId && npcs.some((npc) => npc.id === selectedId)
      ? selectedId
      : npcs[0]?.id ?? null;
  const active = npcs.find((npc) => npc.id === activeId);

  const createNpc = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const response = await api<{ id: number }>(
        `/api/campaigns/${campaignId}/characters`,
        {
          method: "POST",
          body: JSON.stringify({ name, isNpc: true }),
        }
      );
      setNewName("");
      setSelectedId(response.id);
    } finally {
      setBusy(false);
    }
  };

  const assignPlayer = async (playerId: number, assigned: boolean) => {
    if (!active) return;

    const current = active.assignedPlayerIds ?? [];
    const playerIds = assigned
      ? [...new Set([...current, playerId])]
      : current.filter((id) => id !== playerId);

    setAssigning(true);
    try {
      await api(
        `/api/campaigns/${campaignId}/characters/${active.id}/npc-control`,
        {
          method: "POST",
          body: JSON.stringify({ playerIds }),
        }
      );
    } finally {
      setAssigning(false);
    }
  };

  const deleteNpc = async (id: number, name: string) => {
    if (!window.confirm(`Delete NPC â€œ${name}â€? This removes its sheet for good.`)) return;
    setSelectedId(null);
    await api(`/api/campaigns/${campaignId}/characters/${id}`, {
      method: "DELETE",
    }).catch(() => {});
  };

  return (
    <div className="npc-panel">
      <div className="npc-tabs">
        {npcs.map((npc) => (
          <button
            key={npc.id}
            className={`npc-tab${npc.id === activeId ? " active" : ""}`}
            onClick={() => setSelectedId(npc.id)}
            title={npc.name}
          >
            {npc.portraitUrl ? (
              <img className="npc-tab-face" src={npc.portraitUrl} alt="" />
            ) : (
              <span className="npc-tab-face npc-tab-initial">
                {npc.name[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            <span className="npc-tab-name">{npc.name}</span>
            {!!npc.assignedPlayerIds?.length && (
              <span
                className="npc-tab-flag"
                title={`Assigned to ${npc.assignedPlayerIds.length} player${npc.assignedPlayerIds.length === 1 ? "" : "s"}`}
              >
                ðŸ‘¤{npc.assignedPlayerIds.length}
              </span>
            )}
          </button>
        ))}

        {isDM && (
          <span className="npc-new">
            <input
              placeholder="New NPCâ€¦"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createNpc();
              }}
            />
            <button
              className="ghost mini"
              disabled={busy || !newName.trim()}
              onClick={createNpc}
            >
              + NPC
            </button>
          </span>
        )}
      </div>

      {isDM && active && (
        <div className="npc-actions npc-assignment-area">
          <div className="npc-assignment-heading row-between">
            <span>
              <strong>Player control</strong>
              <span className="muted small">
                Choose exactly who can use {active.name}.
              </span>
            </span>
            <button
              className="ghost mini npc-delete"
              onClick={() => deleteNpc(active.id, active.name)}
            >
              Delete NPC
            </button>
          </div>

          <div className="npc-player-assignment-list">
            {players.length === 0 && (
              <span className="muted small">
                No players have joined this campaign yet.
              </span>
            )}

            {players.map((player) => {
              const checked =
                active.assignedPlayerIds?.includes(player.id) ?? false;

              return (
                <label key={player.id} className="npc-player-assignment">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={assigning}
                    onChange={(event) =>
                      assignPlayer(player.id, event.target.checked)
                    }
                  />
                  <span>{player.display_name}</span>
                  {checked && <span className="badge">Assigned</span>}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {activeId ? (
        <SheetView
          key={activeId}
          campaignId={campaignId}
          characterId={activeId}
        />
      ) : (
        <p className="muted npc-empty">
          {isDM
            ? "No NPCs yet â€” name one above and hit â€œ+ NPCâ€."
            : "No NPCs have been assigned to you yet."}
        </p>
      )}
    </div>
  );
}
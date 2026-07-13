import { useState } from "react";
import { api } from "../api";
import SheetView from "./SheetView";
import type { PanelCtx } from "../dashboard/panels";

// The DM's NPC roster as tabs across the top — click one to run it (its full
// sheet, with click-to-roll). The DM can add NPCs and hand any of them to the
// players; players only see the NPCs they're allowed to drive.
export default function NPCPanel({ ctx }: { ctx: PanelCtx }) {
  const { campaignId, isDM, characters } = ctx;
  const npcs = characters.filter((c) => c.isNpc && (isDM || c.playerControllable));

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  // Fall back to the first NPC if nothing valid is selected.
  const activeId = selectedId && npcs.some((n) => n.id === selectedId) ? selectedId : npcs[0]?.id ?? null;
  const active = npcs.find((n) => n.id === activeId);

  const createNpc = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const r = await api<{ id: number }>(`/api/campaigns/${campaignId}/characters`, {
        method: "POST",
        body: JSON.stringify({ name, isNpc: true }),
      });
      setNewName("");
      setSelectedId(r.id);
    } finally {
      setBusy(false);
    }
  };

  const toggleControl = async (id: number, on: boolean) => {
    await api(`/api/campaigns/${campaignId}/characters/${id}/npc-control`, {
      method: "POST",
      body: JSON.stringify({ playerControllable: on }),
    }).catch(() => {});
    // ctx.characters refreshes via the character:update broadcast.
  };

  return (
    <div className="npc-panel">
      <div className="npc-tabs">
        {npcs.map((n) => (
          <button
            key={n.id}
            className={`npc-tab${n.id === activeId ? " active" : ""}`}
            onClick={() => setSelectedId(n.id)}
            title={n.name}
          >
            {n.portraitUrl ? (
              <img className="npc-tab-face" src={n.portraitUrl} alt="" />
            ) : (
              <span className="npc-tab-face npc-tab-initial">{n.name[0]?.toUpperCase() ?? "?"}</span>
            )}
            <span className="npc-tab-name">{n.name}</span>
            {n.playerControllable && <span className="npc-tab-flag" title="Players can control">👤</span>}
          </button>
        ))}
        {isDM && (
          <span className="npc-new">
            <input
              placeholder="New NPC…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createNpc();
              }}
            />
            <button className="ghost mini" disabled={busy || !newName.trim()} onClick={createNpc}>
              + NPC
            </button>
          </span>
        )}
      </div>

      {isDM && active && (
        <label className="npc-control-toggle muted small">
          <input
            type="checkbox"
            checked={!!active.playerControllable}
            onChange={(e) => toggleControl(active.id, e.target.checked)}
          />
          Players can control {active.name}
        </label>
      )}

      {activeId ? (
        <SheetView key={activeId} campaignId={campaignId} characterId={activeId} />
      ) : (
        <p className="muted npc-empty">
          {isDM ? "No NPCs yet — name one above and hit “+ NPC”." : "No NPCs have been handed to you yet."}
        </p>
      )}
    </div>
  );
}

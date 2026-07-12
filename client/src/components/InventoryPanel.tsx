import { Link } from "react-router-dom";
import { uploadItemImage } from "../api";
import { useCharacterData } from "../useCharacterData";
import InventoryEditor from "./InventoryEditor";
import type { InventoryItem } from "../sheet";

// Standalone Inventory panel: shows the viewer's own character's money + carried
// items, editable and autosaving, for both systems (Gold/5e, Lien/Remnant).
export default function InventoryPanel({
  campaignId,
  characterId,
}: {
  campaignId: number;
  characterId: number | null;
}) {
  const { character, canEdit, saveState, update } = useCharacterData(campaignId, characterId);

  if (!characterId) {
    return (
      <div className="panel-empty muted">
        <p>You don't have a character in this campaign yet.</p>
        <Link className="ghost link" to={`/campaigns/${campaignId}/hub`}>
          Create one on the hub →
        </Link>
      </div>
    );
  }
  if (!character) return <p className="muted">Loading…</p>;

  // Same JSON blob as the sheet; the system tag decides which money field is money.
  const d = character.data as unknown as {
    system?: string;
    inventory?: InventoryItem[];
    gold?: number;
    lien?: number;
  };
  const isRemnant = d.system === "remnant";
  const money = isRemnant ? d.lien ?? 0 : d.gold ?? 0;

  return (
    <div className="stack">
      <div className="row-between">
        <strong>{character.name}</strong>
        <span className="save-state small">
          {canEdit ? (saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed!" : "Saved") : "view only"}
        </span>
      </div>
      <InventoryEditor
        items={d.inventory}
        money={money}
        moneyLabel={isRemnant ? "Lien 🪙" : "Gold 🪙"}
        ro={!canEdit}
        onItems={(inv) => update({ inventory: inv })}
        onMoney={(n) => update(isRemnant ? { lien: n } : { gold: n })}
        onUpload={(file) => uploadItemImage(campaignId, characterId, file)}
      />
    </div>
  );
}

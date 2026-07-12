import { useState } from "react";
import type { InventoryItem } from "../sheet";

interface Props {
  items: InventoryItem[] | undefined;
  money: number;
  moneyLabel: string; // e.g. "Gold 🪙" or "Lien 🪙"
  ro: boolean;
  onItems: (items: InventoryItem[]) => void;
  onMoney: (n: number) => void;
  onUpload?: (file: File) => Promise<string>; // returns stored image URL; enables photos
}

const num = (v: string, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
};

// Money + a carried-items list. Each item expands to a description and (when an
// uploader is provided) a photo. Reused by the character sheets and the
// standalone Inventory dashboard panel so they stay in lock-step.
export default function InventoryEditor({ items, money, moneyLabel, ro, onItems, onMoney, onUpload }: Props) {
  const list = items ?? [];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const patchItem = (id: string, patch: Partial<InventoryItem>) =>
    onItems(list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const addItem = () => {
    const id = crypto.randomUUID();
    onItems([...list, { id, name: "", qty: 1, weight: 0, equipped: false }]);
    setExpanded((prev) => new Set(prev).add(id)); // open new items so the description/photo are right there
  };

  const uploadFor = async (id: string, file: File) => {
    if (!onUpload) return;
    setError("");
    setUploading(id);
    try {
      patchItem(id, { imageUrl: await onUpload(file) });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="inventory-editor stack">
      <label className="gold money-row">
        {moneyLabel}
        <input type="number" value={money} disabled={ro} onChange={(e) => onMoney(num(e.target.value))} />
      </label>
      <ul className="item-list">
        {list.map((item) => {
          const open = expanded.has(item.id);
          return (
            <li key={item.id} className="inv-item">
              <div className="item-row">
                <input
                  type="checkbox"
                  title="Equipped"
                  checked={item.equipped}
                  disabled={ro}
                  onChange={() => patchItem(item.id, { equipped: !item.equipped })}
                />
                {item.imageUrl && <img className="item-thumb" src={item.imageUrl} alt="" />}
                <input
                  className="item-name"
                  placeholder="Item"
                  value={item.name}
                  disabled={ro}
                  onChange={(e) => patchItem(item.id, { name: e.target.value })}
                />
                <input
                  type="number"
                  className="item-qty"
                  title="Quantity"
                  value={item.qty}
                  disabled={ro}
                  onChange={(e) => patchItem(item.id, { qty: num(e.target.value, 1) })}
                />
                <button
                  type="button"
                  className={`ghost mini item-expand${item.description || item.imageUrl ? " has-detail" : ""}`}
                  title={open ? "Hide details" : "Description & photo"}
                  onClick={() => toggleExpand(item.id)}
                >
                  {open ? "▾" : "▸"}
                </button>
                {!ro && (
                  <button
                    type="button"
                    className="ghost mini"
                    title="Remove"
                    onClick={() => onItems(list.filter((i) => i.id !== item.id))}
                  >
                    ✕
                  </button>
                )}
              </div>
              {open && (
                <div className="inv-detail stack">
                  <textarea
                    className="inv-desc"
                    rows={2}
                    placeholder="Description — what it is, what it does…"
                    value={item.description ?? ""}
                    disabled={ro}
                    onChange={(e) => patchItem(item.id, { description: e.target.value })}
                  />
                  {onUpload && (item.imageUrl ? (
                    <div className="inv-photo">
                      <img className="inv-photo-preview" src={item.imageUrl} alt={item.name} />
                      {!ro && (
                        <button type="button" className="ghost mini" onClick={() => patchItem(item.id, { imageUrl: undefined })}>
                          Remove photo
                        </button>
                      )}
                    </div>
                  ) : !ro ? (
                    <label className="ghost mini photo-btn">
                      {uploading === item.id ? "Uploading…" : "📷 Add photo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        hidden
                        disabled={uploading === item.id}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadFor(item.id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ) : null)}
                </div>
              )}
            </li>
          );
        })}
        {list.length === 0 && <li className="muted small">Nothing carried yet.</li>}
      </ul>
      {error && <div className="error">{error}</div>}
      {!ro && (
        <button type="button" className="ghost" onClick={addItem}>
          + Add item
        </button>
      )}
    </div>
  );
}

import { useState, type ChangeEvent } from "react";
import type { ShopTopic } from "./ShopBoard";
import "./ShopBoard.css";

/** A shopkeeper packed into a prepared token: dialogue plus wares. */
export interface ShopKit {
  greeting: string;
  topics: ShopTopic[];
  waresLabel: string;
  items: ShopKitItem[];
}

interface ShopKitItem {
  name: string;
  description: string;
  price: number;
  stock: number | null;
  imageUrl: string;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const starterShopKit = (): ShopKit => ({
  greeting: "Welcome, traveller. Take a look around.",
  topics: [{ id: newId(), question: "What do you sell?", answer: "" }],
  waresLabel: "",
  items: [],
});

/**
 * Edits a shopkeeper that's still in the Prepared Tokens tray. Unlike the
 * on-map editor nothing saves until "Save shopkeeper" — the kit is stored on
 * the prepared token and unpacked when it's placed on a board.
 */
export default function ShopKitEditor({
  campaignId,
  name,
  initial,
  onSave,
  onClose,
}: {
  campaignId: number;
  name: string;
  initial: ShopKit;
  onSave: (kit: ShopKit | null) => Promise<void>;
  onClose: () => void;
}) {
  // Items carry a client-only key so React keeps inputs stable while editing.
  const [kit, setKit] = useState(() => ({
    ...initial,
    topics: initial.topics.map((topic) => ({ ...topic })),
    items: initial.items.map((item) => ({ ...item, key: newId() })),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const patchItem = (index: number, patch: Partial<ShopKitItem>) =>
    setKit((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  const patchTopic = (index: number, patch: Partial<ShopTopic>) =>
    setKit((current) => ({
      ...current,
      topics: current.topics.map((topic, i) => (i === index ? { ...topic, ...patch } : topic)),
    }));

  const uploadArt = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const body = new FormData();
    body.append("image", file);
    const response = await fetch(`/api/campaigns/${campaignId}/shop/art`, { method: "POST", body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error ?? "Image upload failed.");
    else patchItem(index, { imageUrl: result.url });
  };

  const save = async (next: ShopKit | null) => {
    setBusy(true);
    setError("");
    try {
      await onSave(next);
      onClose();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  const kitToSave = (): ShopKit => ({
    greeting: kit.greeting,
    topics: kit.topics,
    waresLabel: kit.waresLabel,
    items: kit.items.map(({ key: _key, ...item }) => item),
  });

  return (
    <div className="bshop-backdrop" onClick={onClose}>
      <article
        className="bshop-dialog is-wares bshop-editor-shell"
        role="dialog"
        aria-label={`${name} shopkeeper`}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="bshop-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <header>
          <span className="bshop-eyebrow">Prepared shopkeeper</span>
          <h2>{name}</h2>
          <p className="bshop-muted">Place {name} on any board and they arrive with this dialogue and these wares.</p>
        </header>
        {error && <div className="error">{error}</div>}

        <fieldset className="bshop-fieldset">
          <legend>Dialogue</legend>
          <label>
            Greeting
            <textarea rows={3} value={kit.greeting} onChange={(e) => setKit({ ...kit, greeting: e.target.value })} />
          </label>
          {kit.topics.map((topic, index) => (
            <div key={topic.id} className="bshop-topic-edit">
              <label>
                Player asks
                <input
                  value={topic.question}
                  maxLength={120}
                  placeholder="What do you sell?"
                  onChange={(e) => patchTopic(index, { question: e.target.value })}
                />
              </label>
              <label>
                {name} answers
                <textarea rows={2} value={topic.answer} onChange={(e) => patchTopic(index, { answer: e.target.value })} />
              </label>
              <button
                type="button"
                className="ghost mini"
                onClick={() => setKit({ ...kit, topics: kit.topics.filter((_, i) => i !== index) })}
              >
                Remove topic
              </button>
            </div>
          ))}
          {kit.topics.length < 12 && (
            <button
              type="button"
              className="ghost mini"
              onClick={() => setKit({ ...kit, topics: [...kit.topics, { id: newId(), question: "", answer: "" }] })}
            >
              + Add topic
            </button>
          )}
          <label>
            Wares button
            <input
              value={kit.waresLabel}
              maxLength={60}
              placeholder="Show me your wares"
              onChange={(e) => setKit({ ...kit, waresLabel: e.target.value })}
            />
          </label>
        </fieldset>

        <fieldset className="bshop-fieldset">
          <legend>Wares</legend>
          {kit.items.map((item, index) => (
            <div key={item.key} className="bshop-item-edit">
              <div className="bshop-item-edit-row">
                {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className="bshop-ware-glyph" aria-hidden="true">✦</div>}
                <input
                  value={item.name}
                  aria-label="Item name"
                  maxLength={80}
                  placeholder="Item name"
                  onChange={(e) => patchItem(index, { name: e.target.value })}
                />
              </div>
              <textarea
                rows={2}
                placeholder="What it is, what it does"
                value={item.description}
                onChange={(e) => patchItem(index, { description: e.target.value })}
              />
              <div className="bshop-item-edit-row">
                <label>
                  Price
                  <input
                    type="number"
                    min={0}
                    value={item.price}
                    onChange={(e) => patchItem(index, { price: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  />
                </label>
                <label>
                  Stock
                  <input
                    type="number"
                    min={0}
                    placeholder="∞"
                    value={item.stock ?? ""}
                    onChange={(e) =>
                      patchItem(index, {
                        stock: e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      })
                    }
                  />
                </label>
              </div>
              <div className="bshop-item-edit-row">
                <label className="ghost mini bshop-file">
                  {item.imageUrl ? "Replace art" : "Add art"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadArt(index, e)} />
                </label>
                <button
                  type="button"
                  className="danger mini"
                  onClick={() => setKit({ ...kit, items: kit.items.filter((_, i) => i !== index) })}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="ghost mini"
            onClick={() =>
              setKit({
                ...kit,
                items: [...kit.items, { key: newId(), name: "New item", description: "", price: 10, stock: null, imageUrl: "" }],
              })
            }
          >
            + Add item
          </button>
        </fieldset>

        <div className="bshop-kit-actions">
          <button
            type="button"
            className="danger mini"
            disabled={busy}
            onClick={() => window.confirm(`Stop ${name} being a shopkeeper?`) && void save(null)}
          >
            Not a shopkeeper
          </button>
          <button type="button" disabled={busy} onClick={() => save(kitToSave())}>
            {busy ? "Saving…" : "Save shopkeeper"}
          </button>
        </div>
      </article>
    </div>
  );
}

import type { InventoryItem } from "../sheet";

interface Props {
  items: InventoryItem[] | undefined;
  money: number;
  moneyLabel: string; // e.g. "Gold 🪙" or "Lien 🪙"
  ro: boolean;
  onItems: (items: InventoryItem[]) => void;
  onMoney: (n: number) => void;
}

const num = (v: string, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
};

// Money + a carried-items list. Reused by the character sheets and the
// standalone Inventory dashboard panel so they stay in lock-step.
export default function InventoryEditor({ items, money, moneyLabel, ro, onItems, onMoney }: Props) {
  const list = items ?? [];
  return (
    <div className="inventory-editor stack">
      <label className="gold money-row">
        {moneyLabel}
        <input type="number" value={money} disabled={ro} onChange={(e) => onMoney(num(e.target.value))} />
      </label>
      <ul className="item-list">
        {list.map((item) => (
          <li key={item.id} className="item-row">
            <input
              type="checkbox"
              title="Equipped"
              checked={item.equipped}
              disabled={ro}
              onChange={() =>
                onItems(list.map((i) => (i.id === item.id ? { ...i, equipped: !i.equipped } : i)))
              }
            />
            <input
              className="item-name"
              placeholder="Item"
              value={item.name}
              disabled={ro}
              onChange={(e) => onItems(list.map((i) => (i.id === item.id ? { ...i, name: e.target.value } : i)))}
            />
            <input
              type="number"
              className="item-qty"
              title="Quantity"
              value={item.qty}
              disabled={ro}
              onChange={(e) =>
                onItems(list.map((i) => (i.id === item.id ? { ...i, qty: num(e.target.value, 1) } : i)))
              }
            />
            {!ro && (
              <button
                className="ghost mini"
                title="Remove"
                onClick={() => onItems(list.filter((i) => i.id !== item.id))}
              >
                ✕
              </button>
            )}
          </li>
        ))}
        {list.length === 0 && <li className="muted small">Nothing carried yet.</li>}
      </ul>
      {!ro && (
        <button
          className="ghost"
          onClick={() => onItems([...list, { id: crypto.randomUUID(), name: "", qty: 1, weight: 0, equipped: false }])}
        >
          + Add item
        </button>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { io, type Socket } from "socket.io-client";
import { api } from "../api";
import "./ShopBoard.css";

// Shop boards. A board whose purpose is "shop" lets the DM turn NPC tokens into
// shopkeepers: players click one to talk (a greeting plus DM-written topics),
// then browse the wares and request purchases. Requests wait for the DM, who
// can approve or deny each one — or all at once — while everyone keeps
// shopping. The server moves the money and the goods; this file only asks.

export interface ShopTopic {
  id: string;
  question: string;
  answer: string;
}

export interface ShopItem {
  id: number;
  tokenId: number;
  name: string;
  description: string;
  price: number;
  stock: number | null;
  available: number | null;
  imageUrl: string;
}

export interface Shopkeeper {
  tokenId: number;
  name: string;
  greeting: string;
  topics: ShopTopic[];
  waresLabel: string;
  items: ShopItem[];
}

interface ShopOrder {
  id: number;
  characterId: number;
  characterName: string;
  userId: number;
  userName: string;
  shopkeeperName: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  total: number;
  status: "pending" | "approved" | "denied" | "cancelled";
  note: string;
  balance: number;
}

interface Wallet {
  currency: string;
  characters: { id: number; name: string; balance: number; reserved: number; spendable: number }[];
}

export interface ShopKeeperToken {
  id: number;
  name: string;
  color: string;
  imageUrl: string;
  portraitUrl: string;
  ownerId: number | null;
}

export type ShopView = { tokenId: number; mode: "talk" | "edit" };

interface Props {
  campaignId: number;
  mapId: number;
  isShopBoard: boolean;
  /** DM controls on (false while a GM is viewing as a player). */
  isDM: boolean;
  tokens: ShopKeeperToken[];
  view: ShopView | null;
  onClose: () => void;
  /** Character whose token is on this board — the default buyer. */
  preferredCharacterId: number | null;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function KeeperPortrait({ token }: { token: ShopKeeperToken | undefined }) {
  const art = token?.imageUrl || token?.portraitUrl;
  return (
    <div className="bshop-keeper-portrait" style={{ background: art ? "transparent" : token?.color ?? "#5b4a7a" }}>
      {art ? <img src={art} alt="" /> : <span>{(token?.name ?? "?").slice(0, 1).toUpperCase()}</span>}
    </div>
  );
}

export default function ShopBoard({
  campaignId,
  mapId,
  isShopBoard,
  isDM,
  tokens,
  view,
  onClose,
  preferredCharacterId,
}: Props) {
  const [keeper, setKeeper] = useState<Shopkeeper | null>(null);
  const [keeperMissing, setKeeperMissing] = useState(false);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [toast, setToast] = useState("");
  const [trayOpen, setTrayOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(true);
  const [panelError, setPanelError] = useState("");
  const previousStatuses = useRef<Map<number, string> | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const loadKeeper = useCallback(async () => {
    const current = viewRef.current;
    if (!current) return;
    try {
      const result = await api<{ keeper: Shopkeeper }>(`/api/campaigns/${campaignId}/shop/keepers/${current.tokenId}`);
      if (viewRef.current?.tokenId !== current.tokenId) return;
      setKeeper(result.keeper);
      setKeeperMissing(false);
    } catch {
      if (viewRef.current?.tokenId !== current.tokenId) return;
      setKeeper(null);
      setKeeperMissing(true);
    }
  }, [campaignId]);

  const loadOrders = useCallback(async () => {
    try {
      const result = await api<{ orders: ShopOrder[] }>(`/api/campaigns/${campaignId}/shop/orders`);
      setOrders(result.orders);
    } catch {
      /* the next ping retries */
    }
  }, [campaignId]);

  const loadWallet = useCallback(async () => {
    try {
      setWallet(await api<Wallet>(`/api/campaigns/${campaignId}/shop/wallet`));
    } catch {
      /* the next ping retries */
    }
  }, [campaignId]);

  useEffect(() => {
    setKeeper(null);
    setKeeperMissing(false);
    if (view) void loadKeeper();
  }, [view?.tokenId, view?.mode, loadKeeper]);

  useEffect(() => {
    void loadOrders();
    void loadWallet();
  }, [loadOrders, loadWallet]);

  useEffect(() => {
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("shop:update", (msg: { campaignId: number }) => {
      if (msg.campaignId !== campaignId) return;
      void loadKeeper();
      void loadWallet();
    });
    socket.on("shop:orders", (msg: { campaignId: number }) => {
      if (msg.campaignId !== campaignId) return;
      void loadOrders();
      void loadWallet();
    });
    socket.on("character:update", (msg: { campaignId: number }) => {
      if (msg.campaignId === campaignId) void loadWallet();
    });
    return () => {
      socket.disconnect();
    };
  }, [campaignId, loadKeeper, loadOrders, loadWallet]);

  // Tell players when the DM settles one of their orders.
  useEffect(() => {
    const next = new Map(orders.map((order) => [order.id, order.status]));
    const before = previousStatuses.current;
    previousStatuses.current = next;
    if (!before || isDM) return;
    for (const order of orders) {
      if (before.get(order.id) !== "pending") continue;
      if (order.status === "approved") {
        setToast(`${order.itemName} is yours — it's in ${order.characterName}'s inventory.`);
      } else if (order.status === "denied") {
        setToast(`${order.shopkeeperName || "The shop"} turned down ${order.itemName}${order.note ? `: “${order.note}”` : "."}`);
      } else continue;
      window.setTimeout(() => setToast(""), 5200);
    }
  }, [orders, isDM]);

  const keeperToken = view ? tokens.find((token) => token.id === view.tokenId) : undefined;
  const pendingOrders = orders.filter((order) => order.status === "pending");
  const myOrders = orders;

  const settle = async (path: string, body?: unknown) => {
    setPanelError("");
    try {
      const result = await api<{ failed?: { orderId: number; error: string }[] }>(
        `/api/campaigns/${campaignId}/shop/orders/${path}`,
        { method: "POST", body: JSON.stringify(body ?? {}) }
      );
      if (result.failed?.length) {
        setPanelError(result.failed.map((f) => f.error).join(" "));
      }
    } catch (e: any) {
      setPanelError(e.message);
    }
    void loadOrders();
  };

  return createPortal(
    <>
      {view?.mode === "talk" && (
        <ShopkeeperDialog
          campaignId={campaignId}
          keeper={keeper}
          missing={keeperMissing}
          token={keeperToken}
          isDM={isDM}
          wallet={wallet}
          preferredCharacterId={preferredCharacterId}
          onClose={onClose}
          onOrdered={() => {
            void loadOrders();
            void loadWallet();
          }}
        />
      )}

      {view?.mode === "edit" && isDM && (
        <ShopkeeperEditor
          campaignId={campaignId}
          mapId={mapId}
          tokenId={view.tokenId}
          token={keeperToken}
          keeper={keeper}
          missing={keeperMissing}
          isShopBoard={isShopBoard}
          onClose={onClose}
          onChanged={loadKeeper}
        />
      )}

      {!isDM && isShopBoard && myOrders.length > 0 && (
        <div className={`bshop-tray${trayOpen ? " is-open" : ""}`}>
          <button type="button" className="bshop-tray-toggle" onClick={() => setTrayOpen((open) => !open)}>
            <span aria-hidden="true">🛒</span> My orders
            {pendingOrders.length > 0 && <span className="bshop-badge">{pendingOrders.length} pending</span>}
          </button>
          {trayOpen && (
            <ul className="bshop-order-list">
              {myOrders.map((order) => (
                <li key={order.id} className={`bshop-order is-${order.status}`}>
                  <div>
                    <strong>
                      {order.qty > 1 ? `${order.qty}× ` : ""}
                      {order.itemName}
                    </strong>
                    <small>
                      {order.characterName} · {order.total} {wallet?.currency ?? "Lien"}
                      {order.note ? ` · “${order.note}”` : ""}
                    </small>
                  </div>
                  <span className="bshop-status">{order.status}</span>
                  {order.status === "pending" && (
                    <button type="button" className="ghost mini" onClick={() => settle(`${order.id}/cancel`)}>
                      Cancel
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isDM && pendingOrders.length > 0 && (
        <section className={`bshop-requests${requestsOpen ? "" : " is-collapsed"}`} aria-label="Purchase requests">
          <header>
            <button type="button" className="bshop-requests-title" onClick={() => setRequestsOpen((open) => !open)}>
              <span aria-hidden="true">🛒</span> Purchase requests <span className="bshop-badge">{pendingOrders.length}</span>
            </button>
            {requestsOpen && pendingOrders.length > 1 && (
              <button type="button" className="mini" onClick={() => settle("approve-all")}>
                Approve all
              </button>
            )}
          </header>
          {requestsOpen && (
            <>
              {panelError && <div className="error">{panelError}</div>}
              <ul className="bshop-order-list">
                {pendingOrders.map((order) => {
                  const short = order.balance < order.total;
                  return (
                    <li key={order.id} className={`bshop-order is-pending${short ? " is-short" : ""}`}>
                      <div>
                        <strong>
                          {order.characterName}: {order.qty > 1 ? `${order.qty}× ` : ""}
                          {order.itemName}
                        </strong>
                        <small>
                          {order.total} {wallet?.currency ?? "Lien"} · has {order.balance}
                          {order.shopkeeperName ? ` · ${order.shopkeeperName}` : ""} · {order.userName}
                        </small>
                      </div>
                      <div className="bshop-order-actions">
                        <button
                          type="button"
                          className="mini"
                          disabled={short}
                          title={short ? "They can't afford this right now." : "Approve"}
                          onClick={() => settle(`${order.id}/approve`)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="ghost mini"
                          onClick={() => {
                            const note = window.prompt(`Deny ${order.itemName}? Add a reason for ${order.characterName} (optional):`, "");
                            if (note !== null) void settle(`${order.id}/deny`, { note });
                          }}
                        >
                          Deny
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {toast && <div className="bshop-toast" role="status">{toast}</div>}
    </>,
    document.body
  );
}

function ShopkeeperDialog({
  campaignId,
  keeper,
  missing,
  token,
  isDM,
  wallet,
  preferredCharacterId,
  onClose,
  onOrdered,
}: {
  campaignId: number;
  keeper: Shopkeeper | null;
  missing: boolean;
  token: ShopKeeperToken | undefined;
  isDM: boolean;
  wallet: Wallet | null;
  preferredCharacterId: number | null;
  onClose: () => void;
  onOrdered: () => void;
}) {
  const [page, setPage] = useState<"talk" | "wares">("talk");
  const [log, setLog] = useState<ShopTopic[]>([]);
  const [characterId, setCharacterId] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [log.length]);

  const characters = wallet?.characters ?? [];
  useEffect(() => {
    if (characterId && characters.some((c) => c.id === characterId)) return;
    const preferred = characters.find((c) => c.id === preferredCharacterId) ?? characters[0];
    setCharacterId(preferred?.id ?? null);
  }, [characters, characterId, preferredCharacterId]);
  const buyer = characters.find((c) => c.id === characterId) ?? null;
  const currency = wallet?.currency ?? "Lien";

  const request = async (item: ShopItem) => {
    if (!buyer) return;
    const qty = quantities[item.id] ?? 1;
    setBusyItem(item.id);
    setError("");
    setNotice("");
    try {
      await api(`/api/campaigns/${campaignId}/shop/orders`, {
        method: "POST",
        body: JSON.stringify({ itemId: item.id, qty, characterId: buyer.id }),
      });
      setNotice(`Requested ${qty > 1 ? `${qty}× ` : ""}${item.name}. The GM will confirm it.`);
      setQuantities((current) => ({ ...current, [item.id]: 1 }));
      onOrdered();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyItem(null);
    }
  };

  const name = keeper?.name ?? token?.name ?? "Shopkeeper";

  return (
    <div className="bshop-backdrop" onClick={onClose}>
      <article
        className={`bshop-dialog${page === "wares" ? " is-wares" : ""}`}
        role="dialog"
        aria-label={name}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="bshop-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <header className="bshop-dialog-head">
          <KeeperPortrait token={token} />
          <div>
            <span className="bshop-eyebrow">{page === "wares" ? "Wares" : "Shopkeeper"}</span>
            <h2>{name}</h2>
          </div>
        </header>

        {!keeper && missing && <p className="bshop-muted">The shop is closed right now.</p>}
        {!keeper && !missing && <p className="bshop-muted">…</p>}

        {keeper && page === "talk" && (
          <>
            <div className="bshop-conversation">
              <p className="bshop-line is-npc">{keeper.greeting || "Welcome, traveller. Take a look around."}</p>
              {log.map((topic, index) => (
                <div key={`${topic.id}-${index}`}>
                  <p className="bshop-line is-player">{topic.question}</p>
                  <p className="bshop-line is-npc">{topic.answer || "…"}</p>
                </div>
              ))}
              <div ref={logEnd} />
            </div>
            <div className="bshop-topics">
              {keeper.topics.map((topic) => (
                <button key={topic.id} type="button" className="bshop-reply" onClick={() => setLog((current) => [...current, topic])}>
                  {topic.question}
                </button>
              ))}
              <button type="button" className="bshop-wares-button" onClick={() => setPage("wares")}>
                {keeper.waresLabel || "Show me your wares"}
              </button>
            </div>
          </>
        )}

        {keeper && page === "wares" && (
          <>
            <div className="bshop-buyer-bar">
              <button type="button" className="ghost mini" onClick={() => setPage("talk")}>
                ‹ Talk
              </button>
              {isDM ? (
                <span className="bshop-muted">Preview — players buy from here.</span>
              ) : characters.length === 0 ? (
                <span className="bshop-muted">You need a character in this campaign to buy.</span>
              ) : (
                <label className="bshop-buyer">
                  {characters.length > 1 ? (
                    <select value={characterId ?? ""} onChange={(e) => setCharacterId(Number(e.target.value))}>
                      {characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{buyer?.name}</span>
                  )}
                  <strong className="bshop-purse">
                    {buyer?.spendable ?? 0} {currency}
                  </strong>
                  {buyer && buyer.reserved > 0 && <small>({buyer.reserved} held for pending orders)</small>}
                </label>
              )}
            </div>
            {notice && <div className="bshop-notice">{notice}</div>}
            {error && <div className="error">{error}</div>}
            {keeper.items.length === 0 ? (
              <p className="bshop-muted">The shelves are bare.</p>
            ) : (
              <ul className="bshop-wares">
                {keeper.items.map((item) => {
                  const qty = quantities[item.id] ?? 1;
                  const soldOut = item.available !== null && item.available <= 0;
                  const max = Math.min(99, item.available ?? 99);
                  const cost = qty * item.price;
                  const cantAfford = !!buyer && cost > buyer.spendable;
                  return (
                    <li key={item.id} className={`bshop-ware${soldOut ? " is-sold-out" : ""}`}>
                      {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className="bshop-ware-glyph" aria-hidden="true">✦</div>}
                      <div className="bshop-ware-body">
                        <div className="bshop-ware-title">
                          <strong>{item.name}</strong>
                          <span className="bshop-price">
                            {item.price} {currency}
                          </span>
                        </div>
                        {item.description && <p>{item.description}</p>}
                        <small className="bshop-muted">
                          {item.available === null ? "Plenty in stock" : soldOut ? "Sold out" : `${item.available} left`}
                        </small>
                      </div>
                      {!isDM && buyer && !soldOut && (
                        <div className="bshop-ware-buy">
                          <input
                            type="number"
                            min={1}
                            max={max}
                            value={qty}
                            aria-label={`How many ${item.name}`}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              setQuantities((current) => ({
                                ...current,
                                [item.id]: Math.max(1, Math.min(max, Math.floor(Number(e.target.value) || 1))),
                              }))
                            }
                          />
                          <button
                            type="button"
                            disabled={busyItem === item.id || cantAfford}
                            title={cantAfford ? `Costs ${cost} ${currency}` : undefined}
                            onClick={() => request(item)}
                          >
                            {busyItem === item.id ? "Asking…" : cantAfford ? "Can't afford" : `Request · ${cost}`}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </article>
    </div>
  );
}

function ShopkeeperEditor({
  campaignId,
  mapId,
  tokenId,
  token,
  keeper,
  missing,
  isShopBoard,
  onClose,
  onChanged,
}: {
  campaignId: number;
  mapId: number;
  tokenId: number;
  token: ShopKeeperToken | undefined;
  keeper: Shopkeeper | null;
  missing: boolean;
  isShopBoard: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [greeting, setGreeting] = useState("");
  const [waresLabel, setWaresLabel] = useState("");
  const [topics, setTopics] = useState<ShopTopic[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const loadedFor = useRef<number | null>(null);

  // Seed the form once per shopkeeper; later pings refresh wares, not drafts.
  useEffect(() => {
    if (!keeper || loadedFor.current === keeper.tokenId) return;
    loadedFor.current = keeper.tokenId;
    setGreeting(keeper.greeting);
    setWaresLabel(keeper.waresLabel);
    setTopics(keeper.topics);
  }, [keeper]);

  const base = `/api/campaigns/${campaignId}/shop`;
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
      await onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveDialogue = (next?: { topics?: ShopTopic[] }) =>
    run(() =>
      api(`${base}/keepers/${tokenId}`, {
        method: "PUT",
        body: JSON.stringify({ greeting, waresLabel, topics: next?.topics ?? topics }),
      })
    );

  const makeShopkeeper = () =>
    run(() =>
      api(`${base}/keepers/${tokenId}`, {
        method: "PUT",
        body: JSON.stringify({
          greeting: "Welcome, traveller. Take a look around.",
          topics: [{ id: newId(), question: "What do you sell?", answer: "" }],
        }),
      })
    );

  const [savedNotice, setSavedNotice] = useState("");
  const saveCopyToTray = () =>
    run(async () => {
      await api(`/api/campaigns/${campaignId}/maps/${mapId}/tokens/${tokenId}/copy-to-tray`, { method: "POST" });
      window.dispatchEvent(new Event("prepared-tokens:refresh"));
      setSavedNotice("Saved — drag it from Prepared Tokens onto any board to bring this shop with it.");
    });

  const removeShopkeeper = () => {
    if (!window.confirm(`Stop ${token?.name ?? "this token"} being a shopkeeper? Their wares are removed.`)) return;
    loadedFor.current = null;
    void run(() => api(`${base}/keepers/${tokenId}`, { method: "DELETE" }));
  };

  return (
    <aside className="bshop-editor" onPointerDown={(event) => event.stopPropagation()}>
      <div className="row-between">
        <h3>{token?.name ?? "Shopkeeper"}</h3>
        <button type="button" className="ghost mini" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      {!isShopBoard && (
        <p className="bshop-warning">This board is set to Battle — players can't open the shop until you switch it to Shop.</p>
      )}
      {error && <div className="error">{error}</div>}

      {missing && !keeper && (
        <div className="stack">
          <p className="bshop-muted">Give this token a greeting, things players can ask about, and wares to sell.</p>
          <button type="button" disabled={busy} onClick={makeShopkeeper}>
            Make shopkeeper
          </button>
        </div>
      )}

      {keeper && (
        <div className="stack">
          <fieldset className="bshop-fieldset">
            <legend>Dialogue</legend>
            <label>
              Greeting
              <textarea rows={3} value={greeting} onChange={(e) => setGreeting(e.target.value)} onBlur={() => saveDialogue()} />
            </label>
            {topics.map((topic, index) => (
              <div key={topic.id} className="bshop-topic-edit">
                <label>
                  Player asks
                  <input
                    value={topic.question}
                    maxLength={120}
                    placeholder="What do you sell?"
                    onChange={(e) =>
                      setTopics((current) => current.map((t, i) => (i === index ? { ...t, question: e.target.value } : t)))
                    }
                    onBlur={() => saveDialogue()}
                  />
                </label>
                <label>
                  {token?.name ?? "Shopkeeper"} answers
                  <textarea
                    rows={2}
                    value={topic.answer}
                    onChange={(e) =>
                      setTopics((current) => current.map((t, i) => (i === index ? { ...t, answer: e.target.value } : t)))
                    }
                    onBlur={() => saveDialogue()}
                  />
                </label>
                <button
                  type="button"
                  className="ghost mini"
                  onClick={() => {
                    const next = topics.filter((_, i) => i !== index);
                    setTopics(next);
                    void saveDialogue({ topics: next });
                  }}
                >
                  Remove topic
                </button>
              </div>
            ))}
            {topics.length < 12 && (
              <button
                type="button"
                className="ghost mini"
                onClick={() => setTopics((current) => [...current, { id: newId(), question: "", answer: "" }])}
              >
                + Add topic
              </button>
            )}
            <label>
              Wares button
              <input
                value={waresLabel}
                maxLength={60}
                placeholder="Show me your wares"
                onChange={(e) => setWaresLabel(e.target.value)}
                onBlur={() => saveDialogue()}
              />
            </label>
          </fieldset>

          <fieldset className="bshop-fieldset">
            <legend>Wares</legend>
            {keeper.items.map((item) => (
              <ItemEditor key={item.id} campaignId={campaignId} item={item} onChanged={onChanged} />
            ))}
            <button
              type="button"
              className="ghost mini"
              disabled={busy}
              onClick={() =>
                run(() =>
                  api(`${base}/keepers/${tokenId}/items`, {
                    method: "POST",
                    body: JSON.stringify({ name: "New item", price: 10, stock: null }),
                  })
                )
              }
            >
              + Add item
            </button>
          </fieldset>

          <button type="button" className="ghost mini" disabled={busy} onClick={saveCopyToTray}>
            Save copy to Prepared Tokens
          </button>
          {savedNotice && <p className="bshop-saved-note">{savedNotice}</p>}
          <button type="button" className="danger mini" disabled={busy} onClick={removeShopkeeper}>
            Stop being a shopkeeper
          </button>
        </div>
      )}
    </aside>
  );
}

function ItemEditor({
  campaignId,
  item,
  onChanged,
}: {
  campaignId: number;
  item: ShopItem;
  onChanged: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState({
    name: item.name,
    description: item.description,
    price: String(item.price),
    stock: item.stock == null ? "" : String(item.stock),
  });
  const [error, setError] = useState("");

  // Pick up stock changes from approvals without clobbering a field being typed in.
  useEffect(() => {
    setDraft((current) => ({ ...current, stock: item.stock == null ? "" : String(item.stock) }));
  }, [item.stock]);

  const url = `/api/campaigns/${campaignId}/shop/items/${item.id}`;
  const save = async (patch: Record<string, unknown>) => {
    setError("");
    try {
      await api(url, { method: "PUT", body: JSON.stringify(patch) });
      await onChanged();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("image", file);
    const response = await fetch(`${url}/image`, { method: "POST", body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error ?? "Image upload failed.");
    else await onChanged();
    event.target.value = "";
  };

  return (
    <div className="bshop-item-edit">
      <div className="bshop-item-edit-row">
        {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className="bshop-ware-glyph" aria-hidden="true">✦</div>}
        <input
          value={draft.name}
          aria-label="Item name"
          maxLength={80}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onBlur={() => draft.name.trim() && draft.name !== item.name && save({ name: draft.name })}
        />
      </div>
      <textarea
        rows={2}
        placeholder="What it is, what it does"
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        onBlur={() => draft.description !== item.description && save({ description: draft.description })}
      />
      <div className="bshop-item-edit-row">
        <label>
          Price
          <input
            type="number"
            min={0}
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            onBlur={() => Number(draft.price) !== item.price && save({ price: Number(draft.price) || 0 })}
          />
        </label>
        <label>
          Stock
          <input
            type="number"
            min={0}
            placeholder="∞"
            value={draft.stock}
            onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
            onBlur={() => save({ stock: draft.stock === "" ? null : Number(draft.stock) })}
          />
        </label>
      </div>
      <div className="bshop-item-edit-row">
        <label className="ghost mini bshop-file">
          {item.imageUrl ? "Replace art" : "Add art"}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} />
        </label>
        <button
          type="button"
          className="danger mini"
          onClick={async () => {
            if (!window.confirm(`Remove ${item.name} from sale?`)) return;
            try {
              await api(url, { method: "DELETE" });
              await onChanged();
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          Remove
        </button>
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

// Shop boards: a map whose purpose is "shop" lets the DM turn NPC tokens into
// shopkeepers with a short dialogue and a list of wares. Players request
// purchases with their character's in-world money (Lien in Remnant, gold in
// 5e); nothing moves until the DM approves. Many requests can be pending at
// once — pending orders reserve both the buyer's money and the item's stock so
// two players can't both claim the last one, and approval re-checks everything
// inside one transaction.

export const BOARD_SHOP_SCHEMA = `
  CREATE TABLE IF NOT EXISTS shopkeepers (
    token_id    INTEGER PRIMARY KEY REFERENCES tokens(id) ON DELETE CASCADE,
    greeting    TEXT NOT NULL DEFAULT '',
    topics      TEXT NOT NULL DEFAULT '[]',
    wares_label TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS shop_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id    INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price       INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
    stock       INTEGER CHECK (stock IS NULL OR stock >= 0),
    image_url   TEXT NOT NULL DEFAULT '',
    sort        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_shop_items_token ON shop_items (token_id);

  CREATE TABLE IF NOT EXISTS shop_orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id      INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    item_id          INTEGER REFERENCES shop_items(id) ON DELETE SET NULL,
    character_id     INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    shopkeeper_name  TEXT NOT NULL DEFAULT '',
    item_name        TEXT NOT NULL,
    item_description TEXT NOT NULL DEFAULT '',
    item_image_url   TEXT NOT NULL DEFAULT '',
    qty              INTEGER NOT NULL CHECK (qty > 0),
    unit_price       INTEGER NOT NULL CHECK (unit_price >= 0),
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','denied','cancelled')),
    note             TEXT NOT NULL DEFAULT '',
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at      TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_shop_orders_campaign ON shop_orders (campaign_id, status);
`;

export const MAX_TOPICS = 12;
export const MAX_ITEMS_PER_KEEPER = 60;
export const MAX_ORDER_QTY = 99;
const MAX_TEXT = 2000;
const MAX_NAME = 80;

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
  /** Stock minus what pending orders have reserved; null when unlimited. */
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

export type OrderStatus = "pending" | "approved" | "denied" | "cancelled";

export interface ShopOrder {
  id: number;
  campaignId: number;
  itemId: number | null;
  characterId: number;
  characterName: string;
  userId: number;
  userName: string;
  shopkeeperName: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  total: number;
  status: OrderStatus;
  note: string;
  createdAt: string;
  resolvedAt: string | null;
  /** The buyer's current balance, so the DM can see at a glance whether it clears. */
  balance: number;
}

export class ShopError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Remnant pays in Lien; every other system uses the 5e sheet's gold field. */
export const currencyFor = (system: string) =>
  system === "remnant" ? { key: "lien" as const, label: "Lien" } : { key: "gold" as const, label: "gold" };

const cleanText = (value: unknown, max = MAX_TEXT) => String(value ?? "").trim().slice(0, max);
const toInt = (value: unknown) => (Number.isFinite(Number(value)) ? Math.floor(Number(value)) : NaN);

export function sanitizeTopics(raw: unknown): ShopTopic[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_TOPICS)
    .map((topic: any) => ({
      id: typeof topic?.id === "string" && topic.id ? topic.id.slice(0, 64) : randomUUID(),
      question: cleanText(topic?.question, 120),
      answer: cleanText(topic?.answer),
    }))
    .filter((topic) => topic.question);
}

function parseTopics(raw: unknown): ShopTopic[] {
  try {
    return sanitizeTopics(JSON.parse(String(raw ?? "[]")));
  } catch {
    return [];
  }
}

export function createBoardShopStore(db: DatabaseSync) {
  const transaction = <T>(work: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      if (db.isTransaction) db.exec("ROLLBACK");
      throw error;
    }
  };

  const tokenContext = (campaignId: number, tokenId: number) =>
    db
      .prepare(
        `SELECT t.id, t.name, t.map_id, m.board_type, c.system
         FROM tokens t
         JOIN maps m ON m.id = t.map_id
         JOIN campaigns c ON c.id = m.campaign_id
         WHERE t.id = ? AND m.campaign_id = ?`
      )
      .get(tokenId, campaignId) as
      | { id: number; name: string; map_id: number; board_type: string; system: string }
      | undefined;

  const campaignSystem = (campaignId: number) =>
    String((db.prepare("SELECT system FROM campaigns WHERE id = ?").get(campaignId) as any)?.system ?? "dnd5e");

  const reservedQty = (itemId: number, exceptOrderId = 0) =>
    Number(
      (
        db
          .prepare(
            "SELECT COALESCE(SUM(qty), 0) AS n FROM shop_orders WHERE item_id = ? AND status = 'pending' AND id != ?"
          )
          .get(itemId, exceptOrderId) as any
      ).n
    );

  const reservedMoney = (characterId: number) =>
    Number(
      (
        db
          .prepare(
            "SELECT COALESCE(SUM(qty * unit_price), 0) AS n FROM shop_orders WHERE character_id = ? AND status = 'pending'"
          )
          .get(characterId) as any
      ).n
    );

  const toItem = (row: any): ShopItem => {
    const stock = row.stock == null ? null : Number(row.stock);
    return {
      id: row.id,
      tokenId: row.token_id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      stock,
      available: stock == null ? null : Math.max(0, stock - reservedQty(row.id)),
      imageUrl: row.image_url,
    };
  };

  const readCharacter = (characterId: number, campaignId: number) => {
    const row = db
      .prepare("SELECT id, user_id, name, data FROM characters WHERE id = ? AND campaign_id = ?")
      .get(characterId, campaignId) as any;
    if (!row) return null;
    let data: Record<string, any> = {};
    try {
      data = JSON.parse(row.data) ?? {};
    } catch {
      data = {};
    }
    return { id: Number(row.id), userId: Number(row.user_id), name: String(row.name), data };
  };

  const balanceOf = (data: Record<string, any>, key: string) => {
    const value = Number(data?.[key]);
    return Number.isFinite(value) ? value : 0;
  };

  function getShopkeeper(campaignId: number, tokenId: number): Shopkeeper | null {
    const token = tokenContext(campaignId, tokenId);
    if (!token) return null;
    const keeper = db.prepare("SELECT * FROM shopkeepers WHERE token_id = ?").get(tokenId) as any;
    if (!keeper) return null;
    const items = db
      .prepare("SELECT * FROM shop_items WHERE token_id = ? ORDER BY sort, id")
      .all(tokenId)
      .map(toItem);
    return {
      tokenId,
      name: token.name,
      greeting: keeper.greeting,
      topics: parseTopics(keeper.topics),
      waresLabel: keeper.wares_label,
      items,
    };
  }

  function saveShopkeeper(
    campaignId: number,
    tokenId: number,
    input: { greeting?: unknown; topics?: unknown; waresLabel?: unknown }
  ) {
    const token = tokenContext(campaignId, tokenId);
    if (!token) throw new ShopError("Token not found.", 404);
    const existing = db.prepare("SELECT * FROM shopkeepers WHERE token_id = ?").get(tokenId) as any;
    const greeting = input.greeting !== undefined ? cleanText(input.greeting) : existing?.greeting ?? "";
    const topics =
      input.topics !== undefined ? sanitizeTopics(input.topics) : parseTopics(existing?.topics ?? "[]");
    const waresLabel =
      input.waresLabel !== undefined ? cleanText(input.waresLabel, 60) : existing?.wares_label ?? "";
    db.prepare(
      `INSERT INTO shopkeepers (token_id, greeting, topics, wares_label) VALUES (?, ?, ?, ?)
       ON CONFLICT(token_id) DO UPDATE SET greeting = excluded.greeting, topics = excluded.topics,
         wares_label = excluded.wares_label`
    ).run(tokenId, greeting, JSON.stringify(topics), waresLabel);
    return { mapId: token.map_id, keeper: getShopkeeper(campaignId, tokenId)! };
  }

  function removeShopkeeper(campaignId: number, tokenId: number) {
    const token = tokenContext(campaignId, tokenId);
    if (!token) throw new ShopError("Token not found.", 404);
    // Wares go with the shopkeeper; pending orders keep their snapshot and can
    // still be denied, but approval fails cleanly because the item is gone.
    transaction(() => {
      db.prepare("DELETE FROM shop_items WHERE token_id = ?").run(tokenId);
      db.prepare("DELETE FROM shopkeepers WHERE token_id = ?").run(tokenId);
    });
    return { mapId: token.map_id };
  }

  const itemFields = (input: Record<string, unknown>, current?: any) => {
    const name = input.name !== undefined ? cleanText(input.name, MAX_NAME) : current?.name ?? "";
    if (!name) throw new ShopError("Give the item a name.");
    const description =
      input.description !== undefined ? cleanText(input.description) : current?.description ?? "";
    const price = input.price !== undefined ? toInt(input.price) : Number(current?.price ?? 0);
    if (!Number.isFinite(price) || price < 0 || price > 10_000_000) throw new ShopError("Price must be 0 or more.");
    let stock: number | null = current ? (current.stock == null ? null : Number(current.stock)) : null;
    if (input.stock !== undefined) {
      if (input.stock === null || input.stock === "") stock = null;
      else {
        stock = toInt(input.stock);
        if (!Number.isFinite(stock) || stock < 0 || stock > 100_000) throw new ShopError("Stock must be 0 or more.");
      }
    }
    const imageUrl =
      input.imageUrl !== undefined
        ? /^\/uploads\/[\w.-]+$/.test(String(input.imageUrl)) ? String(input.imageUrl) : ""
        : current?.image_url ?? "";
    return { name, description, price, stock, imageUrl };
  };

  function addItem(campaignId: number, tokenId: number, input: Record<string, unknown>) {
    const keeper = getShopkeeper(campaignId, tokenId);
    if (!keeper) throw new ShopError("Make this token a shopkeeper first.", 404);
    if (keeper.items.length >= MAX_ITEMS_PER_KEEPER) throw new ShopError("This shopkeeper's shelves are full.");
    const f = itemFields(input);
    const sort = keeper.items.length;
    const info = db
      .prepare(
        "INSERT INTO shop_items (token_id, name, description, price, stock, image_url, sort) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(tokenId, f.name, f.description, f.price, f.stock, f.imageUrl, sort);
    const mapId = tokenContext(campaignId, tokenId)!.map_id;
    return { mapId, item: toItem(db.prepare("SELECT * FROM shop_items WHERE id = ?").get(Number(info.lastInsertRowid))) };
  }

  const itemInCampaign = (campaignId: number, itemId: number) =>
    db
      .prepare(
        `SELECT i.*, t.map_id FROM shop_items i
         JOIN tokens t ON t.id = i.token_id
         JOIN maps m ON m.id = t.map_id
         WHERE i.id = ? AND m.campaign_id = ?`
      )
      .get(itemId, campaignId) as any;

  function updateItem(campaignId: number, itemId: number, input: Record<string, unknown>) {
    const current = itemInCampaign(campaignId, itemId);
    if (!current) throw new ShopError("Item not found.", 404);
    const f = itemFields(input, current);
    db.prepare(
      "UPDATE shop_items SET name = ?, description = ?, price = ?, stock = ?, image_url = ? WHERE id = ?"
    ).run(f.name, f.description, f.price, f.stock, f.imageUrl, itemId);
    return { mapId: Number(current.map_id), item: toItem(db.prepare("SELECT * FROM shop_items WHERE id = ?").get(itemId)) };
  }

  function deleteItem(campaignId: number, itemId: number) {
    const current = itemInCampaign(campaignId, itemId);
    if (!current) throw new ShopError("Item not found.", 404);
    db.prepare("DELETE FROM shop_items WHERE id = ?").run(itemId);
    return { mapId: Number(current.map_id) };
  }

  function requestOrder(input: {
    campaignId: number;
    userId: number;
    characterId: number;
    itemId: number;
    qty: number;
  }) {
    const qty = toInt(input.qty);
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_ORDER_QTY) throw new ShopError(`Choose 1 to ${MAX_ORDER_QTY}.`);
    return transaction(() => {
      const item = itemInCampaign(input.campaignId, input.itemId);
      if (!item) throw new ShopError("That item is no longer for sale.", 404);
      const token = tokenContext(input.campaignId, Number(item.token_id))!;
      if (token.board_type !== "shop") throw new ShopError("This shop is closed.");
      const character = readCharacter(input.characterId, input.campaignId);
      if (!character || character.userId !== input.userId) {
        throw new ShopError("You can only buy for your own character.", 403);
      }
      if (item.stock != null && Number(item.stock) - reservedQty(item.id) < qty) {
        const left = Math.max(0, Number(item.stock) - reservedQty(item.id));
        throw new ShopError(left ? `Only ${left} left.` : "Sold out.");
      }
      const currency = currencyFor(token.system);
      const total = qty * Number(item.price);
      const spendable = balanceOf(character.data, currency.key) - reservedMoney(character.id);
      if (total > spendable) {
        throw new ShopError(
          `${character.name} has ${Math.max(0, spendable)} ${currency.label} free after pending orders — this costs ${total}.`
        );
      }
      const info = db
        .prepare(
          `INSERT INTO shop_orders (campaign_id, item_id, character_id, user_id, shopkeeper_name,
             item_name, item_description, item_image_url, qty, unit_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.campaignId, item.id, character.id, input.userId, token.name,
          item.name, item.description, item.image_url, qty, Number(item.price)
        );
      return { orderId: Number(info.lastInsertRowid), mapId: token.map_id };
    });
  }

  const orderRow = (campaignId: number, orderId: number) =>
    db.prepare("SELECT * FROM shop_orders WHERE id = ? AND campaign_id = ?").get(orderId, campaignId) as any;

  function cancelOrder(campaignId: number, orderId: number, userId: number) {
    const order = orderRow(campaignId, orderId);
    if (!order || order.user_id !== userId) throw new ShopError("Order not found.", 404);
    if (order.status !== "pending") throw new ShopError("That order has already been settled.");
    db.prepare("UPDATE shop_orders SET status = 'cancelled', resolved_at = datetime('now') WHERE id = ?").run(orderId);
  }

  function denyOrder(campaignId: number, orderId: number, note: unknown) {
    const order = orderRow(campaignId, orderId);
    if (!order) throw new ShopError("Order not found.", 404);
    if (order.status !== "pending") throw new ShopError("That order has already been settled.");
    db.prepare(
      "UPDATE shop_orders SET status = 'denied', note = ?, resolved_at = datetime('now') WHERE id = ?"
    ).run(cleanText(note, 300), orderId);
  }

  /**
   * Moves the money and the goods. Everything is re-checked here because the
   * world may have changed since the request: the DM edited the price (the
   * buyer pays what they agreed to), restocked, or the buyer spent Lien on
   * their sheet. A failure leaves the order pending with nothing changed.
   */
  function approveOrder(campaignId: number, orderId: number) {
    return transaction(() => {
      const order = orderRow(campaignId, orderId);
      if (!order) throw new ShopError("Order not found.", 404);
      if (order.status !== "pending") throw new ShopError("That order has already been settled.");
      const item = order.item_id ? (db.prepare("SELECT * FROM shop_items WHERE id = ?").get(order.item_id) as any) : null;
      if (!item) throw new ShopError(`${order.item_name} is no longer sold here — deny this one.`);
      if (item.stock != null && Number(item.stock) < order.qty) {
        throw new ShopError(`Only ${item.stock} ${order.item_name} left in stock.`);
      }
      const character = readCharacter(order.character_id, campaignId);
      if (!character) throw new ShopError("That character no longer exists.", 404);
      const currency = currencyFor(campaignSystem(campaignId));
      const total = order.qty * order.unit_price;
      const balance = balanceOf(character.data, currency.key);
      if (balance < total) {
        throw new ShopError(`${character.name} only has ${balance} ${currency.label} — this costs ${total}.`);
      }

      const data = character.data;
      data[currency.key] = balance - total;
      const inventory: any[] = Array.isArray(data.inventory) ? data.inventory : [];
      const sameName = (entry: any) =>
        String(entry?.name ?? "").trim().toLowerCase() === String(order.item_name).trim().toLowerCase();
      const existing = inventory.find(sameName);
      if (existing) {
        existing.qty = (Number(existing.qty) || 0) + order.qty;
      } else {
        inventory.push({
          id: randomUUID(),
          name: order.item_name,
          qty: order.qty,
          weight: 0,
          equipped: false,
          ...(order.item_description ? { description: order.item_description } : {}),
          ...(order.item_image_url ? { imageUrl: order.item_image_url } : {}),
        });
      }
      data.inventory = inventory;

      db.prepare("UPDATE characters SET data = ?, updated_at = datetime('now') WHERE id = ?").run(
        JSON.stringify(data),
        character.id
      );
      if (item.stock != null) {
        db.prepare("UPDATE shop_items SET stock = stock - ? WHERE id = ?").run(order.qty, item.id);
      }
      db.prepare(
        "UPDATE shop_orders SET status = 'approved', resolved_at = datetime('now') WHERE id = ?"
      ).run(orderId);
      const mapId = Number((db.prepare("SELECT map_id FROM tokens WHERE id = ?").get(item.token_id) as any)?.map_id ?? 0);
      return {
        characterId: character.id,
        characterName: character.name,
        userId: Number(order.user_id),
        itemName: String(order.item_name),
        shopkeeperName: String(order.shopkeeper_name),
        qty: Number(order.qty),
        total,
        currencyLabel: currency.label,
        mapId,
      };
    });
  }

  function listOrders(campaignId: number, onlyUserId: number | null): ShopOrder[] {
    const currency = currencyFor(campaignSystem(campaignId));
    const filter = onlyUserId == null ? "" : "AND o.user_id = ?";
    const args: number[] = onlyUserId == null ? [campaignId] : [campaignId, onlyUserId];
    const rows = db
      .prepare(
        `SELECT o.*, c.name AS character_name, c.data AS character_data, u.display_name AS user_name
         FROM shop_orders o
         JOIN characters c ON c.id = o.character_id
         JOIN users u ON u.id = o.user_id
         WHERE o.campaign_id = ? ${filter}
           AND (o.status = 'pending' OR o.resolved_at >= datetime('now', '-1 day'))
         ORDER BY CASE o.status WHEN 'pending' THEN 0 ELSE 1 END, o.id DESC
         LIMIT 100`
      )
      .all(...args) as any[];
    return rows.map((row) => {
      let data: Record<string, any> = {};
      try {
        data = JSON.parse(row.character_data) ?? {};
      } catch {
        data = {};
      }
      return {
        id: row.id,
        campaignId: row.campaign_id,
        itemId: row.item_id,
        characterId: row.character_id,
        characterName: row.character_name,
        userId: row.user_id,
        userName: row.user_name ?? "",
        shopkeeperName: row.shopkeeper_name,
        itemName: row.item_name,
        qty: row.qty,
        unitPrice: row.unit_price,
        total: row.qty * row.unit_price,
        status: row.status,
        note: row.note,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
        balance: balanceOf(data, currency.key),
      };
    });
  }

  /** The caller's own characters with what they hold and what they can still spend. */
  function wallets(campaignId: number, userId: number) {
    const currency = currencyFor(campaignSystem(campaignId));
    const rows = db
      .prepare("SELECT id FROM characters WHERE campaign_id = ? AND user_id = ? ORDER BY name")
      .all(campaignId, userId) as any[];
    const characters = rows.map((row) => {
      const character = readCharacter(Number(row.id), campaignId)!;
      const balance = balanceOf(character.data, currency.key);
      const reserved = reservedMoney(character.id);
      return { id: character.id, name: character.name, balance, reserved, spendable: Math.max(0, balance - reserved) };
    });
    return { currency: currency.label, characters };
  }

  const pendingIds = (campaignId: number) =>
    (
      db
        .prepare("SELECT id FROM shop_orders WHERE campaign_id = ? AND status = 'pending' ORDER BY id")
        .all(campaignId) as any[]
    ).map((row) => Number(row.id));

  /** A shopkeeper's whole setup, ready to be stored on a prepared token. */
  function exportKit(tokenId: number): ShopKit | null {
    const keeper = db.prepare("SELECT * FROM shopkeepers WHERE token_id = ?").get(tokenId) as any;
    if (!keeper) return null;
    const items = db.prepare("SELECT * FROM shop_items WHERE token_id = ? ORDER BY sort, id").all(tokenId) as any[];
    return {
      greeting: keeper.greeting,
      topics: parseTopics(keeper.topics),
      waresLabel: keeper.wares_label,
      items: items.map((row) => ({
        name: row.name,
        description: row.description,
        price: Number(row.price),
        stock: row.stock == null ? null : Number(row.stock),
        imageUrl: row.image_url,
      })),
    };
  }

  /** Turns a freshly placed token into a shopkeeper from a stored kit. */
  function installKit(tokenId: number, raw: unknown) {
    const kit = sanitizeKit(raw);
    if (!kit) return false;
    const insertItem = db.prepare(
      "INSERT INTO shop_items (token_id, name, description, price, stock, image_url, sort) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    transaction(() => {
      db.prepare("DELETE FROM shop_items WHERE token_id = ?").run(tokenId);
      db.prepare(
        `INSERT INTO shopkeepers (token_id, greeting, topics, wares_label) VALUES (?, ?, ?, ?)
         ON CONFLICT(token_id) DO UPDATE SET greeting = excluded.greeting, topics = excluded.topics,
           wares_label = excluded.wares_label`
      ).run(tokenId, kit.greeting, JSON.stringify(kit.topics), kit.waresLabel);
      kit.items.forEach((item, sort) =>
        insertItem.run(tokenId, item.name, item.description, item.price, item.stock, item.imageUrl, sort)
      );
    });
    return true;
  }

  const pendingForToken = (tokenId: number) =>
    Number(
      (
        db
          .prepare(
            `SELECT COUNT(*) AS n FROM shop_orders o JOIN shop_items i ON i.id = o.item_id
             WHERE i.token_id = ? AND o.status = 'pending'`
          )
          .get(tokenId) as any
      ).n
    );

  return {
    getShopkeeper,
    saveShopkeeper,
    removeShopkeeper,
    addItem,
    updateItem,
    deleteItem,
    requestOrder,
    cancelOrder,
    denyOrder,
    approveOrder,
    listOrders,
    wallets,
    pendingIds,
    exportKit,
    installKit,
    pendingForToken,
  };
}

export type BoardShopStore = ReturnType<typeof createBoardShopStore>;

/**
 * A portable shopkeeper: dialogue plus wares, with no ids. Prepared tokens
 * carry one so a merchant can be packed into the tray and placed again.
 */
export interface ShopKit {
  greeting: string;
  topics: ShopTopic[];
  waresLabel: string;
  items: { name: string; description: string; price: number; stock: number | null; imageUrl: string }[];
}

/** Lenient: drops anything malformed rather than rejecting the whole kit. */
export function sanitizeKit(raw: unknown): ShopKit | null {
  let value = raw;
  if (typeof value === "string") {
    if (!value.trim()) return null;
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, any>;
  const items = (Array.isArray(input.items) ? input.items : [])
    .slice(0, MAX_ITEMS_PER_KEEPER)
    .map((item: any) => {
      const price = toInt(item?.price);
      const stock = item?.stock == null || item?.stock === "" ? null : toInt(item.stock);
      return {
        name: cleanText(item?.name, MAX_NAME),
        description: cleanText(item?.description),
        price: Number.isFinite(price) ? Math.min(10_000_000, Math.max(0, price)) : 0,
        stock: stock == null || !Number.isFinite(stock) ? null : Math.min(100_000, Math.max(0, stock)),
        imageUrl: /^\/uploads\/[\w.-]+$/.test(String(item?.imageUrl ?? "")) ? String(item.imageUrl) : "",
      };
    })
    .filter((item) => item.name);
  return {
    greeting: cleanText(input.greeting),
    topics: sanitizeTopics(input.topics),
    waresLabel: cleanText(input.waresLabel, 60),
    items,
  };
}

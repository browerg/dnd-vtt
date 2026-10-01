import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { BOARD_SHOP_SCHEMA, createBoardShopStore, sanitizeKit } from "./boardShopStore.js";

function fixture({ system = "remnant", boardType = "shop", lien = 100 } = {}) {
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE users (id INTEGER PRIMARY KEY, display_name TEXT);
    INSERT INTO users VALUES (1, 'DM'), (2, 'Ruby'), (3, 'Weiss');
    CREATE TABLE campaigns (id INTEGER PRIMARY KEY, system TEXT);
    INSERT INTO campaigns VALUES (1, '${system}'), (2, 'remnant');
    CREATE TABLE maps (id INTEGER PRIMARY KEY, campaign_id INTEGER REFERENCES campaigns(id), board_type TEXT);
    INSERT INTO maps VALUES (10, 1, '${boardType}'), (20, 2, 'shop');
    CREATE TABLE tokens (id INTEGER PRIMARY KEY, map_id INTEGER REFERENCES maps(id) ON DELETE CASCADE, name TEXT);
    INSERT INTO tokens VALUES (100, 10, 'Junior'), (200, 20, 'Elsewhere');
    CREATE TABLE characters (id INTEGER PRIMARY KEY, campaign_id INTEGER, user_id INTEGER, name TEXT, data TEXT,
      updated_at TEXT);
  `);
  db.exec(BOARD_SHOP_SCHEMA);
  const key = system === "remnant" ? "lien" : "gold";
  db.prepare("INSERT INTO characters (id, campaign_id, user_id, name, data) VALUES (?, 1, ?, ?, ?)").run(
    7, 2, "Ruby Rose", JSON.stringify({ [key]: lien, inventory: [{ id: "a", name: "Fire Dust", qty: 1 }] })
  );
  db.prepare("INSERT INTO characters (id, campaign_id, user_id, name, data) VALUES (?, 1, ?, ?, ?)").run(
    8, 3, "Weiss Schnee", JSON.stringify({ [key]: 1000, inventory: [] })
  );
  const store = createBoardShopStore(db);
  store.saveShopkeeper(1, 100, { greeting: "Welcome!", topics: [{ question: "What do you sell?", answer: "Dust." }] });
  const sheet = (id: number) => JSON.parse(String((db.prepare("SELECT data FROM characters WHERE id = ?").get(id) as any).data));
  return { db, store, sheet };
}

test("shopkeeper keeps greeting, topics and wares", () => {
  const { store } = fixture();
  store.addItem(1, 100, { name: "Fire Dust", price: 20, stock: 3 });
  const keeper = store.getShopkeeper(1, 100)!;
  assert.equal(keeper.greeting, "Welcome!");
  assert.equal(keeper.topics[0].question, "What do you sell?");
  assert.equal(keeper.items[0].available, 3);
  assert.equal(store.getShopkeeper(2, 100), null, "other campaigns can't read it");
});

test("approval moves Lien, merges inventory, spends stock and settles once", () => {
  const { store, sheet } = fixture();
  const { item } = store.addItem(1, 100, { name: "Fire Dust", price: 20, stock: 3 });
  const { orderId } = store.requestOrder({ campaignId: 1, userId: 2, characterId: 7, itemId: item.id, qty: 2 });
  assert.equal(sheet(7).lien, 100, "nothing moves until the DM approves");
  assert.equal(store.getShopkeeper(1, 100)!.items[0].available, 1, "pending orders reserve stock");

  const result = store.approveOrder(1, orderId);
  assert.equal(result.total, 40);
  assert.equal(sheet(7).lien, 60);
  assert.deepEqual(sheet(7).inventory.map((i: any) => [i.name, i.qty]), [["Fire Dust", 3]]);
  assert.equal(store.getShopkeeper(1, 100)!.items[0].stock, 1);
  assert.throws(() => store.approveOrder(1, orderId), /already been settled/);
});

test("many players can hold pending orders at once without overselling", () => {
  const { store } = fixture();
  const { item } = store.addItem(1, 100, { name: "Crystal", price: 10, stock: 2 });
  store.requestOrder({ campaignId: 1, userId: 2, characterId: 7, itemId: item.id, qty: 1 });
  store.requestOrder({ campaignId: 1, userId: 3, characterId: 8, itemId: item.id, qty: 1 });
  assert.throws(
    () => store.requestOrder({ campaignId: 1, userId: 3, characterId: 8, itemId: item.id, qty: 1 }),
    /Sold out/
  );
  assert.equal(store.listOrders(1, null).length, 2);
  assert.equal(store.listOrders(1, 2).length, 1, "players only see their own orders");
});

test("pending orders count against what the buyer can spend", () => {
  const { store } = fixture({ lien: 50 });
  const { item } = store.addItem(1, 100, { name: "Blade oil", price: 30 });
  store.requestOrder({ campaignId: 1, userId: 2, characterId: 7, itemId: item.id, qty: 1 });
  assert.throws(
    () => store.requestOrder({ campaignId: 1, userId: 2, characterId: 7, itemId: item.id, qty: 1 }),
    /20 Lien free/
  );
});

test("approval re-checks the balance and leaves the order pending when it fails", () => {
  const { db, store, sheet } = fixture({ lien: 50 });
  const { item } = store.addItem(1, 100, { name: "Blade oil", price: 30 });
  const { orderId } = store.requestOrder({ campaignId: 1, userId: 2, characterId: 7, itemId: item.id, qty: 1 });
  db.prepare("UPDATE characters SET data = json_set(data, '$.lien', 10) WHERE id = 7").run();
  assert.throws(() => store.approveOrder(1, orderId), /only has 10 Lien/);
  assert.equal(sheet(7).lien, 10);
  assert.equal(store.listOrders(1, null)[0].status, "pending");
  store.denyOrder(1, orderId, "Come back with coin.");
  assert.equal(store.listOrders(1, null)[0].status, "denied");
  assert.equal(store.listOrders(1, null)[0].note, "Come back with coin.");
});

test("buyers pay the price they agreed to even if the DM edits it later", () => {
  const { store, sheet } = fixture();
  const { item } = store.addItem(1, 100, { name: "Map", price: 15 });
  const { orderId } = store.requestOrder({ campaignId: 1, userId: 2, characterId: 7, itemId: item.id, qty: 1 });
  store.updateItem(1, item.id, { price: 90 });
  store.approveOrder(1, orderId);
  assert.equal(sheet(7).lien, 85);
});

test("players can't buy for someone else, on a closed board, or cancel others' orders", () => {
  const { db, store } = fixture();
  const { item } = store.addItem(1, 100, { name: "Map", price: 1 });
  assert.throws(
    () => store.requestOrder({ campaignId: 1, userId: 3, characterId: 7, itemId: item.id, qty: 1 }),
    /your own character/
  );
  const { orderId } = store.requestOrder({ campaignId: 1, userId: 2, characterId: 7, itemId: item.id, qty: 1 });
  assert.throws(() => store.cancelOrder(1, orderId, 3), /not found/);
  store.cancelOrder(1, orderId, 2);
  db.prepare("UPDATE maps SET board_type = 'battle' WHERE id = 10").run();
  assert.throws(
    () => store.requestOrder({ campaignId: 1, userId: 2, characterId: 7, itemId: item.id, qty: 1 }),
    /closed/
  );
});

test("5e campaigns spend gold and removed wares can't be approved", () => {
  const { store, sheet } = fixture({ system: "dnd5e" });
  const { item } = store.addItem(1, 100, { name: "Rope", price: 1 });
  const first = store.requestOrder({ campaignId: 1, userId: 2, characterId: 7, itemId: item.id, qty: 1 });
  store.approveOrder(1, first.orderId);
  assert.equal(sheet(7).gold, 99);
  const second = store.requestOrder({ campaignId: 1, userId: 2, characterId: 7, itemId: item.id, qty: 1 });
  store.deleteItem(1, item.id);
  assert.throws(() => store.approveOrder(1, second.orderId), /no longer sold/);
});

test("a shopkeeper packs into a kit and unpacks onto another token intact", () => {
  const { db, store } = fixture();
  store.addItem(1, 100, { name: "Fire Dust", description: "Hot.", price: 25, stock: 3 });
  store.addItem(1, 100, { name: "Map", price: 5 });
  const kit = store.exportKit(100)!;
  assert.equal(kit.items.length, 2);
  assert.equal(store.exportKit(999), null, "plain tokens have no kit");

  db.prepare("INSERT INTO tokens VALUES (101, 10, 'Junior again')").run();
  assert.ok(store.installKit(101, JSON.stringify(kit)));
  const copy = store.getShopkeeper(1, 101)!;
  assert.equal(copy.greeting, "Welcome!");
  assert.equal(copy.topics[0].answer, "Dust.");
  assert.deepEqual(copy.items.map((i) => [i.name, i.price, i.stock]), [["Fire Dust", 25, 3], ["Map", 5, null]]);
  assert.equal(store.getShopkeeper(1, 100)!.items.length, 2, "the original keeps its own wares");
  assert.equal(store.installKit(101, ""), false, "an empty kit installs nothing");
});

test("pending orders are counted per shopkeeper", () => {
  const { store } = fixture();
  const { item } = store.addItem(1, 100, { name: "Map", price: 5 });
  store.requestOrder({ campaignId: 1, userId: 2, characterId: 7, itemId: item.id, qty: 1 });
  assert.equal(store.pendingForToken(100), 1);
});

test("kits from the client are cleaned rather than trusted", () => {
  const kit = sanitizeKit({
    greeting: "Hi",
    topics: [{ question: "" }, { question: "Why?", answer: "Because." }],
    items: [
      { name: "", price: 5 },
      { name: "Gem", price: -4, stock: "2", imageUrl: "javascript:alert(1)" },
    ],
  })!;
  assert.equal(kit.topics.length, 1);
  assert.deepEqual(kit.items, [{ name: "Gem", description: "", price: 0, stock: 2, imageUrl: "" }]);
  assert.equal(sanitizeKit("not json"), null);
});

import { Router, type Request, type Response } from "express";
import multer from "multer";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { db, uploadsDir } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { getIo } from "./realtime.js";
import { getToken } from "./maps.js";
import { broadcastCharacter } from "./characters.js";
import { postServerNotice } from "./chat.js";
import { createBoardShopStore, ShopError } from "./boardShopStore.js";

// Routes for shop boards. The rules live in boardShopStore; this file handles
// who may call what and tells the room something changed. Socket pings carry
// no order details — clients refetch, and the server filters what each viewer
// may see (players get their own orders, the DM gets everyone's).

const user = (req: Request) => (req as any).user as SessionUser;
const isDMRole = (role: string | null) => role === "dm" || role === "co-dm";
export const boardShopStore = createBoardShopStore(db);
const store = boardShopStore;

const IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};
const itemImageUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) =>
      cb(null, `shop-item-${randomBytes(10).toString("hex")}${IMAGE_TYPES[file.mimetype] ?? ".png"}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in IMAGE_TYPES),
});

const room = (campaignId: number) => getIo().to(`campaign:${campaignId}`);
const shopChanged = (campaignId: number, mapId: number) => room(campaignId).emit("shop:update", { campaignId, mapId });
const ordersChanged = (campaignId: number) => room(campaignId).emit("shop:orders", { campaignId });
const tokenChanged = (campaignId: number, tokenId: number) => {
  const token = getToken(tokenId);
  if (token) room(campaignId).emit("token:update", { campaignId, token });
};

function fail(res: Response, error: unknown) {
  if (error instanceof ShopError) return res.status(error.status).json({ error: error.message });
  throw error;
}

/** Resolves the caller's role, answering 404/403 itself when they lack it. */
function access(req: Request, res: Response, needDM: boolean) {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) {
    res.status(404).json({ error: "Campaign not found." });
    return null;
  }
  if (needDM && !isDMRole(role)) {
    res.status(403).json({ error: "Only the DM can run the shop." });
    return null;
  }
  return { campaignId, role, isDM: isDMRole(role) };
}

export const boardShopRouter = Router();
boardShopRouter.use(requireAuth);

boardShopRouter.get("/:id/shop/keepers/:tokenId", (req, res) => {
  const ctx = access(req, res, false);
  if (!ctx) return;
  const keeper = store.getShopkeeper(ctx.campaignId, Number(req.params.tokenId));
  if (!keeper) return res.status(404).json({ error: "This token isn't a shopkeeper." });
  const boardType = (
    db
      .prepare("SELECT m.board_type FROM tokens t JOIN maps m ON m.id = t.map_id WHERE t.id = ?")
      .get(keeper.tokenId) as any
  )?.board_type;
  if (!ctx.isDM && boardType !== "shop") return res.status(404).json({ error: "This shop is closed." });
  res.json({ keeper, open: boardType === "shop" });
});

boardShopRouter.put("/:id/shop/keepers/:tokenId", (req, res) => {
  const ctx = access(req, res, true);
  if (!ctx) return;
  try {
    const tokenId = Number(req.params.tokenId);
    const { mapId, keeper } = store.saveShopkeeper(ctx.campaignId, tokenId, req.body ?? {});
    tokenChanged(ctx.campaignId, tokenId);
    shopChanged(ctx.campaignId, mapId);
    res.json({ keeper });
  } catch (error) {
    fail(res, error);
  }
});

boardShopRouter.delete("/:id/shop/keepers/:tokenId", (req, res) => {
  const ctx = access(req, res, true);
  if (!ctx) return;
  try {
    const tokenId = Number(req.params.tokenId);
    const { mapId } = store.removeShopkeeper(ctx.campaignId, tokenId);
    tokenChanged(ctx.campaignId, tokenId);
    shopChanged(ctx.campaignId, mapId);
    res.json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
});

boardShopRouter.post("/:id/shop/keepers/:tokenId/items", (req, res) => {
  const ctx = access(req, res, true);
  if (!ctx) return;
  try {
    const { mapId, item } = store.addItem(ctx.campaignId, Number(req.params.tokenId), req.body ?? {});
    shopChanged(ctx.campaignId, mapId);
    res.json({ item });
  } catch (error) {
    fail(res, error);
  }
});

boardShopRouter.put("/:id/shop/items/:itemId", (req, res) => {
  const ctx = access(req, res, true);
  if (!ctx) return;
  try {
    const { mapId, item } = store.updateItem(ctx.campaignId, Number(req.params.itemId), req.body ?? {});
    shopChanged(ctx.campaignId, mapId);
    res.json({ item });
  } catch (error) {
    fail(res, error);
  }
});

boardShopRouter.delete("/:id/shop/items/:itemId", (req, res) => {
  const ctx = access(req, res, true);
  if (!ctx) return;
  try {
    const { mapId } = store.deleteItem(ctx.campaignId, Number(req.params.itemId));
    shopChanged(ctx.campaignId, mapId);
    ordersChanged(ctx.campaignId);
    res.json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
});

boardShopRouter.post("/:id/shop/items/:itemId/image", itemImageUpload.single("image"), (req, res) => {
  const ctx = access(req, res, true);
  if (!ctx) return;
  if (!req.file) return res.status(400).json({ error: "Attach a PNG, JPEG, or WebP image." });
  try {
    const imageUrl = `/uploads/${path.basename(req.file.path)}`;
    const { mapId, item } = store.updateItem(ctx.campaignId, Number(req.params.itemId), { imageUrl });
    shopChanged(ctx.campaignId, mapId);
    res.json({ item });
  } catch (error) {
    fail(res, error);
  }
});

// Art for wares that don't exist yet — items in a tray shopkeeper's kit.
boardShopRouter.post("/:id/shop/art", itemImageUpload.single("image"), (req, res) => {
  const ctx = access(req, res, true);
  if (!ctx) return;
  if (!req.file) return res.status(400).json({ error: "Attach a PNG, JPEG, or WebP image." });
  res.json({ url: `/uploads/${path.basename(req.file.path)}` });
});

boardShopRouter.get("/:id/shop/wallet", (req, res) => {
  const ctx = access(req, res, false);
  if (!ctx) return;
  res.json(store.wallets(ctx.campaignId, user(req).id));
});

boardShopRouter.get("/:id/shop/orders", (req, res) => {
  const ctx = access(req, res, false);
  if (!ctx) return;
  res.json({ orders: store.listOrders(ctx.campaignId, ctx.isDM ? null : user(req).id) });
});

boardShopRouter.post("/:id/shop/orders", (req, res) => {
  const ctx = access(req, res, false);
  if (!ctx) return;
  if (ctx.role === "spectator") return res.status(403).json({ error: "Spectators can't shop." });
  try {
    const itemId = Number(req.body?.itemId);
    const { orderId, mapId } = store.requestOrder({
      campaignId: ctx.campaignId,
      userId: user(req).id,
      characterId: Number(req.body?.characterId),
      itemId,
      qty: Number(req.body?.qty ?? 1),
    });
    shopChanged(ctx.campaignId, mapId); // availability dropped
    ordersChanged(ctx.campaignId);
    res.json({ orderId });
  } catch (error) {
    fail(res, error);
  }
});

boardShopRouter.post("/:id/shop/orders/:orderId/cancel", (req, res) => {
  const ctx = access(req, res, false);
  if (!ctx) return;
  try {
    store.cancelOrder(ctx.campaignId, Number(req.params.orderId), user(req).id);
    room(ctx.campaignId).emit("shop:update", { campaignId: ctx.campaignId, mapId: 0 });
    ordersChanged(ctx.campaignId);
    res.json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
});

boardShopRouter.post("/:id/shop/orders/:orderId/deny", (req, res) => {
  const ctx = access(req, res, true);
  if (!ctx) return;
  try {
    store.denyOrder(ctx.campaignId, Number(req.params.orderId), req.body?.note);
    room(ctx.campaignId).emit("shop:update", { campaignId: ctx.campaignId, mapId: 0 });
    ordersChanged(ctx.campaignId);
    res.json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
});

function approve(campaignId: number, orderId: number) {
  const result = store.approveOrder(campaignId, orderId);
  // updatedBy 0: nobody's open sheet should ignore this as "my own edit".
  broadcastCharacter(campaignId, result.characterId, 0);
  postServerNotice(
    campaignId,
    result.userId,
    `🛒 ${result.characterName} bought ${result.qty > 1 ? `${result.qty}× ` : ""}${result.itemName}` +
      `${result.shopkeeperName ? ` from ${result.shopkeeperName}` : ""} for ${result.total} ${result.currencyLabel}.`
  );
  return result;
}

boardShopRouter.post("/:id/shop/orders/:orderId/approve", (req, res) => {
  const ctx = access(req, res, true);
  if (!ctx) return;
  try {
    const result = approve(ctx.campaignId, Number(req.params.orderId));
    shopChanged(ctx.campaignId, result.mapId);
    ordersChanged(ctx.campaignId);
    res.json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
});

// Approves every pending order oldest-first. One that can no longer clear
// (sold out, buyer short of Lien) stays pending and is reported back; the rest
// still go through.
boardShopRouter.post("/:id/shop/orders/approve-all", (req, res) => {
  const ctx = access(req, res, true);
  if (!ctx) return;
  const approved: number[] = [];
  const failed: { orderId: number; error: string }[] = [];
  for (const orderId of store.pendingIds(ctx.campaignId)) {
    try {
      approve(ctx.campaignId, orderId);
      approved.push(orderId);
    } catch (error) {
      if (!(error instanceof ShopError)) throw error;
      failed.push({ orderId, error: error.message });
    }
  }
  room(ctx.campaignId).emit("shop:update", { campaignId: ctx.campaignId, mapId: 0 });
  ordersChanged(ctx.campaignId);
  res.json({ approved, failed });
});

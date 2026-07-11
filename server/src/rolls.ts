import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { roll, DiceError, type RollDetail } from "./dice.js";
import { getIo } from "./realtime.js";

const user = (req: Request) => (req as any).user as SessionUser;

export interface RollPayload {
  id: number;
  campaignId: number;
  userId: number;
  userName: string;
  formula: string;
  label: string;
  mode: string;
  visibility: string;
  detail: RollDetail | null; // null when masked (blind roll, roller's view)
  total: number | null;
  createdAt: string;
}

// What a given viewer is allowed to see of a roll. Returns null if nothing.
export function viewOf(rollRow: RollPayload, viewerId: number, viewerIsDM: boolean): RollPayload | null {
  const own = rollRow.userId === viewerId;
  switch (rollRow.visibility) {
    case "public":
      return rollRow;
    case "private":
      return own ? rollRow : null;
    case "dm":
      return own || viewerIsDM ? rollRow : null;
    case "blind":
      if (viewerIsDM) return rollRow;
      if (own) return { ...rollRow, detail: null, total: null };
      return null;
    default:
      return null;
  }
}

const isDMRole = (role: string | null) => role === "dm" || role === "co-dm";

export const rollsRouter = Router();
rollsRouter.use(requireAuth);

// Rolls dice, stores the result, and pushes it to everyone allowed to see it.
// Shared by the roll API and anything else that rolls on a player's behalf
// (e.g. initiative in the combat tracker).
export function performRoll(
  roller: SessionUser,
  campaignId: number,
  formula: string,
  label: string,
  mode: RollDetail["mode"] = "normal",
  visibility: "public" | "private" | "dm" | "blind" = "public"
): RollPayload {
  const detail = roll(formula, mode);
  const info = db
    .prepare(
      `INSERT INTO rolls (campaign_id, user_id, formula, label, mode, visibility, detail, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      campaignId,
      roller.id,
      formula.trim(),
      label.trim(),
      mode,
      visibility,
      JSON.stringify(detail),
      detail.kept.total
    );
  const payload: RollPayload = {
    id: Number(info.lastInsertRowid),
    campaignId,
    userId: roller.id,
    userName: roller.display_name,
    formula: formula.trim(),
    label: label.trim(),
    mode,
    visibility,
    detail,
    total: detail.kept.total,
    createdAt: new Date().toISOString(),
  };
  broadcastRoll(payload);
  return payload;
}

rollsRouter.post("/:id/rolls", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (role === "spectator") return res.status(403).json({ error: "Spectators can't roll dice." });

  const { formula, label } = req.body ?? {};
  const mode = ["normal", "advantage", "disadvantage", "edge", "setback"].includes(req.body?.mode)
    ? req.body.mode
    : "normal";
  let visibility = ["public", "private", "dm", "blind"].includes(req.body?.visibility)
    ? req.body.visibility
    : "public";
  // A DM's "blind" roll is just a DM-visible roll.
  if (visibility === "blind" && isDMRole(role)) visibility = "dm";

  try {
    const payload = performRoll(
      user(req),
      campaignId,
      String(formula ?? ""),
      String(label ?? ""),
      mode,
      visibility
    );
    res.json({ roll: viewOf(payload, user(req).id, isDMRole(role)) });
  } catch (e) {
    if (e instanceof DiceError) return res.status(400).json({ error: e.message });
    throw e;
  }
});

rollsRouter.get("/:id/rolls", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  const viewerIsDM = isDMRole(role);

  const rows = db
    .prepare(
      `SELECT r.id, r.campaign_id, r.user_id, u.display_name, r.formula, r.label, r.mode,
              r.visibility, r.detail, r.total, r.created_at
       FROM rolls r JOIN users u ON u.id = r.user_id
       WHERE r.campaign_id = ? ORDER BY r.id DESC LIMIT 100`
    )
    .all(campaignId) as any[];

  const rolls = rows
    .map((r) =>
      viewOf(
        {
          id: r.id,
          campaignId: r.campaign_id,
          userId: r.user_id,
          userName: r.display_name,
          formula: r.formula,
          label: r.label,
          mode: r.mode,
          visibility: r.visibility,
          detail: JSON.parse(r.detail),
          total: r.total,
          createdAt: r.created_at,
        },
        user(req).id,
        viewerIsDM
      )
    )
    .filter((r): r is RollPayload => r !== null)
    .reverse();

  res.json({ rolls });
});

// Push a roll to every connected member who is allowed to see it.
function broadcastRoll(payload: RollPayload) {
  const io = getIo();
  const sockets = io.sockets.adapter.rooms.get(`campaign:${payload.campaignId}`) ?? new Set<string>();
  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId);
    const viewer = socket?.data.user as SessionUser | undefined;
    if (!socket || !viewer) continue;
    const viewerIsDM = isDMRole(memberRole(payload.campaignId, viewer.id));
    const view = viewOf(payload, viewer.id, viewerIsDM);
    if (view) socket.emit("roll", view);
  }
}

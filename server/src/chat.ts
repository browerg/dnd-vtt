import { Router, type Request } from "express";
import { db } from "./db.js";
import { requireAuth, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { getIo } from "./realtime.js";

const user = (req: Request) => (req as any).user as SessionUser;
const MAX_BODY = 4000;

export interface ChatMessage {
  id: number;
  campaignId: number;
  userId: number;
  userName: string;
  channel: "ic" | "ooc" | "whisper";
  targetUserId: number | null;
  targetName: string | null;
  speaker: string; // character name for IC messages
  body: string;
  createdAt: string;
}

const visibleTo = (msg: ChatMessage, viewerId: number) =>
  msg.channel !== "whisper" || msg.userId === viewerId || msg.targetUserId === viewerId;

export const chatRouter = Router();
chatRouter.use(requireAuth);

chatRouter.get("/:id/messages", (req, res) => {
  const campaignId = Number(req.params.id);
  if (!memberRole(campaignId, user(req).id)) return res.status(404).json({ error: "Campaign not found." });
  const rows = db
    .prepare(
      `SELECT m.id, m.campaign_id, m.user_id, u.display_name AS user_name, m.channel,
              m.target_user_id, t.display_name AS target_name, m.speaker, m.body, m.created_at
       FROM messages m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN users t ON t.id = m.target_user_id
       WHERE m.campaign_id = ? ORDER BY m.id DESC LIMIT 200`
    )
    .all(campaignId) as any[];
  const messages = rows
    .map(
      (r): ChatMessage => ({
        id: r.id,
        campaignId: r.campaign_id,
        userId: r.user_id,
        userName: r.user_name,
        channel: r.channel,
        targetUserId: r.target_user_id,
        targetName: r.target_name,
        speaker: r.speaker,
        body: r.body,
        createdAt: r.created_at,
      })
    )
    .filter((m) => visibleTo(m, user(req).id))
    .reverse();
  res.json({ messages });
});

chatRouter.post("/:id/messages", (req, res) => {
  const campaignId = Number(req.params.id);
  const role = memberRole(campaignId, user(req).id);
  if (!role) return res.status(404).json({ error: "Campaign not found." });
  if (role === "spectator") return res.status(403).json({ error: "Spectators can't chat." });

  const channel = ["ic", "ooc", "whisper"].includes(req.body?.channel) ? req.body.channel : "ooc";
  const body = String(req.body?.body ?? "").trim();
  if (!body) return res.status(400).json({ error: "Empty message." });
  if (body.length > MAX_BODY) return res.status(400).json({ error: "Message is too long." });

  let targetUserId: number | null = null;
  let targetName: string | null = null;
  if (channel === "whisper") {
    targetUserId = Number(req.body?.targetUserId);
    if (!targetUserId || targetUserId === user(req).id || !memberRole(campaignId, targetUserId)) {
      return res.status(400).json({ error: "Pick someone in this campaign to whisper to." });
    }
    targetName =
      (db.prepare("SELECT display_name FROM users WHERE id = ?").get(targetUserId) as any)
        ?.display_name ?? null;
  }

  // IC messages speak as your character, if you have one here.
  let speaker = "";
  if (channel === "ic") {
    const c = db
      .prepare("SELECT name FROM characters WHERE campaign_id = ? AND user_id = ? ORDER BY id LIMIT 1")
      .get(campaignId, user(req).id) as any;
    speaker = c?.name ?? "";
  }

  const info = db
    .prepare(
      `INSERT INTO messages (campaign_id, user_id, channel, target_user_id, speaker, body)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(campaignId, user(req).id, channel, targetUserId, speaker, body);

  const message: ChatMessage = {
    id: Number(info.lastInsertRowid),
    campaignId,
    userId: user(req).id,
    userName: user(req).display_name,
    channel,
    targetUserId,
    targetName,
    speaker,
    body,
    createdAt: new Date().toISOString(),
  };

  // Whispers go only to sockets belonging to the sender or the target.
  const io = getIo();
  const room = io.sockets.adapter.rooms.get(`campaign:${campaignId}`) ?? new Set<string>();
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    const viewer = socket?.data.user as SessionUser | undefined;
    if (socket && viewer && visibleTo(message, viewer.id)) socket.emit("chat", message);
  }
  res.json({ message });
});

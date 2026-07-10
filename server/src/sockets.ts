import type { Server, Socket } from "socket.io";
import { parseCookies, userForToken, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";
import { moveToken } from "./maps.js";

// The real-time backbone. Every live feature (dice feed, chat, tokens, initiative)
// rides on campaign rooms; presence is derived from room membership.

const room = (campaignId: number) => `campaign:${campaignId}`;

export function setupSockets(io: Server) {
  io.use((socket, next) => {
    const token = parseCookies(socket.handshake.headers.cookie)["sid"];
    const user = token ? userForToken(token) : null;
    if (!user) return next(new Error("unauthorized"));
    (socket.data as any).user = user;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as SessionUser;

    socket.on("campaign:join", (campaignId: number) => {
      if (!memberRole(Number(campaignId), user.id)) return;
      socket.join(room(Number(campaignId)));
      broadcastPresence(io, Number(campaignId));
    });

    socket.on("token:move", (msg: { campaignId: number; tokenId: number; x: number; y: number }) => {
      const campaignId = Number(msg?.campaignId);
      const moved = moveToken(user, campaignId, Number(msg?.tokenId), Number(msg?.x), Number(msg?.y));
      if (moved) io.to(room(campaignId)).emit("token:update", { campaignId, token: moved });
    });

    socket.on("map:ping", (msg: { campaignId: number; x: number; y: number }) => {
      const campaignId = Number(msg?.campaignId);
      const role = memberRole(campaignId, user.id);
      if (!role || !Number.isFinite(msg?.x) || !Number.isFinite(msg?.y)) return;
      io.to(room(campaignId)).emit("map:ping", {
        campaignId,
        x: msg.x,
        y: msg.y,
        userName: user.display_name,
      });
    });

    socket.on("campaign:leave", (campaignId: number) => {
      socket.leave(room(Number(campaignId)));
      broadcastPresence(io, Number(campaignId));
    });

    socket.on("disconnecting", () => {
      for (const r of socket.rooms) {
        if (r.startsWith("campaign:")) {
          const campaignId = Number(r.slice("campaign:".length));
          // Rooms update after this handler runs, so broadcast on next tick.
          setImmediate(() => broadcastPresence(io, campaignId));
        }
      }
    });
  });
}

function broadcastPresence(io: Server, campaignId: number) {
  const sockets = io.sockets.adapter.rooms.get(room(campaignId)) ?? new Set<string>();
  const online = new Set<number>();
  for (const socketId of sockets) {
    const s = io.sockets.sockets.get(socketId);
    const u = s?.data.user as SessionUser | undefined;
    if (u) online.add(u.id);
  }
  io.to(room(campaignId)).emit("presence", { campaignId, onlineUserIds: [...online] });
}

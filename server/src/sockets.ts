import type { Server, Socket } from "socket.io";
import { parseCookies, userForToken, type SessionUser } from "./auth.js";
import { memberRole } from "./campaigns.js";

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

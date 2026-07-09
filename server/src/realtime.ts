import type { Server } from "socket.io";

// Holds the Socket.IO instance so REST routes can push live events
// without a circular import with index.ts.

let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

export function getIo(): Server {
  if (!io) throw new Error("Socket.IO not initialized yet");
  return io;
}

import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { authRouter } from "./auth.js";
import { campaignsRouter, invitesRouter } from "./campaigns.js";
import { rollsRouter } from "./rolls.js";
import { charactersRouter } from "./characters.js";
import { chatRouter } from "./chat.js";
import { mapsRouter, MAX_UPLOAD_MB } from "./maps.js";
import { combatRouter } from "./combat.js";
import { monstersRouter } from "./monsters.js";
import { codexRouter } from "./codex.js";
import { exportRouter } from "./export.js";
import { uploadsDir } from "./db.js";
import { setupSockets } from "./sockets.js";
import { setIo } from "./realtime.js";

const app = express();
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/campaigns", rollsRouter);
app.use("/api/campaigns", charactersRouter);
app.use("/api/campaigns", chatRouter);
app.use("/api/campaigns", mapsRouter);
app.use("/api/campaigns", combatRouter);
app.use("/api/monsters", monstersRouter);
app.use("/api/campaigns", codexRouter);
app.use("/api/campaigns", exportRouter);
app.use("/uploads", express.static(uploadsDir, { maxAge: "7d", immutable: true }));
app.use("/api/campaigns", campaignsRouter);
app.use("/api/invites", invitesRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if ((err as any)?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: `That file is too big — the limit is ${MAX_UPLOAD_MB}MB.`,
    });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const httpServer = createServer(app);
const io = new Server(httpServer);
setIo(io);
setupSockets(io);

const PORT = Number(process.env.PORT ?? 3001);
httpServer.listen(PORT, () => console.log(`server listening on http://localhost:${PORT}`));

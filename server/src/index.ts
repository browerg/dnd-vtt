import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Server } from "socket.io";
import { authRouter } from "./auth.js";
import { campaignsRouter, invitesRouter } from "./campaigns.js";
import { rollsRouter } from "./rolls.js";
import { charactersRouter } from "./characters.js";
import { chatRouter } from "./chat.js";
import { mapsRouter, MAX_UPLOAD_MB } from "./maps.js";
import { mapObjectsRouter } from "./mapObjects.js";
import { scenesRouter } from "./scenes.js";
import { combatRouter } from "./combat.js";
import { monstersRouter } from "./monsters.js";
import { codexRouter } from "./codex.js";
import { exportRouter } from "./export.js";
import { spellsRouter } from "./spells.js";
import { notesRouter } from "./notes.js";
import { uploadsRouter } from "./uploads.js";
import { uploadsDir } from "./db.js";
import { backfillGrimm } from "./grimm.js";
import { setupSockets } from "./sockets.js";
import { setIo } from "./realtime.js";

backfillGrimm();

const app = express();
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/campaigns", rollsRouter);
app.use("/api/campaigns", charactersRouter);
app.use("/api/campaigns", chatRouter);
app.use("/api/campaigns", mapsRouter);
app.use("/api/campaigns", mapObjectsRouter);
app.use("/api/campaigns", scenesRouter);
app.use("/api/campaigns", combatRouter);
app.use("/api/monsters", monstersRouter);
app.use("/api/campaigns", codexRouter);
app.use("/api/campaigns", exportRouter);
app.use("/api/campaigns", notesRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/spells", spellsRouter);
app.use("/uploads", express.static(uploadsDir, { maxAge: "7d", immutable: true }));
app.use("/api/campaigns", campaignsRouter);
app.use("/api/invites", invitesRouter);

// Production: serve the built client (npm run build) from the same server,
// with an SPA fallback so /campaigns/2/map refreshes cleanly. In dev the
// Vite server owns the client and proxies /api here instead.
const clientDist = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "client",
  "dist"
);
if (existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: "1h" }));
  app.get(/^(?!\/api\/|\/uploads\/|\/socket\.io\/).*/, (_req, res) =>
    res.sendFile(path.join(clientDist, "index.html"))
  );
}

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

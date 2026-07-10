import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { authRouter } from "./auth.js";
import { campaignsRouter, invitesRouter } from "./campaigns.js";
import { rollsRouter } from "./rolls.js";
import { charactersRouter } from "./characters.js";
import { setupSockets } from "./sockets.js";
import { setIo } from "./realtime.js";

const app = express();
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/campaigns", rollsRouter);
app.use("/api/campaigns", charactersRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/invites", invitesRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const httpServer = createServer(app);
const io = new Server(httpServer);
setIo(io);
setupSockets(io);

const PORT = Number(process.env.PORT ?? 3001);
httpServer.listen(PORT, () => console.log(`server listening on http://localhost:${PORT}`));

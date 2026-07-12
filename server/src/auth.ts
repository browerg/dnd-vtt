import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db.js";

const SESSION_DAYS = 30;

export interface SessionUser {
  id: number;
  email: string;
  display_name: string;
  diceTheme?: string;
}

// Curated dice colorsets from @3d-dice/dice-box-threejs. '' means the default.
export const DICE_THEMES = new Set([
  "white",
  "black",
  "radiant",
  "fire",
  "ice",
  "lightning",
  "poison",
  "bloodmoon",
  "pinkdreams",
  "astralsea",
  "glitterparty",
  "dragons",
]);

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

export function getSessionUser(req: Request): SessionUser | null {
  const token = parseCookies(req.headers.cookie)["sid"];
  return token ? userForToken(token) : null;
}

export function userForToken(token: string): SessionUser | null {
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.dice_theme AS diceTheme FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token) as SessionUser | undefined;
  return row ?? null;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  (req as any).user = user;
  next();
}

function startSession(res: Response, userId: number) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    expires.toISOString()
  );
  res.setHeader(
    "Set-Cookie",
    `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}`
  );
}

export const authRouter = Router();

authRouter.post("/register", (req, res) => {
  const { email, displayName, password } = req.body ?? {};
  if (!email?.includes("@") || !displayName?.trim() || (password ?? "").length < 8) {
    return res
      .status(400)
      .json({ error: "Need a valid email, a display name, and a password of 8+ characters." });
  }
  try {
    const info = db
      .prepare("INSERT INTO users (email, display_name, password_hash) VALUES (?, ?, ?)")
      .run(email.trim(), displayName.trim(), hashPassword(password));
    startSession(res, Number(info.lastInsertRowid));
    res.json({ id: Number(info.lastInsertRowid), email: email.trim(), display_name: displayName.trim() });
  } catch (e: any) {
    if (String(e?.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    throw e;
  }
});

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body ?? {};
  const user = db
    .prepare("SELECT id, email, display_name, password_hash FROM users WHERE email = ?")
    .get(email ?? "") as (SessionUser & { password_hash: string }) | undefined;
  if (!user || !verifyPassword(password ?? "", user.password_hash)) {
    return res.status(401).json({ error: "Wrong email or password." });
  }
  startSession(res, user.id);
  res.json({ id: user.id, email: user.email, display_name: user.display_name });
});

authRouter.post("/logout", (req, res) => {
  const token = parseCookies(req.headers.cookie)["sid"];
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.setHeader("Set-Cookie", "sid=; Path=/; HttpOnly; Max-Age=0");
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  res.json({ user: getSessionUser(req) });
});

// Pick your dice — the theme rides along on every roll you make.
authRouter.put("/me/dice", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  const theme = String(req.body?.theme ?? "");
  if (theme !== "" && !DICE_THEMES.has(theme)) {
    return res.status(400).json({ error: "That dice set doesn't exist." });
  }
  db.prepare("UPDATE users SET dice_theme = ? WHERE id = ?").run(theme, user.id);
  res.json({ ok: true, diceTheme: theme });
});

// ---- dev quick login ----
// One-click account switching for solo testing (DM in one window, player in
// another). Locked down twice: only when the server was started with
// `npm run dev` (production uses `npm start`), and only for requests from this
// machine — a hosted instance never exposes it.
const DEV_MODE = process.env.npm_lifecycle_event === "dev";

const isLocalRequest = (req: Request) =>
  ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");

authRouter.get("/dev-users", (req, res) => {
  if (!DEV_MODE || !isLocalRequest(req)) return res.status(404).json({ error: "Not found" });
  const users = db
    .prepare(
      `SELECT u.id, u.display_name,
              EXISTS(SELECT 1 FROM campaign_members m WHERE m.user_id = u.id AND m.role = 'dm') AS is_dm
       FROM users u ORDER BY is_dm DESC, u.id`
    )
    .all();
  res.json({ users });
});

authRouter.post("/dev-login", (req, res) => {
  if (!DEV_MODE || !isLocalRequest(req)) return res.status(404).json({ error: "Not found" });
  const user = db
    .prepare("SELECT id, email, display_name FROM users WHERE id = ?")
    .get(Number(req.body?.userId)) as SessionUser | undefined;
  if (!user) return res.status(404).json({ error: "No such user." });
  startSession(res, user.id);
  res.json(user);
});

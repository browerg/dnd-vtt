import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db.js";

const SESSION_DAYS = 30;

export interface SessionUser {
  id: number;
  email: string;
  display_name: string;
}

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
      `SELECT u.id, u.email, u.display_name FROM sessions s
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

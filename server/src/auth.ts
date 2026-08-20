import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { db } from "./db.js";

const SESSION_DAYS = 30;

export interface SessionUser {
  id: number;
  email: string;
  display_name: string;
  diceTheme?: string;
  avatarPath?: string;
  pronouns?: string;
  bio?: string;
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

// Custom V1 dice settings ride in the existing dice_theme field so the
// current per-user persistence and multiplayer roll payload need no schema
// changes. Keep this strict: two hex colors plus one supported finish.
const CUSTOM_DICE_THEME_V1 =
  /^custom:v1:#[0-9a-f]{6}:#[0-9a-f]{6}:(matte|glossy|metallic)$/i;
const CUSTOM_DICE_HEX = /^#[0-9a-f]{6}$/i;
const CUSTOM_DICE_THEME_V2_PATTERNS = new Set([
  "none",
  "marble",
  "cloudy_2",
  "glitter",
  "stars",
  "stainedglass",
  "ice",
  "water",
  "astral",
  "dragon",
  "fire",
  "speckles",
]);

const isCustomDiceTheme = (theme: string) => {
  if (CUSTOM_DICE_THEME_V1.test(theme)) return true;

  const parts = theme.split(":");
  if (parts.length !== 10 || parts[0] !== "custom" || parts[1] !== "v2") return false;
  const [base, text, edge, outline, finish, pattern, strengthRaw, scaleRaw] = parts.slice(2);
  if (!CUSTOM_DICE_HEX.test(base) || !CUSTOM_DICE_HEX.test(text) || !CUSTOM_DICE_HEX.test(edge)) {
    return false;
  }
  if (outline !== "none" && !CUSTOM_DICE_HEX.test(outline)) return false;
  if (!new Set(["matte", "glossy", "metallic"]).has(finish)) return false;
  if (!CUSTOM_DICE_THEME_V2_PATTERNS.has(pattern)) return false;

  const strength = Number(strengthRaw);
  const scale = Number(scaleRaw);
  if (!Number.isInteger(strength) || strength < 25 || strength > 100 || strength % 5 !== 0) {
    return false;
  }
  if (!Number.isInteger(scale) || scale < 50 || scale > 250 || scale % 10 !== 0) {
    return false;
  }
  return true;
};

const isValidDiceTheme = (theme: string) =>
  theme === "" || DICE_THEMES.has(theme) || isCustomDiceTheme(theme);

const presentDicePreset = (row: any) => ({
  id: Number(row.id),
  name: String(row.name),
  theme: String(row.theme),
  createdAt: String(row.createdAt),
  updatedAt: String(row.updatedAt),
});

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
      `SELECT u.id, u.email, u.display_name, u.dice_theme AS diceTheme,
              u.avatar_path AS avatarPath, u.pronouns, u.bio
       FROM sessions s
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

// Pick your dice ΓÇö the theme rides along on every roll you make.
authRouter.put("/me/dice", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  const theme = String(req.body?.theme ?? "");
  if (!isValidDiceTheme(theme)) {
    return res.status(400).json({ error: "That dice appearance isn't valid." });
  }
  db.prepare("UPDATE users SET dice_theme = ? WHERE id = ?").run(theme, user.id);
  res.json({ ok: true, diceTheme: theme });
});

// Up to five named dice appearances per account. The active appearance remains
// users.dice_theme; these rows are only the player's personal preset shelf.
authRouter.get("/me/dice-presets", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  const rows = db
    .prepare(
      `SELECT id, name, theme, created_at AS createdAt, updated_at AS updatedAt
       FROM dice_presets
       WHERE user_id = ?
       ORDER BY id ASC`
    )
    .all(user.id) as any[];
  res.json({ presets: rows.map(presentDicePreset) });
});

authRouter.post("/me/dice-presets", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  const name = String(req.body?.name ?? "").trim();
  const theme = String(req.body?.theme ?? "");
  if (!name) return res.status(400).json({ error: "Give this dice preset a name." });
  if (name.length > 24) return res.status(400).json({ error: "Dice names can be up to 24 characters." });
  if (!theme || !isValidDiceTheme(theme)) {
    return res.status(400).json({ error: "That dice appearance isn't valid." });
  }
  const count = Number(
    (db.prepare("SELECT COUNT(*) AS n FROM dice_presets WHERE user_id = ?").get(user.id) as any).n
  );
  if (count >= 5) return res.status(409).json({ error: "My Dice is full. You can keep up to 5 presets." });

  try {
    const info = db
      .prepare("INSERT INTO dice_presets (user_id, name, theme) VALUES (?, ?, ?)")
      .run(user.id, name, theme);
    const row = db
      .prepare(
        `SELECT id, name, theme, created_at AS createdAt, updated_at AS updatedAt
         FROM dice_presets WHERE id = ? AND user_id = ?`
      )
      .get(Number(info.lastInsertRowid), user.id);
    res.json({ preset: presentDicePreset(row) });
  } catch (e: any) {
    if (String(e?.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "You already have a dice preset with that name." });
    }
    throw e;
  }
});

authRouter.put("/me/dice-presets/:presetId", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  const presetId = Number(req.params.presetId);
  const name = String(req.body?.name ?? "").trim();
  const theme = String(req.body?.theme ?? "");
  if (!Number.isInteger(presetId) || presetId <= 0) {
    return res.status(400).json({ error: "Invalid dice preset." });
  }
  if (!name) return res.status(400).json({ error: "Give this dice preset a name." });
  if (name.length > 24) return res.status(400).json({ error: "Dice names can be up to 24 characters." });
  if (!theme || !isValidDiceTheme(theme)) {
    return res.status(400).json({ error: "That dice appearance isn't valid." });
  }

  try {
    const info = db
      .prepare(
        `UPDATE dice_presets
         SET name = ?, theme = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`
      )
      .run(name, theme, presetId, user.id);
    if (Number(info.changes) === 0) return res.status(404).json({ error: "Dice preset not found." });
    const row = db
      .prepare(
        `SELECT id, name, theme, created_at AS createdAt, updated_at AS updatedAt
         FROM dice_presets WHERE id = ? AND user_id = ?`
      )
      .get(presetId, user.id);
    res.json({ preset: presentDicePreset(row) });
  } catch (e: any) {
    if (String(e?.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "You already have a dice preset with that name." });
    }
    throw e;
  }
});

authRouter.delete("/me/dice-presets/:presetId", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  const presetId = Number(req.params.presetId);
  if (!Number.isInteger(presetId) || presetId <= 0) {
    return res.status(400).json({ error: "Invalid dice preset." });
  }
  const info = db
    .prepare("DELETE FROM dice_presets WHERE id = ? AND user_id = ?")
    .run(presetId, user.id);
  if (Number(info.changes) === 0) return res.status(404).json({ error: "Dice preset not found." });
  res.json({ ok: true });
});


// Edit your account identity ΓÇö name, avatar, pronouns, bio. Account-space only;
// this is who *you* are, not your character.
authRouter.put("/me/profile", (req, res) => {
  const current = getSessionUser(req);
  if (!current) return res.status(401).json({ error: "Not logged in" });
  const displayName = String(req.body?.displayName ?? "").trim();
  const pronouns = String(req.body?.pronouns ?? "").trim();
  const bio = String(req.body?.bio ?? "").trim();
  const avatarPath = String(req.body?.avatarPath ?? "").trim();
  if (!displayName) return res.status(400).json({ error: "Display name can't be empty." });
  if (displayName.length > 40) return res.status(400).json({ error: "Display name is too long (40 characters max)." });
  if (pronouns.length > 30) return res.status(400).json({ error: "Pronouns are too long (30 characters max)." });
  if (bio.length > 280) return res.status(400).json({ error: "Bio is too long (280 characters max)." });
  if (avatarPath && !avatarPath.startsWith("/uploads/")) {
    return res.status(400).json({ error: "Invalid avatar image." });
  }
  // Reconstruct the path from just the filename so no traversal segments are
  // ever stored ΓÇö same defense the character/map/codex uploaders use.
  const safeAvatar = avatarPath ? `/uploads/${path.basename(avatarPath)}` : "";
  db.prepare(
    "UPDATE users SET display_name = ?, pronouns = ?, bio = ?, avatar_path = ? WHERE id = ?"
  ).run(displayName, pronouns, bio, safeAvatar, current.id);
  res.json({ user: getSessionUser(req) });
});

// ---- dev quick login ----
// One-click account switching for solo testing (DM in one window, player in
// another). Locked down twice: only when the server was started with
// `npm run dev` (production uses `npm start`), and only for requests from this
// machine ΓÇö a hosted instance never exposes it.
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

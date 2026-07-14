# User Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/profile` page where a user edits their account identity — display name, avatar, pronouns, and a short bio — surfaced in account/out-of-character UI only.

**Architecture:** Three new columns on `users`; extend `GET /me` + a new `PUT /api/auth/me/profile`; avatar upload reuses the existing `POST /api/uploads/image`. Client gets a reusable `<Avatar>` component, a `ProfilePage`, and avatar rendering in the topbar, member rosters, and OOC chat. The person identity never enters in-character surfaces (roll feed, IC chat, tokens).

**Tech Stack:** TypeScript, Express + `node:sqlite`, React + Vite, react-router.

**Verification note:** This project has no unit-test runner. Every milestone here is verified the way the rest of the codebase is: `tsc` typecheck, `curl` against the dev server on `:3001`, and browser checks. The dev servers are already running (server `:3001`, client `:5173`). `tsx watch` auto-reloads the server on save; Vite HMR reloads the client. A DM session cookie for curl is obtained via dev-login (userId 1 = Melinda).

**Reference — get a cookie jar for curl tests (run once):**
```bash
curl -s -c /tmp/cj.txt -X POST localhost:3001/api/auth/dev-login \
  -H 'Content-Type: application/json' -d '{"userId":1}'
# then reuse: curl -s -b /tmp/cj.txt localhost:3001/api/auth/me
```

---

### Task 1: Add profile columns to `users` and expose them on the session user

**Files:**
- Modify: `server/src/db.ts` (migrations array, ends ~line 248)
- Modify: `server/src/auth.ts:7-12` (SessionUser) and `server/src/auth.ts:47-56` (userForToken)

- [ ] **Step 1: Add the migration**

In `server/src/db.ts`, append three entries to the end of the migrations array (the array of `"ALTER TABLE ..."` strings that currently ends with the `player_controllable` line):

```js
  "ALTER TABLE users ADD COLUMN avatar_path TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN pronouns TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''",
```

- [ ] **Step 2: Extend the `SessionUser` interface**

Replace `server/src/auth.ts:7-12` with:

```ts
export interface SessionUser {
  id: number;
  email: string;
  display_name: string;
  diceTheme?: string;
  avatarPath?: string;
  pronouns?: string;
  bio?: string;
}
```

- [ ] **Step 3: Select the new columns in `userForToken`**

Replace the SELECT in `server/src/auth.ts:48-54` with:

```ts
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.dice_theme AS diceTheme,
              u.avatar_path AS avatarPath, u.pronouns, u.bio
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token) as SessionUser | undefined;
```

- [ ] **Step 4: Verify the migration ran and `/me` carries the fields**

The server auto-restarts on save. Then:

```bash
curl -s -c /tmp/cj.txt -X POST localhost:3001/api/auth/dev-login \
  -H 'Content-Type: application/json' -d '{"userId":1}' >/dev/null
curl -s -b /tmp/cj.txt localhost:3001/api/auth/me
```

Expected: JSON `{"user":{...,"avatarPath":"","pronouns":"","bio":""}}` (empty strings, no error).

- [ ] **Step 5: Commit**

```bash
git add server/src/db.ts server/src/auth.ts
git commit -m "Profile: add avatar/pronouns/bio columns + expose on session user"
```

---

### Task 2: `PUT /api/auth/me/profile` endpoint with validation

**Files:**
- Modify: `server/src/auth.ts` (add after the `put("/me/dice", ...)` handler, ~line 144)

- [ ] **Step 1: Add the endpoint**

Insert after the `/me/dice` handler in `server/src/auth.ts`:

```ts
// Edit your account identity — name, avatar, pronouns, bio. Account-space only;
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
  db.prepare(
    "UPDATE users SET display_name = ?, pronouns = ?, bio = ?, avatar_path = ? WHERE id = ?"
  ).run(displayName, pronouns, bio, avatarPath, current.id);
  res.json({ user: getSessionUser(req) });
});
```

- [ ] **Step 2: Verify a valid save round-trips**

```bash
curl -s -b /tmp/cj.txt -X PUT localhost:3001/api/auth/me/profile \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"Melinda","pronouns":"she/her","bio":"Forever DM."}'
```

Expected: `{"user":{...,"pronouns":"she/her","bio":"Forever DM.","display_name":"Melinda"}}`.

- [ ] **Step 3: Verify validation rejects an empty name**

```bash
curl -s -b /tmp/cj.txt -X PUT localhost:3001/api/auth/me/profile \
  -H 'Content-Type: application/json' -d '{"displayName":"   "}'
```

Expected: HTTP body `{"error":"Display name can't be empty."}`.

- [ ] **Step 4: Commit**

```bash
git add server/src/auth.ts
git commit -m "Profile: PUT /me/profile endpoint with validation"
```

---

### Task 3: Include avatar in the campaign member roster payload

**Files:**
- Modify: `server/src/campaigns.ts:65-72` (members query)
- Modify: `client/src/api.ts:17-21` (Member interface)

- [ ] **Step 1: Add `u.avatar_path` to the members query**

Replace the members SELECT in `server/src/campaigns.ts:66-71` with:

```ts
      `SELECT u.id, u.display_name, u.avatar_path, m.role FROM campaign_members m
       JOIN users u ON u.id = m.user_id WHERE m.campaign_id = ?
       ORDER BY CASE m.role WHEN 'dm' THEN 0 WHEN 'co-dm' THEN 1 WHEN 'player' THEN 2 ELSE 3 END,
                u.display_name`
```

- [ ] **Step 2: Extend the client `Member` type**

Replace `client/src/api.ts:17-21` with:

```ts
export interface Member {
  id: number;
  display_name: string;
  avatar_path?: string;
  role: string;
}
```

- [ ] **Step 3: Verify the roster carries avatars**

```bash
curl -s -b /tmp/cj.txt localhost:3001/api/campaigns/2 | \
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).members))"
```

Expected: each member object includes an `avatar_path` field (empty string until one is set).

- [ ] **Step 4: Commit**

```bash
git add server/src/campaigns.ts client/src/api.ts
git commit -m "Profile: surface member avatar_path in campaign payload"
```

---

### Task 4: Extend the client `User` type

**Files:**
- Modify: `client/src/api.ts:1-6` (User interface)

- [ ] **Step 1: Add the fields**

Replace `client/src/api.ts:1-6` with:

```ts
export interface User {
  id: number;
  email: string;
  display_name: string;
  diceTheme?: string;
  avatarPath?: string;
  pronouns?: string;
  bio?: string;
}
```

- [ ] **Step 2: Verify the client typechecks**

```bash
cd client && npx tsc -b --noEmit
```

Expected: no output (clean). Return to repo root afterward: `cd ..`.

- [ ] **Step 3: Commit**

```bash
git add client/src/api.ts
git commit -m "Profile: add avatar/pronouns/bio to client User type"
```

---

### Task 5: Reusable `<Avatar>` component + styles

**Files:**
- Create: `client/src/components/Avatar.tsx`
- Modify: `client/src/styles.css` (append)

- [ ] **Step 1: Create the component**

`client/src/components/Avatar.tsx`:

```tsx
// A person's account avatar: their uploaded image, or a stable colored initial.
// Account/out-of-character identity only — never used for characters.
const COLORS = ["#b5462f", "#2f6db5", "#7a4bb5", "#b58a2f", "#2f9d7a", "#b52f77", "#4b6b2f"];

function colorFor(seed: string | number): string {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function Avatar({
  name,
  src,
  id,
  size = 32,
}: {
  name: string;
  src?: string;
  id?: number;
  size?: number;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const box = { width: size, height: size, fontSize: Math.round(size * 0.45) };
  if (src) {
    return <img className="avatar" src={src} alt={name} style={box} />;
  }
  return (
    <span className="avatar avatar-initial" style={{ ...box, background: colorFor(id ?? name) }}>
      {initial}
    </span>
  );
}
```

- [ ] **Step 2: Append styles**

Add to the end of `client/src/styles.css`:

```css
/* Account avatars (out-of-character identity) */
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  object-fit: cover;
  flex: 0 0 auto;
  border: 1px solid var(--gold-hairline, rgba(200, 170, 90, 0.35));
  vertical-align: middle;
}
.avatar-initial {
  color: #f7f2e4;
  font-weight: 600;
  line-height: 1;
  text-transform: uppercase;
}
```

- [ ] **Step 3: Verify it typechecks**

```bash
cd client && npx tsc -b --noEmit && cd ..
```

Expected: clean (no output).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Avatar.tsx client/src/styles.css
git commit -m "Profile: reusable Avatar component"
```

---

### Task 6: `ProfilePage`, route, and topbar entry point

**Files:**
- Create: `client/src/pages/ProfilePage.tsx`
- Modify: `client/src/App.tsx` (import + route)
- Modify: `client/src/pages/DashboardPage.tsx:51` (clickable name/avatar) + import
- Modify: `client/src/styles.css` (append profile styles)

- [ ] **Step 1: Create the page**

`client/src/pages/ProfilePage.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, uploadImage, type User } from "../api";
import { useAuth } from "../App";
import { Avatar } from "../components/Avatar";

const BIO_MAX = 280;

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [pronouns, setPronouns] = useState(user?.pronouns ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarPath, setAvatarPath] = useState(user?.avatarPath ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const url = await uploadImage(file);
      setAvatarPath(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const r = await api<{ user: User }>("/api/auth/me/profile", {
        method: "PUT",
        body: JSON.stringify({ displayName, pronouns, bio, avatarPath }),
      });
      setUser(r.user);
      setNotice("Saved.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="ghost link">
          ← Campaigns
        </Link>
        <span className="brand">🪪 Profile</span>
        <span className="spacer" />
        <Link to="/customize" className="ghost link">
          🎨 Customize
        </Link>
      </header>
      <main className="content">
        <section className="card profile-card">
          <div className="profile-head">
            <label className="profile-avatar-pick" title="Upload a profile picture">
              <Avatar name={displayName} src={avatarPath || undefined} id={user?.id} size={96} />
              <span className="profile-avatar-edit">{uploading ? "…" : "✎"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="profile-head-fields">
              <label className="stack">
                <span className="muted small">Display name</span>
                <input
                  value={displayName}
                  maxLength={40}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name at the table"
                />
              </label>
              <label className="stack">
                <span className="muted small">Pronouns</span>
                <input
                  value={pronouns}
                  maxLength={30}
                  onChange={(e) => setPronouns(e.target.value)}
                  placeholder="she/her, they/them…"
                />
              </label>
            </div>
          </div>
          <label className="stack">
            <span className="muted small">
              Bio <span className="muted">({bio.length}/{BIO_MAX})</span>
            </span>
            <textarea
              value={bio}
              maxLength={BIO_MAX}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A line about you the table can see."
            />
          </label>
          {error && <div className="error">{error}</div>}
          {notice && <p className="muted small">{notice}</p>}
          <div className="row-between">
            <span className="muted small">This is your account identity — not your character.</span>
            <button className="primary" onClick={save} disabled={saving || uploading}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Register the route in `App.tsx`**

Add the import near the other page imports in `client/src/App.tsx`:

```tsx
import ProfilePage from "./pages/ProfilePage";
```

Add the route alongside the others (e.g. next to the `/customize` route):

```tsx
        <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/login" />} />
```

- [ ] **Step 3: Make the dashboard topbar name a link to the profile**

In `client/src/pages/DashboardPage.tsx`, add the import at the top:

```tsx
import { Avatar } from "../components/Avatar";
```

Replace line 51 (`<span className="muted">{user?.display_name}</span>`) with:

```tsx
        <Link to="/profile" className="ghost link profile-link">
          <Avatar name={user?.display_name ?? ""} src={user?.avatarPath || undefined} id={user?.id} size={24} />
          <span>{user?.display_name}</span>
        </Link>
```

(`Link` is already imported in DashboardPage.)

- [ ] **Step 4: Append profile styles**

Add to the end of `client/src/styles.css`:

```css
/* Profile page */
.profile-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.profile-card {
  max-width: 34rem;
}
.profile-head {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
  margin-bottom: 1rem;
}
.profile-head-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.profile-avatar-pick {
  position: relative;
  cursor: pointer;
  flex: 0 0 auto;
}
.profile-avatar-edit {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gold, #c9a24b);
  color: #1a1206;
  font-size: 0.85rem;
  border: 2px solid var(--bg-well, #14100a);
}
```

- [ ] **Step 5: Verify in the browser**

Navigate the preview to the profile page and confirm it renders and saves:
- `navigate` tab `tab-1` to `http://localhost:5173/profile`.
- `read_page` — confirm the display-name input, pronouns, bio textarea, and Save button are present.
- Use `form_input` to change the display name to `Melinda`, then `computer` click Save.
- `read_network_requests` — confirm `PUT /api/auth/me/profile` returned 200.
- `navigate` to `http://localhost:5173/` and `read_page` — confirm the topbar now shows the avatar + `Melinda` linking to `/profile`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/ProfilePage.tsx client/src/App.tsx client/src/pages/DashboardPage.tsx client/src/styles.css
git commit -m "Profile: /profile page, route, and topbar entry point"
```

---

### Task 7: Show avatars in member rosters and OOC chat (account-space surfaces)

**Files:**
- Modify: `client/src/dashboard/panels.tsx:~137` (party/roster panel)
- Modify: `client/src/pages/CampaignPage.tsx:~384` (hub roster)
- Modify: `client/src/components/ChatPanel.tsx:59-66` (OOC/whisper author)

- [ ] **Step 1: Roster in the dashboard panel**

In `client/src/dashboard/panels.tsx`, add the import:

```tsx
import { Avatar } from "../components/Avatar";
```

The row currently looks like this:

```tsx
          <li key={m.id} className="row-between">
            <span>
              <span className={ctx.online.has(m.id) ? "dot online" : "dot"} />
              {m.display_name}
            </span>
            <span className={`badge role-${m.role}`}>{m.role.toUpperCase()}</span>
          </li>
```

Insert the `<Avatar>` between the presence dot and the name:

```tsx
              <span className={ctx.online.has(m.id) ? "dot online" : "dot"} />
              <Avatar name={m.display_name} src={m.avatar_path || undefined} id={m.id} size={22} />
              {m.display_name}
```

- [ ] **Step 2: Roster on the hub page**

In `client/src/pages/CampaignPage.tsx`, add the import:

```tsx
import { Avatar } from "../components/Avatar";
```

The row currently looks like this:

```tsx
                <li key={m.id} className="row-between">
                  <span>
                    <span className={online.has(m.id) ? "dot online" : "dot"} />
                    {m.display_name}
                  </span>
                  <span className={`badge role-${m.role}`}>{m.role.toUpperCase()}</span>
                </li>
```

Insert the `<Avatar>` between the presence dot and the name:

```tsx
                    <span className={online.has(m.id) ? "dot online" : "dot"} />
                    <Avatar name={m.display_name} src={m.avatar_path || undefined} id={m.id} size={22} />
                    {m.display_name}
```

- [ ] **Step 3: Avatar on OOC chat authors only**

In `client/src/components/ChatPanel.tsx`, add the import:

```tsx
import { Avatar } from "./Avatar";
```

`ChatPanel` already receives a `members: Member[]` prop (`function ChatPanel({ messages, members, myId, canChat, onSend }: Props)`), and each `Member` now carries `avatar_path` (Task 3). `ChatMessage` objects do not carry the author's avatar, so derive it from `members` by `userId`. Inside the `shown.map((m) => ...)` body (around line 58), before the `chat-author` span, render the avatar for non-IC messages:

```tsx
          {m.channel !== "ic" && (() => {
            const author = members.find((mem) => mem.id === m.userId);
            return (
              <Avatar
                name={m.userName}
                src={author?.avatar_path || undefined}
                id={m.userId}
                size={18}
              />
            );
          })()}
```

Do not add an avatar to IC messages — the character name leads there.

- [ ] **Step 4: Verify it typechecks**

```bash
cd client && npx tsc -b --noEmit && cd ..
```

Expected: clean.

- [ ] **Step 5: Verify in the browser**

- Set an avatar via `/profile` (Task 6) if not already set.
- `navigate` to `http://localhost:5173/campaigns/2` and `read_page`: the party/roster panel shows the avatar next to member names.
- Open chat, post an **OOC** line → its author shows the avatar; post an **IC** line → it shows `Character (Name)` with **no** avatar.
- `read_page` the roll feed after a roll → confirm it is unchanged (person name text, no avatar). This is the immersion boundary holding.

- [ ] **Step 6: Commit**

```bash
git add client/src/dashboard/panels.tsx client/src/pages/CampaignPage.tsx client/src/components/ChatPanel.tsx
git commit -m "Profile: avatars in rosters + OOC chat (account-space only)"
```

---

### Task 8: Final full-build check

- [ ] **Step 1: Client production build**

```bash
cd client && npm run build && cd ..
```

Expected: `tsc -b` passes and `vite build` completes with no errors.

- [ ] **Step 2: Smoke-test the built server path is unaffected (optional)**

The dev servers remain the working target; no commit needed for this step. If anything failed, return to the relevant task.

---

## Self-review notes

- **Spec coverage:** columns (Task 1) ✓; editable name + PUT endpoint (Task 2) ✓; avatar upload via existing endpoint (Task 6 uses `uploadImage`) ✓; pronouns + bio (Tasks 1–2, 6) ✓; `<Avatar>` fallback initial (Task 5) ✓; `/profile` via topbar (Task 6) ✓; avatar reach = topbar + profile + dashboard + hub roster + OOC/whisper chat (Tasks 6–7) ✓; excluded from roll feed / IC chat / tokens (verified negatively in Task 7 Step 5) ✓.
- **Dashboard campaign cards:** the spec lists dashboard "your campaigns" as an avatar surface, but those cards show the *campaign*, not members — the person-avatar entry point there is the topbar (Task 6 Step 3). No separate task needed.
- **Types:** `avatarPath` (camelCase) on the API `User`/`SessionUser` JSON; `avatar_path` (snake_case) on `Member` (raw column, matching existing `display_name` convention). Server column is `avatar_path`. These are intentionally different and used consistently per surface.

# Playtest Notes Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three small playtester-requested features — bullet-list auto-continue in note boxes, a player-picked "style die" added to weapon damage, and a manual DM announcement broadcast that toasts to the whole party.

**Architecture:** Three independent features. A = one client helper wired into two textareas. B = one optional field on the Remnant weapon form + roll-formula tweak. C = one new DM-only REST route that broadcasts over the existing `campaign:${id}` Socket.IO room, plus a self-contained client component (modeled on `CampaignDocks`) mounted on the three campaign screens.

**Tech Stack:** TypeScript, Express + node:sqlite + Socket.IO server, React + Vite client, socket.io-client.

**Verification note:** No unit-test runner in this project. Verify with `tsc`, `curl` against the dev server on `:3001`, and the browser. Dev servers are already running (server `:3001`, client `:5173`); `tsx watch` reloads the server, Vite HMR reloads the client. DM cookie for curl:
```bash
curl -s -c /tmp/cj.txt -X POST localhost:3001/api/auth/dev-login -H 'Content-Type: application/json' -d '{"userId":1}' >/dev/null
```
**Browser gotcha (seen last session):** if HMR shows a stale `Failed to resolve import` after adding a NEW file, restart the Vite server (preview_stop + preview_start `vtt-client`) to rebuild the module graph.

---

### Task A: Bullet-list auto-continue in note textareas

**Files:**
- Create: `client/src/bulletList.ts`
- Modify: `client/src/components/NotesPanel.tsx` (controlled textarea, line ~44)
- Modify: `client/src/components/CodexPanel.tsx` (uncontrolled journal composer, line ~329)

- [ ] **Step 1: Create the helper**

`client/src/bulletList.ts`:

```ts
import type { KeyboardEvent } from "react";

// Matches an indented bullet line: leading whitespace, a marker, one space,
// then the rest of the line (up to the caret).
const BULLET = /^(\s*)([-*•])\s(.*)$/;

// Google-Docs-style list continuation for a plain <textarea>. Works for BOTH
// controlled and uncontrolled textareas: we edit the value via setRangeText
// (which also moves the caret) and then dispatch a native "input" event so a
// controlled component's React onChange fires and its state stays in sync.
export function handleBulletKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key !== "Enter" || e.shiftKey) return;
  const el = e.currentTarget;
  if (el.selectionStart !== el.selectionEnd) return; // ignore range selections
  const caret = el.selectionStart;
  const value = el.value;
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const line = value.slice(lineStart, caret);
  const m = BULLET.exec(line);
  if (!m) return; // not a bullet line — let Enter do its normal thing
  const [, indent, marker, rest] = m;
  e.preventDefault();
  if (rest.trim() === "") {
    // Empty bullet: remove the marker, leaving an empty line (exit the list).
    el.setRangeText("", lineStart, caret, "end");
  } else {
    // Continue: newline + same indentation + same marker + a space.
    el.setRangeText(`\n${indent}${marker} `, caret, caret, "end");
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
```

- [ ] **Step 2: Wire into My Notes (controlled)**

In `client/src/components/NotesPanel.tsx`, add the import at the top:

```tsx
import { handleBulletKeyDown } from "../bulletList";
```

Add `onKeyDown` to the existing textarea (it currently has `className`, `placeholder`, `value`, `disabled`, `onChange`). Insert the handler prop, e.g. right after `disabled={!loaded}`:

```tsx
        onKeyDown={handleBulletKeyDown}
```

- [ ] **Step 3: Wire into the Codex journal composer (uncontrolled)**

In `client/src/components/CodexPanel.tsx`, add the import at the top:

```tsx
import { handleBulletKeyDown } from "../bulletList";
```

Find the journal composer textarea (around line 329):

```tsx
              <textarea name="body" rows={3} placeholder="What happened…" />
```

Add the handler:

```tsx
              <textarea name="body" rows={3} placeholder="What happened…" onKeyDown={handleBulletKeyDown} />
```

- [ ] **Step 4: Typecheck**

```bash
cd client && npx tsc -b --noEmit; cd ..
```
Expected: clean (exit 0).

- [ ] **Step 5: Browser-verify (controller will run this)**

- Open the campaign dashboard, add the "My notes" panel (or use the hub), type `- a` Enter → new line shows `- `; type `b` Enter Enter → second empty bullet clears to a blank line.
- In Codex → Journal composer body, same check.

- [ ] **Step 6: Commit**

```bash
git add client/src/bulletList.ts client/src/components/NotesPanel.tsx client/src/components/CodexPanel.tsx
git commit -m "Notes: auto-continue bullet lists in journal + my-notes textareas"
```

---

### Task B: Player-picked "style die" added to weapon damage

**Files:**
- Modify: `client/src/remnant.ts` (`WeaponForm` interface, ~line 144)
- Modify: `client/src/components/RemnantSheet.tsx` (weapon form select + damage button, lines ~350–399)

- [ ] **Step 1: Add the field to the type**

In `client/src/remnant.ts`, the `WeaponForm` interface currently is:

```ts
export interface WeaponForm {
  type: string;
  range: string;
  damage: number; // die size
  special: string;
}
```

Add an optional style die:

```ts
export interface WeaponForm {
  type: string;
  range: string;
  damage: number; // die size
  styleDie?: number; // optional extra die added to damage (0/undefined = none)
  special: string;
}
```

- [ ] **Step 2: Add the style-die selector next to the damage die**

In `client/src/components/RemnantSheet.tsx`, find the damage-die `<select>` (the one with `title="Damage die"`, closing around line 367). Immediately AFTER that `</select>`, add a second select for the style die (still inside the same `<div className="row-between">`):

```tsx
                  <select
                    value={form.styleDie ?? 0}
                    disabled={ro}
                    title="Style die — added to damage"
                    onChange={(e) =>
                      update({
                        weaponForms: d.weaponForms.map((f, j) =>
                          j === i ? { ...f, styleDie: num(e.target.value, 0) } : f
                        ),
                      })
                    }
                  >
                    <option value={0}>+ —</option>
                    {DIE_SIZES.map((s) => (
                      <option key={s} value={s}>
                        +d{s}
                      </option>
                    ))}
                  </select>
```

(`num` and `DIE_SIZES` are already used in this file for the damage select.)

- [ ] **Step 3: Include the style die in the damage roll**

Find the Damage button (around lines 392–399):

```tsx
                  <button
                    className="ghost mini"
                    onClick={() =>
                      roll(`1d${form.damage}`, `${name}: ${form.type || `Form ${i === 0 ? "A" : "B"}`} damage`)
                    }
                  >
                    Damage (d{form.damage})
                  </button>
```

Replace it with:

```tsx
                  <button
                    className="ghost mini"
                    onClick={() =>
                      roll(
                        form.styleDie ? `1d${form.damage}+1d${form.styleDie}` : `1d${form.damage}`,
                        `${name}: ${form.type || `Form ${i === 0 ? "A" : "B"}`} damage`
                      )
                    }
                  >
                    Damage (d{form.damage}{form.styleDie ? ` + d${form.styleDie}` : ""})
                  </button>
```

- [ ] **Step 4: Typecheck**

```bash
cd client && npx tsc -b --noEmit; cd ..
```
Expected: clean.

- [ ] **Step 5: Browser-verify (controller)**

On a Remnant sheet, set a weapon form's damage to d8 and style die to d6 → the button reads `Damage (d8 + d6)`; clicking posts `1d8+1d6` through the roll feed. Set style die back to `+ —` → button reads `Damage (d8)` and posts `1d8`.

- [ ] **Step 6: Commit**

```bash
git add client/src/remnant.ts client/src/components/RemnantSheet.tsx
git commit -m "Sheet: optional style die added to weapon damage rolls"
```

---

### Task C1: DM announcement broadcast endpoint (server)

**Files:**
- Modify: `server/src/campaigns.ts` (add route + ensure `getIo` import)

- [ ] **Step 1: (No import change needed)**

`server/src/campaigns.ts` already imports `getIo` from `./realtime.js` (line 5) and already uses it to emit `campaign:update`. Nothing to add here.

- [ ] **Step 2: Add the announce route**

Add this handler to `campaignsRouter` (place it after the existing `get("/:id", ...)` handler). It uses the same `user(req)` and `memberRole(...)` helpers already used in this file:

```ts
// Manual DM broadcast — pops a transient toast for everyone in the campaign.
// Not persisted; purely a live notification over the campaign socket room.
campaignsRouter.post("/:id/announce", (req, res) => {
  const id = Number(req.params.id);
  const role = memberRole(id, user(req).id);
  if (role !== "dm" && role !== "co-dm") {
    return res.status(403).json({ error: "Only the DM can send announcements." });
  }
  const message = String(req.body?.message ?? "").trim();
  const kind = ["info", "combat", "quest", "alert"].includes(req.body?.kind)
    ? req.body.kind
    : "info";
  if (!message) return res.status(400).json({ error: "Announcement can't be empty." });
  if (message.length > 200) {
    return res.status(400).json({ error: "Announcement is too long (200 characters max)." });
  }
  getIo().to(`campaign:${id}`).emit("announcement:push", {
    campaignId: id,
    message,
    kind,
    at: Date.now(),
    from: user(req).display_name,
  });
  res.json({ ok: true });
});
```

- [ ] **Step 3: Verify (server auto-restarts)**

```bash
curl -s -c /tmp/cj.txt -X POST localhost:3001/api/auth/dev-login -H 'Content-Type: application/json' -d '{"userId":1}' >/dev/null
# DM sends -> ok
curl -s -b /tmp/cj.txt -X POST localhost:3001/api/campaigns/2/announce -H 'Content-Type: application/json' -d '{"message":"A Beowolf lunges!","kind":"combat"}'
# empty -> 400
curl -s -b /tmp/cj.txt -X POST localhost:3001/api/campaigns/2/announce -H 'Content-Type: application/json' -d '{"message":"   "}'
```
Expected: first `{"ok":true}`; second `{"error":"Announcement can't be empty."}`.

- [ ] **Step 4: Commit**

```bash
git add server/src/campaigns.ts
git commit -m "Announce: DM broadcast endpoint over the campaign socket room"
```

---

### Task C2: Announcement toast + DM composer (client)

**Files:**
- Create: `client/src/components/AnnouncementCenter.tsx`
- Modify: `client/src/pages/CampaignDashboardPage.tsx`, `client/src/pages/MapPage.tsx`, `client/src/pages/CampaignPage.tsx` (mount the component)
- Modify: `client/src/styles.css` (append toast + composer styles)

- [ ] **Step 1: Create the component**

`client/src/components/AnnouncementCenter.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api } from "../api";

type Kind = "info" | "combat" | "quest" | "alert";
interface Announcement {
  campaignId: number;
  message: string;
  kind: Kind;
  at: number;
  from: string;
}

const KIND_ICON: Record<Kind, string> = { info: "📣", combat: "⚔️", quest: "📜", alert: "⚠️" };

// Self-contained (like CampaignDocks): opens its own campaign room join, toasts
// any announcement:push, and — for the DM — shows a compose control. Mounted
// once per campaign screen.
export default function AnnouncementCenter({ campaignId }: { campaignId: number }) {
  const [isDM, setIsDM] = useState(false);
  const [toast, setToast] = useState<Announcement | null>(null);
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<Kind>("info");
  const timer = useRef<number>();

  useEffect(() => {
    api<{ yourRole: string }>(`/api/campaigns/${campaignId}`)
      .then((r) => setIsDM(r.yourRole === "dm" || r.yourRole === "co-dm"))
      .catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    const socket: Socket = io();
    socket.on("connect", () => socket.emit("campaign:join", campaignId));
    socket.on("announcement:push", (a: Announcement) => {
      if (a.campaignId !== campaignId) return;
      setToast(a);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), 6000);
    });
    return () => {
      socket.disconnect();
    };
  }, [campaignId]);

  const send = async () => {
    const text = message.trim();
    if (!text) return;
    try {
      await api(`/api/campaigns/${campaignId}/announce`, {
        method: "POST",
        body: JSON.stringify({ message: text, kind }),
      });
      setMessage("");
      setComposing(false);
    } catch {
      /* surfaced by the toast on the receiving side; ignore here */
    }
  };

  return (
    <>
      {toast && (
        <div className={`announce-toast kind-${toast.kind}`} onClick={() => setToast(null)}>
          <span className="announce-icon">{KIND_ICON[toast.kind]}</span>
          <div className="announce-text">
            <strong>{toast.message}</strong>
            <span className="muted small"> — {toast.from}</span>
          </div>
        </div>
      )}
      {isDM && (
        <div className="announce-dm">
          <button className="ghost mini" onClick={() => setComposing((v) => !v)}>
            📣 Announce
          </button>
          {composing && (
            <div className="announce-compose card">
              <input
                value={message}
                maxLength={200}
                placeholder="Tell the party…"
                autoFocus
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
              />
              <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                <option value="info">Info</option>
                <option value="combat">Combat</option>
                <option value="quest">Quest</option>
                <option value="alert">Alert</option>
              </select>
              <button className="primary" onClick={send}>
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Mount on the three campaign screens**

In each of `CampaignDashboardPage.tsx`, `MapPage.tsx`, and `CampaignPage.tsx`:
- Add the import: `import AnnouncementCenter from "../components/AnnouncementCenter";`
- Render `<AnnouncementCenter campaignId={campaignId} />` inside the page's root wrapper (top level of the returned JSX, alongside where docks/other floating UI are rendered). All three pages declare `const campaignId = Number(id)` (confirmed: CampaignDashboardPage:43, MapPage:132, CampaignPage:33), so use `campaignId` directly.

- [ ] **Step 3: Append styles**

Add to the END of `client/src/styles.css`:

```css
/* DM announcements */
.announce-dm {
  position: fixed;
  bottom: 0.8rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 95;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}
.announce-compose {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  padding: 0.5rem;
}
.announce-compose input {
  min-width: 16rem;
}
.announce-toast {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 96;
  max-width: min(90vw, 34rem);
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 1rem;
  border-radius: 0.6rem;
  background: var(--bg-well, #14100a);
  border: 1px solid var(--gold-hairline, rgba(200, 170, 90, 0.5));
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  animation: announce-in 160ms ease-out;
}
@keyframes announce-in {
  from { opacity: 0; transform: translate(-50%, -8px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
.announce-icon { font-size: 1.3rem; }
.announce-toast.kind-combat { border-color: #c0392b; }
.announce-toast.kind-alert { border-color: #e0a021; }
.announce-toast.kind-quest { border-color: var(--gold, #c9a24b); }
```

- [ ] **Step 4: Typecheck**

```bash
cd client && npx tsc -b --noEmit; cd ..
```
Expected: clean.

- [ ] **Step 5: Browser-verify (controller)**

- As DM on the dashboard, click **📣 Announce**, type "A Beowolf lunges!", pick **Combat**, Send → a red-bordered toast appears top-center and auto-dismisses after ~6s.
- Confirm a non-DM viewer has no **📣 Announce** control (dev-login as a player).
- Confirm the roll feed / other UI is unaffected.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/AnnouncementCenter.tsx client/src/pages/CampaignDashboardPage.tsx client/src/pages/MapPage.tsx client/src/pages/CampaignPage.tsx client/src/styles.css
git commit -m "Announce: toast + DM composer, mounted on campaign screens"
```

---

### Task D: Final build check

- [ ] **Step 1: Full production build**

```bash
cd client && npm run build && cd ..
```
Expected: `tsc -b` + `vite build` succeed (pre-existing chunk-size warning is fine).

- [ ] **Step 2:** If anything failed, return to the owning task; otherwise done.

---

## Self-review notes
- **Spec coverage:** A (bullets) → Task A, both textareas ✓; B (weapon die + player-picked style die) → Task B ✓; C (DM manual broadcast, typed, toast to all, DM-only control) → Tasks C1+C2 ✓; #2 (no work) — untouched ✓.
- **Controlled vs uncontrolled textarea:** handled by one code path (setRangeText + dispatched `input`), verified applies to NotesPanel (controlled) and CodexPanel journal (uncontrolled).
- **Types:** `Kind` union is identical in server validation (`["info","combat","quest","alert"]`) and client (`type Kind`). `styleDie?: number` optional so existing character JSON needs no migration. `announcement:push` payload shape matches between `campaigns.ts` emit and `AnnouncementCenter` interface.
- **No new DB:** Feature C is transient (socket only); Feature B stores in the existing character JSON blob; Feature A is client-only.
- **Deferred (per spec):** auto-triggered notifications, announcement history, numbered lists, bullets in other boxes.

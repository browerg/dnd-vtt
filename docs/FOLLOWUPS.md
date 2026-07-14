# Follow-ups & known rough edges

Non-blocking items noticed during development and code review. Nothing here is
broken enough to stop a game night — these are "could be a problem later" notes
so they aren't forgotten. Grouped by feature. Delete an item when it's fixed.

## Announcements (DM broadcast)
- **Send failures are silent.** `client/src/components/AnnouncementCenter.tsx`
  `send()` swallows API errors in an empty `catch` (with a misleading comment).
  If a broadcast fails — network blip, or a non-DM somehow triggers it — the DM
  gets no feedback; the composer just closes. Fix: surface the error to the DM.
- **Toast timer not cleared on unmount.** The ~6s auto-dismiss `setTimeout` isn't
  cleared when the component unmounts (only on the next event). Harmless in
  practice, but inconsistent with the timer-cleanup pattern used elsewhere.
- **Auto-triggered notifications are deferred (by design).** Right now the DM
  sends announcements by hand. A future nicety: fire them automatically on game
  events — a monster spawned, a token dropped to 0 HP ("downed"), a quest
  revealed. Bigger wiring (hooks into monster spawn / HP changes / quest reveal);
  intentionally punted.

## Profile / avatars
- **No upload-ownership check.** Any logged-in user could set their avatar to any
  known `/uploads/<file>` URL, not just one they uploaded. Low impact (uploads are
  already unauthenticated static files), matches the app's existing upload model.
- **No orphan cleanup.** Replacing an avatar leaves the old image file on disk
  (same "kept simple" tradeoff as the other uploaders). Harmless for a private
  tool; would matter if disk use ever grows.

## App-wide
- **Redundant websockets per page.** There's no shared socket context — each page
  (dashboard/map/hub) opens its own `io()` connection, and several components
  (`CampaignDocks`, `AnnouncementCenter`, `SheetView`/`useCharacterData`) each open
  their own too. `socket.io-client`'s `io()` returns a *new* connection per call
  for the same namespace, so this is safe (verified), just wasteful. A shared
  `SocketContext` would collapse them into one connection per page — a good
  cleanup once things settle.

# Hosting — getting the table online for game night

The app is a single Node process: Express serves the API, Socket.IO, uploads,
**and** the built client. SQLite and uploaded maps live in `server/data/`.
That means "hosting" is just: run one process somewhere your friends can reach.

## Run it in production mode (works the same everywhere)

```bash
npm install
npm run build     # builds the client into client/dist
npm start         # serves everything on http://localhost:3001
```

`PORT=8080 npm start` to change the port. The dev quick-login buttons are
hard-disabled outside `npm run dev` — verified: the endpoints 404 under
`npm start`.

**Back up by copying `server/data/`** (the SQLite db + uploaded maps). Do this
before updating, and occasionally after sessions.

---

## Option A — Cloudflare Tunnel from this PC (recommended first)

Zero cost, no port forwarding, no VPS to babysit. Your PC must be on during
game night (it already will be — you're the DM).

1. Install: `winget install Cloudflare.cloudflared`
2. Start the app: `npm run build && npm start`
3. Quick tunnel (new random URL each time — fine for a first game night):
   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```
   It prints a `https://something.trycloudflare.com` URL. Send it to the group.
4. Permanent URL later: make a free Cloudflare account, add a domain (~$10/yr),
   and create a **named tunnel** (`cloudflared tunnel create tabletop`) so the
   link never changes. Docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

Pros: HTTPS for free, nothing exposed on your router, 5-minute setup.
Cons: PC must stay awake; uploads ride your home upload bandwidth.

## Option B — Tailscale (most private, friends install an app)

Everyone installs Tailscale and joins your tailnet (free for 3 users on the
free plan — invite more via a shared network). The app is only reachable
inside the private network; nothing is on the public internet at all.

1. Install Tailscale on your PC and each friend's device, same tailnet.
2. `npm run build && npm start`
3. Friends open `http://<your-tailscale-hostname>:3001`.

Pros: genuinely private; zero exposure. Cons: everyone installs something;
free plan user limits may pinch a bigger group.

## Option C — a small VPS (always on, ~$5/mo)

Hetzner CX22 / DigitalOcean basic droplet. Ubuntu + Node 22+ (needs
`node:sqlite`, so Node 22.5 or newer; Node 24 recommended).

```bash
git clone <your repo> && cd dnd-vtt
npm install && npm run build
```

Run it under systemd (`/etc/systemd/system/tabletop.service`):

```ini
[Unit]
Description=Tabletop VTT
After=network.target

[Service]
WorkingDirectory=/opt/dnd-vtt
ExecStart=/usr/bin/npm start
Restart=always
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

Put Caddy in front for automatic HTTPS (`caddy reverse-proxy --from
your-domain.com --to localhost:3001`) or use a Cloudflare Tunnel from the VPS.

Pros: always on, stable URL, doesn't care if your PC sleeps.
Cons: costs money; you own updates/backups; 500MB map uploads want decent disk.

---

## Which one for game night #1?

**Option A quick tunnel.** It's one command on top of what already runs, and
if it holds up through a session, graduate to a named tunnel with a real
domain. Fall back to Option B if the group is happy installing Tailscale.

## Pre-game-night checklist

- [ ] `npm run build && npm start` locally, click through a campaign
- [ ] Tunnel up, open the public URL from a phone (not on home Wi-Fi)
- [ ] Friends create accounts, join via invite links
- [ ] Copy `server/data/` somewhere safe
- [ ] Keep the PC's sleep settings off for the session

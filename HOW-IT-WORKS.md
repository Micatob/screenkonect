# How ScreenKonect Works (Like I'm 5)

## The Big Picture

Imagine you want to help your friend fix their computer, but they live far away. ScreenKonect is like a **magic window** that lets you see their screen and help them — but **only if they say "YES"**.

```
┌──────────────┐        Magic Window         ┌──────────────┐
│   YOU        │  ◀──────────────────────▶  │   FRIEND     │
│ (Technician) │    You see their screen     │   (Client)   │
│              │    They click "Approve"     │              │
└──────────────┘                             └──────────────┘
```

---

## The Three Players

| Who | What They Do |
|-----|--------------|
| **Technician** (You) | Opens the Dashboard, clicks "New Session," sends a link |
| **Client** (Friend) | Opens the link, sees a big "Approve" button, clicks it |
| **Server** (Our computer) | Makes the connection, keeps it safe, writes down what happened |

---

## Step by Step (With Pictures)

### 1. You Start the Server
```bash
docker compose -f deploy/docker-compose.yaml up -d --build
```
This starts **all the pieces** in little boxes (containers):
- A database (remembers things)
- A memory box (Redis, talks fast)
- 5 helper programs (APIs)
- 2 websites (Dashboard + Consent Page)

### 2. You Open the Dashboard
Go to: **http://localhost:8090** (gateway single-port) or **http://localhost:5173** direct
user email: `you@screenkonect.local`
user password: ScreenKonect123!`
Log in → Click **"New Session"**

> **Heads up:** the Dashboard only shows a *login* screen — there is **no
> "Sign up" button** in the app yet. To make an account, register through the
> API (see the README "Creating an account" note) or ask whoever runs the
> server to create one for you. Once you have email + password, just log in.

### 3. You Get a Magic Link
The dashboard shows a link like:
```
http://localhost:8090/join/ABC123?token=xyz789
```
(via gateway - single port. Old direct was `5174`. Gateway auto-generates correct host `services/session/src/routes/sessions.ts:101`)
**Copy this link and send it to your friend** (email, text, Discord, carrier pigeon...)

### 4. Friend Opens the Link
They see this in their browser:

```
┌─────────────────────────────────────┐
│  🔒  ScreenKonect - Consent Required │
│  ─────────────────────────────────  │
│                                      │
│  John Doe wants to help you.        │
│                                      │
│  They will see:  ☑ Your Screen      │
│  They can:       ☐ Control Mouse    │
│                  ☐ Copy/Paste       │
│                  ☐ Send Files       │
│                                      │
│        [ DENY ]      [ APPROVE ]     │
│                                      │
└─────────────────────────────────────┘
```

### 5. Friend Clicks "APPROVE"
**Boom!** You now see their screen in your dashboard. They see a red "🔴 Screen Shared" badge that **cannot be hidden**.

### 6. Either of You Can Stop Anytime
- Friend clicks "End Session" → **Stops instantly**
- You click "End Session" → **Stops instantly**
- No arguing, no waiting, no backdoors.

---

## Why It's Safe (No Sneaky Stuff)

| Scary Thing | ScreenKonect Says |
|-------------|-------------------|
| "Can they see me without asking?" | **NO** — Nothing happens until "Approve" |
| "Can they come back later?" | **NO** — Link works **once**, expires in 15 min |
| "Is it secret?" | **NO** — Red badge always shows when sharing |
| "Can they install viruses?" | **NO** — Only sees screen, only controls if allowed |
| "Is there a hidden program?" | **NO** — Close browser = session over |

---

## 🐳 Docker: The Easy Button (Do This First)

### What is Docker?
Think of Docker like a **lunchbox**. Each program gets its own lunchbox with everything it needs. They don't fight, they don't mess up your computer, and you can throw the whole lunchbox away when done.

### One Command Starts Everything
```bash
# Run this ONCE from the project folder
docker compose -f deploy/docker-compose.yaml up -d --build
```

### What Happens
| Container | Port | What It Is |
|-----------|------|------------|
| `screenkonect-postgres` | 5432 | Database (memory) |
| `screenkonect-redis` | 6380 | Fast messenger |
| `screenkonect-auth` | 4000 | Login helper |
| `screenkonect-session` | 4001 | Session boss |
| `screenkonect-signaling` | 4002 | Connection matcher |
| `screenkonect-audit` | 4003 | Diary keeper |
| `screenkonect-device` | 4004 | Device manager |
| `screenkonect-web-dashboard` | **5173** | **YOUR dashboard** (via gateway 8090 `/`) |
| `screenkonect-client-consent-ui` | **5174** | **Friend's page** (via gateway 8090 `/join`) |
| `screenkonect-gateway` | **8090** | **Single public port** - Caddy routes all |

### Check It's Working
```bash
# See all boxes running
docker compose -f deploy/docker-compose.yaml ps

# Should say "healthy" for each
```

### Stop Everything
```bash
docker compose -f deploy/docker-compose.yaml down
```

### Start Again Later (Faster - No Rebuild)
```bash
docker compose -f deploy/docker-compose.yaml up -d
```

---

## ☁️ Share With Anyone (Pick One - Gateway 8090 Makes It 1 Port)

### The Problem
Your friend is at **their house** (different WiFi). They can't reach your `localhost:8090`.

### The Old Way (Hard)
- Log into router
- Forward ports 4000-4004, 5173, 5174, 8090
- Hope your ISP doesn't block it (Nigeria ISPs often use CGNAT - no public IP)
- Get a static IP or use dynamic DNS
- **Scary and breaks often - now only 1 port 8090 via gateway, not 7**

### Option A: Tailscale Funnel (RECOMMENDED for Nigeria - Free, No Port Forward, 1 Port)

Tailscale Funnel exposes your **local gateway 8090** to the public internet via WireGuard. Client needs **nothing** - just a browser. Free (no card), already installed on this PC `100.65.87.116`.

**Step 1: Enable Funnel once (one click):**
Visit the link `tailscale funnel` printed:
```
https://login.tailscale.com/f/funnel?node=npV6HLYRjb11CNTRL
```
Or `https://login.tailscale.com/admin/machines` -> `desktop-a780de3` -> `...` -> `Enable Funnel` / `Edit route settings`.

**Step 2: Start Server + Funnel:**
```powershell
docker compose -f deploy/docker-compose.yaml up -d
# wait healthy: docker compose -f deploy/docker-compose.yaml ps
& "C:\Program Files\Tailscale\tailscale.exe" funnel --bg 8090
# prints: https://desktop-a780de3.tailxxxxx.ts.net
# check: & "C:\Program Files\Tailscale\tailscale.exe" funnel status
```

**Step 3: Use It!**
- You open: `https://desktop-a780de3.tailxxxxx.ts.net` (dashboard)
- Friend opens: `https://desktop-a780de3.tailxxxxx.ts.net/join/ABC123?token=xyz789` (replace `localhost:8090` in dashboard link with funnel host)
- Works exactly like local, but over the internet via gateway `deploy/Caddyfile:1`

**Stop:** `& "C:\Program Files\Tailscale\tailscale.exe" funnel --bg --off` + `docker compose down`

**Private alternative (tailnet only, more secure):**
```powershell
& "C:\Program Files\Tailscale\tailscale.exe" serve --bg 8090
# https://desktop-a780de3.tailxxxxx.ts.net - only tailnet devices can open (need to invite friend to tailnet)
# enable via: https://login.tailscale.com/f/serve?node=npV6HLYRjb11CNTRL
```

### Option B: Cloudflare Tunnel (Also Free, 1 Port via Gateway)

Also works via single `8090` now (old way needed 2 tunnels for 5173+5174).

```powershell
C:\Users\Hermes\cloudflared.exe tunnel --url http://localhost:8090
# prints: https://happy-cat-1234.trycloudflare.com
# You: https://happy-cat-1234.trycloudflare.com
# Friend: https://happy-cat-1234.trycloudflare.com/join/ABC123?token=xyz
# Keep terminal open
```

**Permanent Cloudflare (one hostname):**
```yaml
# C:\Users\Hermes\.cloudflared\config.yml
tunnel: screenkonect
credentials-file: C:\Users\Hermes\.cloudflared\<tunnel-id>.json
ingress:
  - hostname: screenkonect.yourdomain.com
    service: http://localhost:8090
  - service: http_status:404
```
```powershell
C:\Users\Hermes\cloudflared.exe tunnel run screenkonect
```

---

## 📋 Quick Checklist

### First Time Setup
- [ ] Install Docker Desktop
- [ ] Install Tailscale (already done: `C:\Program Files\Tailscale\tailscale.exe`)
- [ ] Run `docker compose -f deploy/docker-compose.yaml up -d --build`
- [ ] Wait for all "healthy" (`docker compose ps` - 10 containers incl. gateway 8090)
- [ ] Open http://localhost:8090
- [ ] Register account
- [ ] Click "New Session"
- [ ] Test locally first (open consent link in another browser tab)

### For Internet Access (Tailscale Funnel - 1 Port)
- [ ] Start docker stack
- [ ] Enable Funnel once: visit `https://login.tailscale.com/f/funnel?node=...` (from `tailscale funnel` output)
- [ ] Run: `& "C:\Program Files\Tailscale\tailscale.exe" funnel --bg 8090`
- [ ] Copy `https://desktop-a780de3.tailxxxxx.ts.net`
- [ ] Send `https://desktop-a780de3.tailxxxxx.ts.net/join/xxx?token=yyy` to friend (replace localhost:8090)
- [ ] Keep funnel running during session

### Alternative: Cloudflare (1 Port via Gateway)
- [ ] `C:\Users\Hermes\cloudflared.exe tunnel --url http://localhost:8090`
- [ ] Send `https://xxx.trycloudflare.com/join/xxx` link

### When Done
- [ ] Friend clicks "End Session" or you click "End Session"
- [ ] `& "C:\Program Files\Tailscale\tailscale.exe" funnel --bg --off` or `Ctrl+C` cloudflared
- [ ] `docker compose -f deploy/docker-compose.yaml down`

---

## 🆘 Troubleshooting (Simple Fixes)

| Problem | Fix |
|---------|-----|
| "Port already in use" | Change ports in `.env` file (see README) |
| "Container not healthy" | `docker compose logs -f <name>` to see why |
| "Friend can't connect" | Make sure BOTH cloudflared terminals are running |
| "WebSocket error" | Check cloudflared is tunneling port 5173 (dashboard proxies signaling) |
| "Permission denied" | Friend must click "Approve" — you can't do it for them |
| "Screen is black" | Friend needs to grant screen recording permission (OS prompt) |
| "No Sign up button" | Expected — registration is via the API, not the UI yet (see README) |
| "Can't create a session (404/500 on New Session)" | The Dashboard sends `POST /v1/sessions` to the **session** service, not auth. If you edited the compose `environment:` (e.g. `VITE_SESSION_TARGET`), you must recreate the container with `docker compose up -d` — `restart` alone won't apply it. |

---

## 🎯 TL;DR (Too Long; Didn't Read)

```bash
# 1. Start everything
docker compose -f deploy/docker-compose.yaml up -d --build

# 2. You use: http://localhost:5173
# 3. Friend uses: http://localhost:5174/join/TOKEN

# 4. For internet: TWO terminals
cloudflared tunnel --url http://localhost:5173   # YOUR link
cloudflared tunnel --url http://localhost:5174   # FRIEND'S link
```

**That's it.** The rest is just details. 🎉
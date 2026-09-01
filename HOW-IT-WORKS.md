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
Go to: **http://localhost:5173**
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
http://localhost:5174/join/ABC123?token=xyz789
```
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
| `screenkonect-web-dashboard` | **5173** | **YOUR dashboard** |
| `screenkonect-client-consent-ui` | **5174** | **Friend's page** |

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

## ☁️ Cloudflare Tunnel: Share With Anyone (FREE)

### The Problem
Your friend is at **their house** (different WiFi). They can't reach your `localhost:5174`.

### The Old Way (Hard)
- Log into router
- Forward ports 4000-4004, 5173, 5174
- Hope your ISP doesn't block it
- Get a static IP or use dynamic DNS
- **Scary and breaks often**

### The Cloudflare Way (Easy, Free, 52MB)
Cloudflare Tunnel makes a **secret underground tunnel** from your computer to Cloudflare's big computers. Your friend uses a nice `https://` link. **No router changes. No open ports.**

### Step 1: Get cloudflared (Already Done!)
You already downloaded it: `C:\Users\Hermes\cloudflared.exe` (~52 MB)

### Step 2: Start Your Server First
```bash
docker compose -f deploy/docker-compose.yaml up -d
```
Wait for all containers to say "healthy"

### Step 3: Open TWO Terminal Windows

**Terminal 1 — Your Dashboard (Port 5173):**
```powershell
C:\Users\Hermes\cloudflared.exe tunnel --url http://localhost:5173
```
It prints something like:
```
https://happy-cat-1234.trycloudflare.com
```
**→ This is YOUR link. Bookmark it.**

**Terminal 2 — Friend's Consent Page (Port 5174):**
```powershell
C:\Users\Hermes\cloudflared.exe tunnel --url http://localhost:5174
```
It prints:
```
https://sleepy-dog-5678.trycloudflare.com
```
**→ Send THIS link to your friend.**

### Step 4: Use It!
- You open: `https://happy-cat-1234.trycloudflare.com`
- Friend opens: `https://sleepy-dog-5678.trycloudflare.com/join/ABC123?token=xyz789`
- Everything works exactly like local — but over the internet!

### Keep Terminals Open
**The tunnel only works while those terminal windows are open.**
- Close terminal = tunnel closes
- Minimize is fine, just don't click X

### Pro Tip: Make It Permanent (Free Account)
```powershell
# 1. Login (opens browser)
C:\Users\Hermes\cloudflared.exe tunnel login

# 2. Create named tunnel
C:\Users\Hermes\cloudflared.exe tunnel create screenkonect

# 3. Make config file at C:\Users\Hermes\.cloudflared\config.yml
```
```yaml
tunnel: screenkonect
credentials-file: C:\Users\Hermes\.cloudflared\<tunnel-id>.json
ingress:
  - hostname: dashboard.yourdomain.com
    service: http://localhost:5173
  - hostname: consent.yourdomain.com
    service: http://localhost:5174
  - service: http_status:404
```
```powershell
# 4. Run it (can run in background as a service)
C:\Users\Hermes\cloudflared.exe tunnel run screenkonect
```
Now you get **permanent addresses** like `https://dashboard.yourdomain.com` instead of random ones.

---

## 📋 Quick Checklist

### First Time Setup
- [ ] Install Docker Desktop
- [ ] Run `docker compose -f deploy/docker-compose.yaml up -d --build`
- [ ] Wait for all "healthy"
- [ ] Open http://localhost:5173
- [ ] Register account
- [ ] Click "New Session"
- [ ] Test locally first (open consent link in another browser tab)

### For Internet Access
- [ ] Start docker stack
- [ ] Open Terminal 1: `cloudflared tunnel --url http://localhost:5173`
- [ ] Open Terminal 2: `cloudflared tunnel --url http://localhost:5174`
- [ ] Copy the two `https://*.trycloudflare.com` URLs
- [ ] Send the **consent URL** (port 5174 one) to friend with the join token
- [ ] Keep both terminals open during session

### When Done
- [ ] Friend clicks "End Session" or you click "End Session"
- [ ] Close cloudflared terminals (Ctrl+C)
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
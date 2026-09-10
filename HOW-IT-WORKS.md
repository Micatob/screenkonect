# How ScreenKonect Works

## What It Is

Remote desktop support with consent. You (technician) help a friend fix their computer/phone by seeing their screen. Nothing happens until they click "Allow access".

---

## After Restarting Your PC — Do This

### Step 1: Start Docker

```powershell
cd "C:\Users\Hermes\Desktop\screen konect"
docker compose -f deploy/docker-compose.yaml up -d
```

Wait 40 seconds, then check:
```powershell
docker ps --filter "name=screenkonect" --format "table {{.Names}}\t{{.Status}}"
```

All 8 should say "Up" (healthy).

### Step 2: Start Tailscale Funnel (for internet access)

```powershell
& "C:\Program Files\Tailscale\tailscale.exe" funnel --bg 8090
```

It prints your public URL: `https://screenkonect.tail8a6c48.ts.net`

### Step 3: Open Dashboard

Go to: **https://screenkonect.tail8a6c48.ts.net**
- **Email:** `you@screenkonect.local`
- **Password:** `ScreenKonect123!`

> No "Sign up" button in the UI yet. Account is pre-created via API. Just log in.

### Step 4: Create Session

Click **"New Session"** — you get a join link like:
```
https://screenkonect.tail8a6c48.ts.net/join/ABC123?token=xyz
```

### Step 5: Send Link to Friend

Send that link via WhatsApp, SMS, email, anything. Your friend opens it on **any device** (Android phone, iPhone, Windows PC, Mac).

### Step 6: Friend Approves

Friend sees the consent screen, taps **"Allow access"**, selects what to share:
- **Phone**: select "Entire screen" → tap "Start recording"
- **PC**: select screen/window → click "Share"

You now see their screen in your dashboard.

### Step 7: End Session

Either of you clicks **"End Session"** — access stops instantly.

---

## Stopping Everything

```powershell
# Stop funnel
& "C:\Program Files\Tailscale\tailscale.exe" funnel reset

# Stop Docker
docker compose -f deploy/docker-compose.yaml down
```

---

## How Friends Use It (Phone or PC)

| Step | What Friend Does |
|------|-----------------|
| 1 | Opens the link you sent in Chrome browser |
| 2 | Taps "Allow access" |
| 3 | Selects "Entire screen" (phone) or picks a window (PC) |
| 4 | Taps "Start recording" / "Share" |
| 5 | Done — you see their screen |

**No install needed. No account needed. Just a browser.**

### Android Tips
- Use **Chrome** browser (other browsers may not work)
- Android 10+ for full screen sharing
- Tap Chrome menu (⋮) → "Add to Home Screen" for quick re-access

---

## Internet Access Options

| Method | Command | Friend Installs? |
|--------|---------|-----------------|
| **Tailscale Funnel** (recommended) | `tailscale funnel --bg 8090` | Nothing |
| **Cloudflare Tunnel** (free) | `cloudflared tunnel --url http://localhost:8090` | Nothing |
| **VPS** (your Termius server) | Already deployed at `168.222.97.214:8090` | Nothing |

All three: friends just open a URL in their browser.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Container not healthy" | `docker compose -f deploy/docker-compose.yaml logs -f <name>` |
| "Friend can't connect" | Make sure funnel is running (`tailscale funnel status`) |
| "Screen sharing blocked" | Use HTTPS (Tailscale/Cloudflare/VPS). Plain HTTP blocks screen sharing |
| "No Sign up button" | Normal — register via API first (see README) |
| "New Session returns error" | Recreate: `docker compose -f deploy/docker-compose.yaml up -d --force-recreate session` |
| "Android: only shares browser tab" | Select "Entire screen" when prompted, not "Chrome tab" |
| "Funnel not working" | `tailscale funnel reset` then `tailscale funnel --bg 8090` again |

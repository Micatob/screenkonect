# ScreenKonect — Where Things Stand & What To Do Next

Read this top to bottom. No step needs Docker knowledge beyond copy-paste.

## 1. The three links (what works where)

| Link | Works from anywhere? | Login + create session? | Screen SHARING? |
|---|---|---|---|
| `http://localhost:8090` (your PC) | No — your PC only | Yes | Yes (viewing side; localhost counts as secure) |
| `https://screenkonect.tail8a6c48.ts.net` (Tailscale funnel, PC Docker must be ON) | **Yes — any network, phone data included** | Yes | **Yes — this is the sharing link to use now** |
| `http://169.35.179.55:8090` (VPS) | Yes, once the firewall is opened | Yes | **No — browsers block screen capture on plain http. No workaround.** |

Rule to remember: **pages work over http, screen sharing needs https.**
That one rule explains every black screen / stuck "Starting..." so far.

## 2. What is already done and working

- PC Docker: all services healthy, pages load in under 1 second (used to be 17–38s).
- Funnel link above is live whenever your PC + Docker + `tailscale funnel --bg 8090` run.
- VPS `169.35.179.55`: app installed, 7/7 containers healthy, tech account exists
  (`you@screenkonect.local` / `ScreenKonect123!`). Only the provider firewall
  blocks the outside world (see section 4).
- Phone app no longer shows technical errors; your PC session page shows
  Waiting / Connecting / Live / Failed so you always know the state.
- Proof the server path works: a simulated client offer reached a simulated
  technician through the gateway. Remaining failures are all client-side
  (wrong link, wrong browser, or unfinished permission taps).

## 3. Your idea (subdomain of hiresphere.com.ng) — yes, do it exactly like this

Your live site stays untouched. ScreenKonect gets its own address:

- Main site `hiresphere.com.ng` → stays at `199.36.158.100`. Do not change it.
- New address `support.hiresphere.com.ng` → points at the VPS `169.35.179.55`.
- The VPS then gets its own free https certificate automatically, and join links
  become `https://support.hiresphere.com.ng/join/CODE?token=...` — sharing works.

**Whogohost steps (your domain registrar):**
1. Log into your Whogohost client area → Domains → Manage / DNS Management
   (or Zone Editor) for `hiresphere.com.ng`.
2. Add record: Type **A**, Host/Name **`support`**, Value **`169.35.179.55`**,
   TTL default (3600). Save.
3. Wait 5–30 minutes. Verify on your PC in PowerShell:
   `nslookup support.hiresphere.com.ng` — it must print `169.35.179.55`.
4. Only then do the VPS paste in section 5.

## 4. VPS fixes still needed (Termius, as root)

**A. Provider firewall** (whoever holds the VPS panel — you or your friend):
allow inbound **TCP 8090, 80, 443**. Without this, nothing outside reaches the VPS.
Check on the VPS that the app itself is fine:
`curl -s http://localhost:8090/healthz` should print `ok`.

**B. Domain HTTPS** (after section 3 step 3 shows the right IP):
```bash
cd /opt/screenkonect
git pull
ufw allow 80/tcp; ufw allow 443/tcp
sed -i 's/^#sk-join.example.com {/support.hiresphere.com.ng {/; s/^#\timport common/\timport common/; s/^#}/}/' deploy/Caddyfile
grep -B1 -A1 'import common' deploy/Caddyfile
sed -i 's|^PUBLIC_URL=.*|PUBLIC_URL=https://support.hiresphere.com.ng|' .env
docker compose -f deploy/docker-compose.yaml up -d --force-recreate gateway session
sleep 25
curl -s https://support.hiresphere.com.ng/healthz; echo
```
First certificate takes ~30 seconds. Full detail (including first-time setup
and update flows) lives in `TERMIUS_VPS.md`.

## 5. How to test the phone (today, no VPS needed)

1. PC: Docker up, `tailscale funnel --bg 8090`, open the funnel dashboard link.
2. Create session → Copy join link (it is the `https://...` one).
3. Phone: open the link in **Chrome itself** (not inside WhatsApp), tap Allow,
   then complete Android's popup: **Entire screen → Start recording**.
4. PC page flips Waiting → Live. If it stays on Waiting, the phone never sent
   anything — re-check steps 2–3 (fresh links only; they expire after 45 min).

## 6. When you come back, tell me which of these is true

1. `nslookup support.hiresphere.com.ng` shows `169.35.179.55` (or not yet).
2. Provider firewall 80/443/8090 open (or you need help finding it).
3. Phone test result on the funnel link (Live? Waiting? what did the phone show?).

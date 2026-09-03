# ScreenKonect — Run on Termius VPS (168.222.97.214)

**Copy folder to VPS then run these 3 commands. Works on Ubuntu 22.04 / Debian 12 with Docker.**

```bash
# 1. Copy folder (from your PC via Termius SFTP or scp)
# scp -r "C:\Users\Hermes\Desktop\screen konect" root@168.222.97.214:/opt/
# Or use Termius SFTP drag the whole "screen konect" folder to /opt/screenkonect

# 2. SSH via Termius to 168.222.97.214
ssh root@168.222.97.214
cd /opt/screenkonect   # or wherever you put it

# 3. One-time setup (if not already)
# Install Docker + Compose plugin
apt update && apt install -y docker.io docker-compose-plugin
systemctl enable --now docker
# Open firewall (8090 is the ONLY port you need — gateway handles all)
ufw allow 8090/tcp
ufw allow 22/tcp
ufw enable

# 4. Set public URL (so join links are public, not localhost)
cat > .env <<'EOF'
DATABASE_URL=postgresql://screenkonect:screenkonect@postgres:5432/screenkonect
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=sk-dev-access-secret-key-change-in-production-32ch
JWT_REFRESH_SECRET=sk-dev-refresh-secret-key-change-in-production-32
CORS_ORIGINS=http://168.222.97.214:8090,http://localhost:8090
PUBLIC_URL=http://168.222.97.214:8090
SK_GATEWAY_PORT=8090
SK_POSTGRES_PORT=5432
SK_REDIS_PORT=6380
LOG_LEVEL=info
EOF

# 5. Start (single-port gateway, 8 containers - audit/device removed for VPS)
docker compose -f deploy/docker-compose.yaml up -d --build
docker compose -f deploy/docker-compose.yaml ps   # wait 40s for healthy (auth,session,signaling,postgres,redis,gateway + 2 vite)
docker compose -f deploy/docker-compose.yaml logs -f gateway  # Ctrl+C after 200

# 6. Test
curl http://168.222.97.214:8090 -I  # 200
curl http://168.222.97.214:8090/v1/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"you@screenkonect.local","password":"ScreenKonect123!"}'

# 7. Open in browser
# http://168.222.97.214:8090
# Login: you@screenkonect.local / ScreenKonect123!
# New Session -> Copy link will be http://168.222.97.214:8090/join/<CODE>?token=... (public, share with anyone)

# If you change .env (e.g., PUBLIC_URL), recreate: docker compose -f deploy/docker-compose.yaml up -d
# Not `restart` — env vars only apply on recreate.

# Stop: docker compose -f deploy/docker-compose.yaml down
# Logs: docker compose -f deploy/docker-compose.yaml logs -f session
```

**What was fixed to run on VPS:**
- `PUBLIC_URL` env controls join links (`services/session/src/routes/sessions.ts:99`). Without it links were `localhost` and useless on VPS. Set to `http://168.222.97.214:8090` (or `https://your-domain` if you add TLS).
- Gateway `deploy/Caddyfile` routes `/join/*` -> consent `5174`, `/ws` -> signaling `4002`, `/v1/*` -> `4000-4004`, `/` -> dashboard `5173`. Only `8090` needs firewall.
- `deploy/docker-compose.yaml` `PUBLIC_URL` passed to `session` service. `CORS_ORIGINS` must include `http://168.222.97.214:8090`.
- No Tailscale needed on VPS — public IP is direct. Keep `tailscale` funnel only for local PC testing.
- Video fix: `base: '/join/'` avoids `/src/App.tsx` collision, `getDisplayMedia` uses `monitor` + `selfBrowserSurface:exclude`, data channels for remote control + file transfer, delete API `DELETE /v1/sessions`.

**If join shows "No routes matched" or black screen:** hard refresh `Ctrl+Shift+R` (Vite cache), wait 30s for `VITE ready`, ensure client picked `Entire Screen` (not Browser Tab) to see desktop when minimized.

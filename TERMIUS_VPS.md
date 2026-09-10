# ScreenKonect — Run on Termius VPS

**Works on Ubuntu 22.04 / Debian 12 with Docker. Current VPS IP: `169.35.179.55`**
(previous VPS was `168.222.97.214`)

> **HTTP caveat (read first):** the dashboard, login, session-create and join
> *pages* work fine over `http://169.35.179.55:8090` from anywhere. But
> **browser screen capture is blocked on plain http** — a client opening the
> VPS join link can join but can never share their screen (browser security,
> no workaround). For real screen-share tests use the Tailscale Funnel
> `https://` link from your PC. The VPS is for an always-on dashboard; to get
> sharing through the VPS you need a domain + TLS (or Cloudflare Tunnel in
> front of it).

## First-Time Setup on VPS (paste whole block)

```bash
# SSH via Termius to your VPS as root
ssh root@169.35.179.55

# Install Docker (one time) — official script, avoids missing-plugin errors
docker --version || curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Open firewall (8090 is the ONLY app port; also open 8090 in your provider panel)
ufw allow 8090/tcp
ufw allow 22/tcp
ufw --force enable

# Get the code
git clone https://github.com/Micatob/screenkonect.git /opt/screenkonect
cd /opt/screenkonect
git log --oneline -1

# Fresh secrets + env (PUBLIC_URL controls what join links look like)
export JWT_A=$(openssl rand -hex 32)
export JWT_R=$(openssl rand -hex 32)
cat > .env <<EOF
DATABASE_URL=postgresql://screenkonect:screenkonect@postgres:5432/screenkonect
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=${JWT_A}
JWT_REFRESH_SECRET=${JWT_R}
PORT=3000
HOST=0.0.0.0
CORS_ORIGINS=http://169.35.179.55:8090
SK_GATEWAY_PORT=8090
SK_POSTGRES_PORT=5432
SK_REDIS_PORT=6380
PUBLIC_URL=http://169.35.179.55:8090
LOG_LEVEL=info
EOF

# Build images + start everything (postgres/redis first)
docker compose -f deploy/docker-compose.yaml up -d --build
sleep 15

# dist/ is gitignored, so the VPS must compile it (one time + after pulls)
docker compose -f deploy/docker-compose.yaml run --rm auth sh -c "npm run build -w @screenkonect/shared -w @screenkonect/config -w @screenkonect/db -w @screenkonect/auth -w @screenkonect/session -w @screenkonect/signaling && echo BUILT_OK"
export VITE_PUBLIC_URL=http://169.35.179.55:8090
docker compose -f deploy/docker-compose.yaml run --rm auth sh -c "npm run build -w @screenkonect/web-dashboard -w @screenkonect/client-consent-ui && echo APPS_BUILT_OK"

# Restart backends onto compiled dist + gateway with static mounts
docker compose -f deploy/docker-compose.yaml up -d --force-recreate auth session signaling gateway
sleep 90
docker compose -f deploy/docker-compose.yaml ps
curl -s http://localhost:8090/healthz; echo

# Technician account (fresh VPS database is empty — register once)
curl -s -X POST http://localhost:8090/v1/auth/register -H 'Content-Type: application/json' -d '{"email":"you@screenkonect.local","password":"ScreenKonect123!","display_name":"Hermes"}'; echo
```

Open in browser: `http://169.35.179.55:8090` — login `you@screenkonect.local` / `ScreenKonect123!`

## Update existing VPS deploy (paste whole block)

```bash
cd /opt/screenkonect
git pull
git log --oneline -1

# Recompile everything that changed (code comes via git, dist/ does not)
docker compose -f deploy/docker-compose.yaml run --rm auth sh -c "npm run build -w @screenkonect/shared -w @screenkonect/config -w @screenkonect/db -w @screenkonect/auth -w @screenkonect/session -w @screenkonect/signaling && echo BUILT_OK"
export VITE_PUBLIC_URL=http://169.35.179.55:8090
docker compose -f deploy/docker-compose.yaml run --rm auth sh -c "npm run build -w @screenkonect/web-dashboard -w @screenkonect/client-consent-ui && echo APPS_BUILT_OK"

# Recreate (frontend dist/ is picked up live, no rebuild of images needed)
docker compose -f deploy/docker-compose.yaml up -d --force-recreate auth session signaling gateway
sleep 60
docker compose -f deploy/docker-compose.yaml ps
curl -s http://localhost:8090/healthz; echo
```

## Test

```bash
curl http://169.35.179.55:8090 -I
# Should return 200

# Open in browser: http://169.35.179.55:8090
# Login: you@screenkonect.local / ScreenKonect123!
# New Session -> join link will be http://169.35.179.55:8090/join/CODE?token=...
# (pages + join work; screen CAPTURE needs https — see caveat at top)
```

## Important Notes

- `PUBLIC_URL` controls what join links look like. Without it, links say `localhost:8090` (useless over internet)
- `docker compose restart` does NOT re-read `.env` or config changes — use `--force-recreate` instead
- `docker compose run --rm auth sh -c "..."` runs one-off commands (used for builds because `dist/` is gitignored)
- Frontend `dist/` is served live from disk — after rebuilding apps, just hard-refresh the browser (no container restart needed for frontend changes)
- Share port 8090 only. Gateway routes everything: dashboard `/`, consent `/join/*`, APIs `/v1/*`, signaling `/ws`, downloads `/downloads/*`
- Never commit `.env` (it holds JWT secrets)

## Useful Commands

```bash
# Check status
docker compose -f deploy/docker-compose.yaml ps

# View logs (service names, not container names)
docker compose -f deploy/docker-compose.yaml logs --tail 50 session
docker compose -f deploy/docker-compose.yaml logs --tail 50 gateway
docker compose -f deploy/docker-compose.yaml logs --tail 50 auth

# Restart specific service
docker compose -f deploy/docker-compose.yaml up -d --force-recreate session

# Stop everything (data stays in postgres_data / redis_data volumes)
docker compose -f deploy/docker-compose.yaml down

# Enter a container
docker compose -f deploy/docker-compose.yaml exec session sh
```

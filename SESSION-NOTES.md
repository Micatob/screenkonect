# ScreenKonect — Session Handover Notes

_Last updated: 2026-09-02 (session state saved by user request - single-port gateway + Codespaces)_

## Resume / How to pick this back up

Stack is currently **running** in Docker Desktop. To confirm before using:

```powershell
docker compose -f deploy/docker-compose.yaml ps        # all should be "healthy"/"Up"
```

If it's stopped, start it (no rebuild needed — images cached):

```powershell
docker compose -f deploy/docker-compose.yaml up -d
```

Then open **http://localhost:5173** and log in with the dev account created this
session:

- Email: `you@screenkonect.local`
- Password: `ScreenKonect123!`

**What was fixed this session (read before debugging):**
- Dashboard had no sign-up UI → accounts are made via `POST /v1/auth/register`.
- "New Session" was 404/500 → Vite proxy now routes `/v1/*` by path prefix to
  the correct backend service (see "Session 2026-08-28" section below and
  README/HOW-IT-WORKS). Verified `POST /v1/sessions` through :5173 returns 201.
- If env in `deploy/docker-compose.yaml` is ever changed, recreate with
  `up -d` (not `restart`) or new `VITE_*_TARGET` vars won't apply.

## Current state (VERIFIED WORKING - 2026-09-02)

- Git remote is now **private GitHub** `Micatob/screenkonect` (`https://github.com/Micatob/screenkonect`, branch `main`, commits `d063e73` + `376dee8` + `82c4c2e`). Local git user `Hermesfury <tobi53154@gmail.com>` token `gho_...fRi` (Micatob).
- **Single-port gateway** added: `deploy/Caddyfile` + `deploy/docker-compose.yaml:247` `gateway:8080` (caddy:2-alpine) routes `/`→dashboard:5173, `/join/*`→consent-ui:5174, `/v1/auth`→auth:4000, `/v1/sessions`→session:4001, `/ws`→signaling:4002, `/v1/devices`→device:4004, `/v1/audit`→audit:4003. **Expose only 8080** instead of 7 ports.
- **Codespaces** ready: `.devcontainer/devcontainer.json` forwards 8080 as `public`, auto `docker compose up -d --build`. 10 ports forwarded (8080 gateway + 5173/5174 + 4000-4004 + 5432/6380). Single public URL `https://xxx-8080.app.github.dev` serves both dashboard and join links (`services/session/src/routes/sessions.ts:101` uses `request.headers.host`).
- **DB auto-migrate** added: `db-migrate` service (depends_on postgres healthy, `restart: no`) runs `npm run db:migrate -w @screenkonect/db`. Backends now depend_on `db-migrate: completed`. Healthchecks switched from `node -e fetch` to `wget -qO- http://localhost:4xxx/healthz | grep -q ok` + `apk add curl wget postgresql-client` in `deploy/Dockerfile.base:3` + longer `start_period: 30s`.
- Local Docker Desktop still runs alongside **chael SIEM** (E:\chael\docker-compose.yml) with no port conflicts (ScreenKonect uses 5432/6380/4000-4004/5173/5174/8080, chael uses 8000,8004,8001,3000,3001,5601,6379,9200,2055,8085,8091,9090).
- Verified in Codespace: `curl http://localhost:8080` returns Vite HTML (`<!DOCTYPE html>`), gateway logs clean, migrate logs `migrations done`. Backends transition `unhealthy -> healthy` after 30-40s (was unhealthy due to missing migrate + fetch healthcheck).

## Start / stop / check

**Local (Docker Desktop):**
```powershell
docker compose -f deploy/docker-compose.yaml up -d      # start (images cached)
docker compose -f deploy/docker-compose.yaml ps          # status (healthy expected, 10 containers + migrate done)
curl http://localhost:8080 | head -n 5                    # gateway -> dashboard HTML
curl http://localhost:4000/healthz                       # direct API health (4000-4004)
docker compose -f deploy/docker-compose.yaml logs -f auth
docker compose -f deploy/docker-compose.yaml down        # stop
```

**Codespaces (single-port public):**
```bash
git pull
docker compose -f deploy/docker-compose.yaml up -d --build
docker compose -f deploy/docker-compose.yaml ps          # wait 40s for healthy
docker logs screenkonect-migrate --tail 20                # migrations done
# PORTS tab -> 8080 -> Public -> https://xxx-8080.app.github.dev
```

Port overrides (if ever needed): SK_*_PORT vars in root `.env` (see .env.example). Gateway is `SK_GATEWAY_PORT=8080`.

## Bugs fixed in this session

1. `packages/db/drizzle.config.ts` wrong relative paths (`../packages/db/...`)
2. Handwritten migrations 001-003 had no drizzle journal → replaced with
   regenerated `0000_chief_mephistopheles.sql` (from schema.ts). db:migrate works.
3. Vite configs: added `host: true` + env-configurable proxy
   (`VITE_API_TARGET`, `VITE_SIGNALING_TARGET`) — required for Docker mode.
4. `deploy/docker-compose.yaml`: removed obsolete `version`, fixed build
   context (`..`), added project `name: screenkonect`, healthchecks,
   `restart: unless-stopped`, env-overridable ports.
5. `deploy/Dockerfile.base`: npm ci now runs AFTER copying all workspace
   package.json manifests (root cause of "Cannot find module 'fastify'").
   Added `.dockerignore` (build went from 400s+ → ~100s).
6. `deploy/Dockerfile.production` healthcheck `/health` → `/healthz`.
7. `packages/config/src/index.ts`: `CORS_ORIGINS` env is now actually read.
8. Root `tsconfig.json` broken (`rootDir: src`) → solution-style; root
   `typecheck` = `npm run typecheck --workspaces --if-present`.
9. Type errors fixed: audit route `BigInt(id)` → `Number(id)`; signaling
   handler removed wrong `request: IncomingMessage` param and fixed
   nonexistent `client.clientId` (now compares `client.ws !== ws`).
10. Removed dead `raven2.cmd` + `bin/raven2.js` (pointed at missing `src/cli`).
11. Root `npm run dev` now also starts both web apps; added `make status`.

## Docs updated

- `README.md`: Quick Start (Docker/hybrid/how-to-check/how-to-use), corrected
  port tables, rewritten Cloudflare Tunnel (quick + named) and Tailscale
  (`tailscale serve --bg`) sections, new "Running alongside a SIEM" section.
- `docs/deployment.md`: rewritten to match actual deploy files.
- `HOW-IT-WORKS.md`: rewritten for ScreenKonect (was stale raven2 doc).
- `CHANGELOG.md`: documented all fixes.

## Open items / notes

- Rust desktop agent (`apps/desktop-agent`) NOT compile-verified: cargo/Rust
  is not installed on this machine.
- `docker compose up -d` prints harmless warnings that
  `screenkonect_postgres_data` / `screenkonect_redis_data` volumes were not
  created by Compose (they were created manually during migration). Data is
  safe; could be silenced with `external: true` if desired.
- `npm audit` reported 4 moderate vulnerabilities in the container build —
  not addressed (breaking changes possible).
- User runs hybrid mode historically (postgres/redis in Docker + `npm run dev`
  on host); full-Docker mode now also verified working.
- user's request: if issues arise, resume from this file.

## Session 2026-09-02 (single-port + Codespaces - YOU ARE HERE)

- User is in **Nigeria**, no local public IP, no card for Oracle (`eu-frankfurt-1` requires card). Chose **GitHub Codespaces free** (`120 core-hours/mo`, `15GB`) as completely free public host instead of Oracle/VPS.
- Created private GitHub repo `Micatob/screenkonect` via API (`POST /user/repos` private=true), pushed local `d063e73` (120 files) + `376dee8` (.devcontainer) + `82c4c2e` (fix). Remote `origin https://github.com/Micatob/screenkonect.git` branch `main`.
- Added **gateway**: `deploy/Caddyfile` (handles `/ws`, `/v1/*` by prefix, `/join/*`→consent-ui, `/`→dashboard + Referer-based vite assets) + `deploy/docker-compose.yaml:247` `gateway:8080`. Reduces 7 public ports to 1.
- Fixed **Codespace unhealthy backends** (`auth:4000` etc unhealthy, `curl http://localhost:8080` already OK): added `db-migrate` init container, `apk add curl wget postgresql-client` to `Dockerfile.base`, healthchecks `wget -qO- ... | grep -q ok`, `depends_on: db-migrate completed`, `start_period 30s`.
- Codespace shows 10 forwarded ports (8080 public + others private) - expected from `.devcontainer/devcontainer.json:10`. Next step is `git pull` + `docker compose up -d --build` in Codespace to get `82c4c2e` and verify `healthy`.
- How to go live tested: `PORTS 8080 Public` → `https://xxx-8080.app.github.dev` → login → New Session → `https://xxx-8080.app.github.dev/join/xxx?token=yyy` send to client. Client must Approve + toggle Remote Control ON for full control (consent enforced `services/session/src/routes/sessions.ts:99`, `docs/consent-and-permissions.md:39`).
- Next: `docker compose -f deploy/docker-compose.yaml ps` should show healthy, then `POST /v1/auth/register` → login → create session smoke test through `8080`.

## Session 2026-08-28 (login + create-session fix)

- Web Dashboard has **no sign-up UI** (only a login form). Created a real
  technician account via the API: `POST /v1/auth/register` (auth service,
  port 4000; also reachable through the Dashboard proxy at :5173). Dev account
  used this session: `you@screenkonect.local` / `ScreenKonect123!`
  (role `technician`).
- **Bug fixed — could not create a session from the Dashboard.**
  Root cause: both web apps' Vite dev proxy forwarded *all* `/v1/*` to a single
  `VITE_API_TARGET` (`auth:4000`). So `POST /v1/sessions` hit the auth service
  → 404/500, while login worked because auth *is* that target.
  Fix: route `/v1/*` by path prefix to the correct backend in
  `apps/web-dashboard/vite.config.ts` and `apps/client-consent-ui/vite.config.ts`
  (`/v1/auth`→auth:4000, `/v1/sessions`→session:4001, `/v1/devices`→device:4004,
  `/v1/audit`→audit:4003, `/ws`→signaling:4002). Added corresponding
  `VITE_*_TARGET` env vars to `deploy/docker-compose.yaml`. Verified
  `POST /v1/sessions` through :5173 now returns 201 with a session code.
- **Docker gotcha (re-learned):** `docker compose restart` does **not** re-read
  changed `environment:` in the compose file — the new `VITE_*_TARGET` vars
  only applied after `docker compose -f deploy/docker-compose.yaml up -d`
  recreated the web containers. Documented in README + HOW-IT-WORKS
  troubleshooting.
- Docs updated: README.md (account creation note, API proxy routing table,
  Docker env-recreate gotcha) and HOW-IT-WORKS.md (login-only note +
  troubleshooting rows for "no sign-up button" and "can't create a session").

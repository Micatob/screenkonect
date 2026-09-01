# ScreenKonect — Session Handover Notes

_Last updated: 2026-08-28 (session state saved by user request)_

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

## Current state (VERIFIED WORKING)

- The full ScreenKonect stack runs in Docker Desktop alongside the user's
  **chael SIEM** stack (E:\chael\docker-compose.yml) with **no port conflicts**.
- 9 containers, project name `screenkonect`, containers named `screenkonect-*`:
  postgres (5432), redis (6380), auth (4000), session (4001), signaling (4002),
  audit (4003), device (4004), web-dashboard (5173), client-consent-ui (5174).
- chael uses host ports 8000, 8004, 8001, 3000, 3001, 5601, 6379, 9200, 2055,
  8085, 8091, 9090 — no overlap with ScreenKonect.
- Verified end-to-end: all /healthz return 200, both web apps serve 200,
  register → login → create-session smoke test passed through Docker.
- Postgres data preserved (3 users, 5 sessions, 4 devices) — volumes migrated
  from old `deploy_postgres_data` to `screenkonect_postgres_data`.

## Start / stop / check

```powershell
docker compose -f deploy/docker-compose.yaml up -d      # start (images cached)
docker compose -f deploy/docker-compose.yaml ps          # status (healthy expected)
curl http://localhost:4000/healthz                       # API health (4000-4004)
docker compose -f deploy/docker-compose.yaml logs -f auth
docker compose -f deploy/docker-compose.yaml down        # stop
```

Port overrides (if ever needed): SK_*_PORT vars in root `.env` (see .env.example).

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

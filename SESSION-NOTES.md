# ScreenKonect — Session Handover Notes

_Last updated: 2026-09-03 03:50 WAT - Fix verified: join via 8090 works, base /join/ + cookie routing, WebRTC view OK_

## Resume / How to pick this back up (DOCKER RUNNING 2026-09-03 - READY)

**Current stack is UP and verified (do not restart):**
```powershell
docker compose -f deploy/docker-compose.yaml ps  # 10 Up (healthy) incl gateway 0.0.0.0:8090->80
Invoke-WebRequest http://localhost:8090 -UseBasicParsing | Select StatusCode # 200
# Verified 2026-09-03 03:50: POST /v1/sessions 201, POST /v1/sessions/join 200, approve active via 8090
# HTML http://localhost:8090/join/<CODE>?token=xxx now serves consent with base /join/ -> JS at /join/src/*
```

**If you closed Docker - next time:**
```powershell
docker compose -f deploy/docker-compose.yaml up -d
docker compose -f deploy/docker-compose.yaml ps  # wait 40s for healthy (session/signaling start_period 30s)
# Vite cold start: first load after restart takes 17-38s (VITE ready in 38589 ms log), next loads <1s
# If join page shows "No routes matched /join/..." -> hard refresh Ctrl+Shift+R (old JS cached at /src/App.tsx)
```

**What was fixed 2026-09-03 (read before debugging):**
- **Join blank / "No routes matched /join/..."** `deploy/Caddyfile:30` + `apps/client-consent-ui/vite.config.ts:14` — Root cause: two Vite apps shared origin `localhost:8090` and `/src/App.tsx` collided. Gateway routed via `Referer *join*` but nested imports have `Referer: /src/main.tsx` not `join` -> served dashboard JS. Fix: consent `base: '/join/'` so HTML requests `/join/@vite/client`, `/join/src/main.tsx` -> correctly via `handle /join/*`. Added cookie `sk_app=consent` + HMR `Upgrade: websocket` routing `Caddyfile:48,57` to fix HMR `ws://8090/?token=...` failing.
- **Join always "Invalid link"** `apps/client-consent-ui/src/App.tsx:25` — checked `?session_id` but URL is `/join/<CODE>?token=xxx`. Fixed to parse `token` only, handle `auto_approved`.
- **Missing screen share** `apps/client-consent-ui/src/SessionIndicator.tsx:1` — was overlay only. Implemented `getDisplayMedia` + `RTCPeerConnection` offer -> `ws /ws/signaling`.
- **Join link lost** `apps/web-dashboard/src/pages/Dashboard.tsx:33` + `Session.tsx:30` — `POST /v1/sessions` returns `join_url` but `navigate()` dropped it. Now persists `sessionStorage sk_join_url_*` and polls every 3s for `pending_approval` -> `active`.
- **Signaling Dropped Offer** `services/signaling/src/handlers/webrtc.ts:33,84` — initial offer swallowed (`return` without forward) and `permissions.control` gated offer/answer. Fixed to relay `offer/answer/ice` opposite role always, forward initial offer, store offer in Redis for late joiner.
- **Login slow** — not backend (login `0.6s`, `auth/me 0.15s` via 8090) but Vite cold start 17-38s. Documented warm vs cold.
- **Black screen after share** `apps/client-consent-ui/src/SessionIndicator.tsx:37` + `apps/web-dashboard/src/pages/Session.tsx:113` — Root: `displaySurface: "monitor"` not supported in Firefox, dropped ICE candidates when `ws` not open, offer sent before technician registered and lost, technician `ws.onopen` didn't register via `join` so stored offer never delivered, video `ontrack` replaced canvas but muted autoplay blocked. Fix: `getDisplayMedia({video:true})`, candidate buffering `pendingCandidates`, offer retry 3s, `Session.tsx` sends `type:'join'` on open, signaling stores `offer` in Redis 300s and delivers to late technician, technician `ontrack` now creates `video#remote-video` with `muted playsInline`, handles `icecandidate` queue, `onconnectionstatechange` logging.
- **Too many sessions / delete** `services/session/src/routes/sessions.ts:354` + `apps/web-dashboard/src/pages/Dashboard.tsx:86` — Added `DELETE /v1/sessions/:id` and `DELETE /v1/sessions?status=ended|created|expired|all=true` (deletes tokens + session). UI: per-row trash `Trash2` + bulk `Clear ended / Clear expired / Delete all` in Dashboard header. Verified `DELETE` 200, `GET /v1/sessions` count 13 -> 11 after bulk.

## Current state (DOCKER RUNNING 2026-09-03 03:50 - VERIFIED)

- Git diff: 7 files `apps/client-consent-ui/src/App.tsx,SessionIndicator.tsx,vite.config.ts`, `apps/web-dashboard/src/pages/Dashboard.tsx,Session.tsx`, `deploy/Caddyfile`, `services/signaling/src/handlers/webrtc.ts` — **not yet committed** (test first, then commit).
- **Gateway 8090 verified** `2026-09-03 03:50` `curl http://localhost:8090/join/TEST?token=abc` -> HTML `ScreenKonect - Client Consent` with `src="/join/@vite/client"` `src="/join/src/main.tsx"` (base /join/ fix). `POST /v1/sessions` 201, `POST /v1/sessions/join` 200, `approve` active via `8090` (last test `XDUYI97N` active).
- **Tailscale** `100.65.87.116` green, funnel `8090` ready (needs `tailscale funnel --bg 8090` if not yet enabled). Public `https://desktop-a780de3.tailXXXX.ts.net` works via 8090.
- **Containers** `auth:4000 healthy`, `session:4001 healthy`, `signaling:4002 healthy`, `gateway:8090 Up 6s`, `client-consent-ui Up 5m (VITE ready 38589 ms)`, `web-dashboard Up 37m`, `postgres/redis healthy` (`audit/device unhealthy` not needed for core flow).
- **Vite warm**: first load after restart 17-38s, next loads <1s. If `No routes matched` appears, hard refresh `Ctrl+Shift+R` to clear cached `/src/App.tsx` (old dashboard JS).

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

## Session 2026-09-04f - meeting-invite consent + camera/mic (PUSHED, VPS REBUILD NEEDED)

- Consent is now a meeting invite: `Meeting request / You have been invited`, duration row (real `max_duration_minutes`, default 60), `Turn on for this meeting:` Camera/Mic/Audio toggles. Screen stack still auto-on.
- `camera`/`mic` added to `SessionPermissions` (shared), DB `$type`+default, `ApproveSchema`, auto-approve perms. Client `SessionIndicator` adds mic track to call + camera preview tile (both fail-soft). Dashboard shows Camera/Mic.
- VPS MUST rebuild shared/db dist after pull (bind-mount covers src, dist is what runs).

## Session 2026-09-04e - agent join protocol fixed + agent-v0.1.0 tagged (CI BUILDING EXE)

- Repo confirmed PUBLIC - VPS can curl release assets, no auth. No manual SFTP needed.
- Agent join protocol fixed: `consent.rs` now POSTs `/v1/sessions/join` (gets real uuid) then polls consent-state up to 30min; `signaling.rs` join sends real session_id (was secret token) + wss kept; `webrtc/mod.rs` carries session_id, `run(mut self)` fixes move-out-of-borrow compile error; `main.rs` wires session_id through.
- NOT compile-verified (no Rust toolchain on this PC) - CI `agent-release.yaml` on tag is the first real build. If red, paste the error and fix next.
- Tag `agent-v0.1.0` pushed -> Release exe -> VPS curls it into `deploy/downloads/`.

## Session 2026-09-04d - direct /downloads exe from VPS (PUSHED, EXE PLACEMENT PENDING)

- Download button pointed at GitHub /releases (empty + private = clients hit login wall). Fixed: gateway serves `deploy/downloads/` at `/downloads/*` (`Caddyfile`, compose mount `./downloads:/srv/downloads:ro`), button now `href="/downloads/screenkonect-agent.exe"` + SmartScreen note.
- Exe still has to be placed once: Actions artifact -> `deploy/downloads/screenkonect-agent.exe` on VPS -> recreate gateway. README in folder.
- No auto-run possible from a webpage (browser security) - client double-clicks + pastes link. Unsigned exe = SmartScreen "Unknown publisher" until a code-sign cert exists.

## Session 2026-09-04c - single Allow button + agent one-click pipeline (SAVED 2026-09-04, VPS TEST PENDING)

- Pushed `b410fd6` to main. Termius paste given (pull + force-recreate client-consent-ui + hard refresh). Awaiting user test.
- Exe: CI run building `screenkonect-agent.exe` as action artifact; Release asset needs `agent-v*` tag.
- Next dev (needs Rust toolchain): agent join protocol (code-as-id 404, token-as-session_id).

- Consent: Deny button REMOVED, single `Allow access` full-width button (`ConsentScreen.tsx`). Owner asked Deny to also grant access - declined as deceptive (client clicking Deny must not silently grant control); removing the button achieves one-click access honestly. Closing window still refuses. `onReject` kept optional for compat.
- Agent one-click: `config.rs` +Clone (was a compile blocker: 5x config.clone() with no Clone impl), new `--join-url <link>` flag (one paste sets server+token), `--help` updated, `signaling.rs` https->wss fix (was always ws://, broke https servers).
- `.github/workflows/agent-release.yaml`: builds `screenkonect-agent.exe` on windows-latest per main push, artifact 30d; `agent-v*` tags attach exe to GitHub Release (join page links to /releases).
- Join page: new `Need full desktop help?` panel with 3 steps + Download Windows agent button.
- KNOWN GAP (needs Rust dev with toolchain, none on this PC): agent join protocol - `consent.rs` polls consent-state with session CODE as :id (backend looks up uuid -> 404 forever) and join msg sends token as session_id. Must POST /v1/sessions/join first. Exe will build before agent actually works end-to-end.

## Session 2026-09-04b - rejoin + insecure-http share fix (PUSHED 7d2bad4, VPS TEST PENDING)

- PC pushed `7d2bad4` to `Micatob/screenkonect main` (10 files). `.env` + backup json NOT committed.
- User reports Termius health `4000/4001 ok` after pull plan. Next on VPS: `git pull` (must show 7d2bad4), rebuild shared/config dist, `up -d --force-recreate auth session signaling web-dashboard client-consent-ui gateway`, hard refresh, re-login (45min JWT), NEW session link. Old links dead.
- Open: user testing now, domain+https question asked (needs A record + Caddy domain block + PUBLIC_URL https). Awaiting test result.

- Join `Invalid or expired` on refresh: `services/session/src/routes/sessions.ts:196` removed `used=false` filter, only mark used first time, allow rejoin within 45min expiry. `one_time_link_usage true->false` in `packages/config/src/index.ts` + `config/default.yaml`. Old links in DB still 5min/used - must create NEW session after deploy.
- `Screen sharing not supported`: root cause is insecure context - `http://168.222.97.214:8090` exposes no `navigator.mediaDevices`. `SessionIndicator.tsx` now shows actionable fix (SSH tunnel localhost:8090 / chrome flag / domain https) instead of generic error.
- Slim popup not showing = old JS: VPS never pulled or Vite cached. Verify with `grep Optional ConsentScreen.tsx` + hard refresh Ctrl+Shift+R + `--force-recreate client-consent-ui`.
- session typecheck OK, config OK, consent only pre-existing controlChannel unused.

## Session 2026-09-04 - 45min timeout + slim consent popup (PUSHED in 7d2bad4)

- Timeout fix (Invalid/expired + Connection error): `packages/shared/src/utils/token.ts` `15m->45m` (JWT_ACCESS_EXPIRY env), `packages/config/src/index.ts` + `config/default.yaml` `token_expiry_ms 900000->2700000`, `consent_timeout_ms 300000(5min)->2700000(45min)` max `->7200000`, `idle_timeout_minutes 15->40`. Join links + access tokens now last 40min+.
- Dashboard no longer dies at 15min: `apps/web-dashboard/src/App.tsx` stores `refresh_token`, `refreshAccessToken()` + `authFetch()` retry once on 401, auto-refresh every 40min, `safeJson()` avoids `JSON.parse: unexpected end` on 502. `Dashboard.tsx` + `Session.tsx` use `authFetch`.
- Consent popup shortened: `apps/client-consent-ui/src/ConsentScreen.tsx` hides default-on view/control/clipboard/file_transfer (still sent true), shows only Audio toggle + one-line summary.
- Local typecheck: shared OK, dashboard OK, consent has 1 pre-existing `SessionIndicator.tsx:102 controlChannel unused`.
- Deploy: PC `git add/commit/push`, VPS `git pull`, rebuild shared/config dist, `up -d --force-recreate auth session signaling web-dashboard client-consent-ui`, re-login (new 45min token).

## Session 2026-09-03 22:15 WAT - Termius VPS 168.222.97.214 / 7d5x0lo9

- VPS fresh `git clone Micatob/screenkonect` -> `docker compose -f deploy/docker-compose.yaml up -d --build` starts but `auth/session/signaling Up (unhealthy)`, `gateway 502 Bad Gateway` on `POST /v1/auth/login`, dashboard shows `JSON.parse: unexpected end of data` (`apps/web-dashboard/src/App.tsx:65` does `res.json()` on empty 502 body).
- Root cause: `packages/*/dist` gitignored, VPS has no dist. Container log: `Cannot find module '/app/node_modules/@screenkonect/config/dist/index.js'`. Local PC has dist built, VPS doesn't.
- Fix attempt: `docker compose run --rm auth sh -c "npm run build -w @screenkonect/shared -w @screenkonect/config -w @screenkonect/db"` then `up -d`. Still unhealthy 14min + `POST /v1/auth/register` empty. Next to verify: `ls packages/config/dist`, `logs --tail 30 auth`, then `up -d --force-recreate auth session signaling`.
- VPS quirks hit: `apt install docker.io docker-compose-plugin` -> `E: Unable to locate package docker-compose-plugin` + `docker.service does not exist`. Fixed with `curl -fsSL https://get.docker.com | sh`. GitHub private clone rejects password, needs PAT `ghp_...@github.com` or make repo public temporarily.
- SFTP warning: do NOT SFTP folder (node_modules 207MB -> 105MB stall at 5MB). Use `git clone` or single tar excluding node_modules/.git.
- Must use `http://168.222.97.214:8090` (with :8090), not bare IP (port 80 empty).

## Session 2026-09-02 (single-port + Codespaces)

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

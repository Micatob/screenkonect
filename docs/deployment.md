# Deployment Guide

This guide covers deploying ScreenKonect in various environments.

## Overview

- **Local development / self-hosting**: the full stack runs with Docker Compose
  from `deploy/docker-compose.yaml` (all containers) or in hybrid mode
  (PostgreSQL/Redis in Docker, Node services on the host).
- **Production**: build the services with `deploy/Dockerfile.production`
  (multi-stage, non-root user) and run them behind a reverse proxy or a
  Cloudflare Tunnel / Tailscale.

## Prerequisites

### System Requirements

- **CPU**: 2+ cores per service
- **Memory**: 2GB+ per service
- **Storage**: 20GB+ for the database
- **Network**: HTTPS required for production (Cloudflare Tunnel or a reverse
  proxy with TLS)

### Software Requirements

- Node.js 20+
- PostgreSQL 16+ (or the bundled Docker image)
- Redis 7+ (or the bundled Docker image)
- Docker and Docker Compose (Docker Desktop on Windows)

## Local Deployment (Docker Compose)

```bash
# From the project root
docker compose -f deploy/docker-compose.yaml up -d --build

# Apply migrations once
npm run db:migrate -w @screenkonect/db

# Verify
docker compose -f deploy/docker-compose.yaml ps
curl http://localhost:4000/healthz
```

The stack starts 9 containers (all named `screenkonect-*`):

| Container | Host port | Purpose |
|-----------|-----------|---------|
| screenkonect-postgres | 5432 | PostgreSQL (data persists in a volume) |
| screenkonect-redis | 6380 | Redis (host mapping avoids the common 6379) |
| screenkonect-auth | 4000 | Authentication API |
| screenkonect-session | 4001 | Session/consent API |
| screenkonect-signaling | 4002 | WebSocket signaling |
| screenkonect-audit | 4003 | Audit log API |
| screenkonect-device | 4004 | Device enrollment API |
| screenkonect-web-dashboard | 5173 | Technician dashboard |
| screenkonect-client-consent-ui | 5174 | Client consent page |

### Changing ports to avoid conflicts with other stacks

All host ports are configurable through the project root `.env` file — useful
when you run other Docker stacks (e.g. a SIEM) on the same machine:

```
SK_POSTGRES_PORT=5433
SK_REDIS_PORT=6381
SK_AUTH_PORT=4010
SK_SESSION_PORT=4011
SK_SIGNALING_PORT=4012
SK_AUDIT_PORT=4013
SK_DEVICE_PORT=4014
SK_DASHBOARD_PORT=5183
SK_CONSENT_PORT=5184
```

See `docker compose -f deploy/docker-compose.yaml config` to confirm the
effective configuration before starting.

### Hybrid mode (DB in Docker, services on the host)

```bash
docker compose -f deploy/docker-compose.yaml up -d postgres redis
npm run db:migrate -w @screenkonect/db
npm run dev                  # 5 APIs + 2 web apps (concurrently)
```

## Environment Variables

Create a `.env` file in the project root (copy `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://screenkonect:screenkonect@localhost:5432/screenkonect

# Redis
REDIS_URL=redis://localhost:6380

# JWT Secrets (generate strong random values for production)
JWT_ACCESS_SECRET=<random-64-char-string>
JWT_REFRESH_SECRET=<random-64-char-string>

# CORS (add the public origins you expose, e.g. your Cloudflare hostnames)
CORS_ORIGINS=https://dashboard.yourdomain.com,https://consent.yourdomain.com

# Server
PORT=4000
HOST=0.0.0.0
```

> In Docker mode the compose file injects its own `DATABASE_URL`/`REDIS_URL`
> that point at the compose services, so the `.env` values are only used for
> host-side tooling and migrations.

### Generate Secure Secrets

```bash
openssl rand -hex 32
```

## Database Setup

```bash
npm run db:migrate -w @screenkonect/db
```

Migrations live in `packages/db/migrations` (managed by drizzle-kit). After a
schema change in `packages/db/src/schema.ts`:

```bash
npm run db:generate -w @screenkonect/db
npm run db:migrate -w @screenkonect/db
```

## Production Deployment

The repo ships `deploy/Dockerfile.production` — a multi-stage build that
compiles all TypeScript packages and runs the services as a non-root user
with `dumb-init`. There is no pre-built production compose file; the typical
production setup is:

1. **Build the image** for each service (or one image used with different
   `CMD`s):

   ```bash
   docker build -f deploy/Dockerfile.production -t screenkonect/auth .
   ```

2. **Run the services** with your own compose file or directly, e.g.:

   ```bash
   docker run -d --name sk-auth \
     -e DATABASE_URL=$DATABASE_URL \
     -e REDIS_URL=$REDIS_URL \
     -e JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET \
     -e JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET \
     -p 4000:4000 \
     screenkonect/auth
   ```

3. **Serve the web apps** from a reverse proxy (nginx/Caddy) or a tunnel.

### Reverse proxy (optional, self-hosted with a domain)

All APIs and apps are plain HTTP on the host; put nginx/Caddy in front with
TLS. The web apps proxy `/v1` and `/ws` internally, so a single hostname per
app is enough:

```nginx
# dashboard.yourdomain.com -> 127.0.0.1:5173
# consent.yourdomain.com   -> 127.0.0.1:5174
# api.yourdomain.com       -> 127.0.0.1:4000 (with /ws upgrade headers)
```

## Exposing Over the Internet (No Port Forwarding)

Two recommended options; both work while everything stays on Docker Desktop
and both coexist with other stacks (SIEM, etc.) since only the tunnel connects
in from outside.

### Option A: Cloudflare Tunnel (public)

```bash
# install
winget install cloudflare.cloudflared

# quick mode (one URL per port, no domain needed)
cloudflared tunnel --url http://localhost:5173   # dashboard
cloudflared tunnel --url http://localhost:5174   # consent UI

# or named tunnel with your domain (see README → Cloudflare Tunnel)
cloudflared tunnel login
cloudflared tunnel create screenkonect
# ... create ~/.cloudflared/config.yml with ingress rules ...
cloudflared tunnel run screenkonect
```

### Option B: Tailscale (private)

```bash
# install and join your tailnet
winget install tailscale.tailscale
tailscale up
tailscale ip -4          # e.g. 100.x.y.z

# optional HTTPS via MagicDNS
tailscale serve --bg 5173
tailscale serve --bg 5174
```

Access the dashboard/client UI at `http://100.x.y.z:5173` from any device on
your tailnet.

## Monitoring

### Logs

```bash
docker compose -f deploy/docker-compose.yaml logs -f
docker compose -f deploy/docker-compose.yaml logs -f auth
```

### Health checks

Every service exposes `/healthz` and `/readyz` (signaling checks Redis in
`/readyz`). The compose file wires these into container healthchecks, so
`docker compose ps` shows `(healthy)`.

## Backup Strategy

### Database Backups

```bash
# Daily backup
docker exec screenkonect-postgres pg_dump -U screenkonect screenkonect | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup_20260101.sql.gz | docker exec -i screenkonect-postgres psql -U screenkonect screenkonect
```

### Redis Backups

```bash
docker exec screenkonect-redis redis-cli BGSAVE
# copy the dump from the redis_data volume to your backup location
```

## Troubleshooting

### Common Issues

1. **`docker compose up` hangs** — do not run it from inside `deploy/`; run it
   from the project root with `-f deploy/docker-compose.yaml`. The first build
   runs `npm ci` inside the container and can take several minutes; use
   `--build` only when dependencies changed.
2. **Connection refused on 5173/5174** — make sure you run the compose file
   from the project root, and that Vite is not already running on the host.
3. **Port already in use** — see the `SK_*_PORT` overrides above.
4. **JWT errors** — verify the secrets are set and consistent across services.
5. **Database errors** — check migrations and the connection string.
6. **WebSocket errors** — verify the WSS configuration of the proxy/tunnel;
   the `/ws` proxy must pass `Upgrade`/`Connection` headers.

### Logs

```bash
docker compose -f deploy/docker-compose.yaml logs -f auth
docker compose -f deploy/docker-compose.yaml logs -f
```

### Health Checks

```bash
curl http://localhost:4000/healthz
curl http://localhost:4001/healthz
curl http://localhost:4002/healthz
curl http://localhost:4003/healthz
curl http://localhost:4004/healthz
```

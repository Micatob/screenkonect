# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project structure
- Authentication service with JWT
- Session management with consent flow
- WebRTC signaling service
- Audit logging service
- Device enrollment service for returning clients
- Technician web dashboard
- Client consent UI
- Database schema with Drizzle ORM
- Docker Compose for local development
- CI/CD pipeline with GitHub Actions
- Comprehensive documentation
- `make status` command to show running containers and API health
- Environment-variable port overrides (`SK_*_PORT`) for Docker Compose so the
  stack can run alongside other Docker services (e.g. a SIEM) without conflicts

### Fixed
- `packages/db/drizzle.config.ts` used wrong relative paths
  (`../packages/db/...`), which broke `db:migrate`; regenerated the migration
  from `schema.ts` with a proper drizzle journal
- Vite dev servers bound to localhost only, making the Docker port mappings
  unusable; added `host: true`
- Vite proxy targets were hard-coded to `localhost`, which cannot work between
  containers; proxy targets are now configurable via `VITE_API_TARGET` /
  `VITE_SIGNALING_TARGET`
- `deploy/docker-compose.yaml`: removed obsolete `version` key, added a
  dedicated `screenkonect` project name, fixed the build context (`..` +
  `deploy/Dockerfile.base`), added healthchecks, restart policies and env
  overrides
- `deploy/Dockerfile.production` healthcheck used `/health` instead of the
  actual `/healthz` endpoint
- Removed stale, broken `raven2.cmd` / `bin/raven2.js` entry points that
  referenced a non-existent `src/cli` module
- Root `npm run dev` now also starts both web apps
- `docs/deployment.md` rewritten to match the actual deploy files
  (`docker-compose.yaml`, `Dockerfile.production`) and documented the
  Cloudflare Tunnel / Tailscale processes

### Security
- Consent-first design: no media transmission before client approval
- One-time session tokens with cryptographic randomness
- Session-bound tokens that cannot be reused
- End-to-end encryption with DTLS-SRTP
- Audit trail for all session events
- Rate limiting on authentication endpoints
- CSP headers and security best practices
- Device enrollment with explicit client consent
- Visible agent indicator when running
- Easy uninstall capability

## [0.1.0] - 2024-01-01

### Added
- Initial release
- Basic session creation and joining
- Consent screen with permission choices
- Session indicator showing active sharing
- End session functionality

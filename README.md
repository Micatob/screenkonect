# ScreenKonect

A consent-based remote desktop support tool built with security and privacy as first-class citizens.

## Overview

ScreenKonect allows technicians to provide remote support with explicit client consent. Unlike traditional remote access tools, ScreenKonect requires the client to actively approve every session and can revoke access at any time.

## How It Works

### What ScreenKonect Does

ScreenKonect is a remote desktop support tool that lets a technician/helper view and optionally control another person's computer to help them fix problems, install software, or provide technical assistance. Think of it like ScreenConnect, TeamViewer, or AnyDesk, but built with consent and privacy as the top priorities.

**The core idea:** Nothing happens on the client's computer until they explicitly say "yes, you can help me."

### Who Uses It

- **Technician/Helper**: The person providing support (could be IT support, a friend helping with tech issues, a customer service agent)
- **Client/Target**: The person receiving help (the one with the computer problem)

### The Complete Workflow

#### Step 1: Technician Creates a Session

The technician logs into the ScreenKonect dashboard (a web app) and clicks "New Session." The system generates a unique, one-time join link that looks like:

```
https://app.screenkonect.com/join/ABC12345?token=xyz789...
```

This link is cryptographically random and expires after 15 minutes if not used.

#### Step 2: Technician Sends the Link

The technician copies the link and sends it to the client via email, chat, SMS, or any messaging platform. The link is the only thing needed to connect.

#### Step 3: Client Opens the Link

The client clicks the link in their browser. They see a clear consent screen that explains:

- **Who is requesting access** (the technician's identity)
- **What will be shared** (their screen)
- **What permissions are being requested** (view only, remote control, clipboard, etc.)

#### Step 4: Client Chooses Permissions

The client has full control over what the technician can do:

| Permission | What It Means | Default |
|------------|---------------|---------|
| View Screen | Technician can see the client's screen | ON (required) |
| Remote Control | Technician can move mouse and type | OFF |
| Clipboard Sync | Copy text between computers | OFF |
| File Transfer | Send/receive files | OFF |
| Audio Sharing | Share system sound | OFF |

The client toggles on only what they're comfortable with.

#### Step 5: Client Approves

The client clicks "Approve." At this exact moment:

1. The server records the consent event with timestamp and IP
2. The session status changes from "pending" to "active"
3. The technician's dashboard updates to show "Connected"
4. Screen sharing can begin

**If the client clicks "Deny" instead:** The session ends immediately. The technician sees "Session Denied." No screen data was ever transmitted.

#### Step 6: Technician Views/Controls the Screen

Once approved:

- The client's screen appears in the technician's dashboard
- If remote control was granted, the technician can move the mouse and type
- The client sees a persistent red "Screen Shared" indicator in the corner of their screen
- The indicator shows what permissions are active

#### Step 7: Client Can End at Any Time

The client has multiple ways to stop the session:

- Click the "End Session" button on the indicator
- Close the browser tab
- Close the desktop agent (if installed)
- Revoke specific permissions

The moment the client ends the session, the technician loses access instantly. No delay, no negotiation.

#### Step 8: Session Ends

When the session ends (by either party or timeout):

1. All connections are closed
2. Screen sharing stops immediately
3. The session is marked as "ended" in the database
4. An audit log records everything that happened
5. Both parties can see the session summary

### What Makes ScreenKonect Different

| Feature | Traditional Tools | ScreenKonect |
|---------|-------------------|--------------|
| Consent | Often implicit or buried in terms | Explicit, unavoidable screen |
| Permission granularity | All-or-nothing | Client chooses each permission |
| Session indicator | Hidden or none | Persistent, visible, uncloseable |
| Revocation | Sometimes delayed | Instant |
| One-time links | Reusable tokens | Single-use, expiring tokens |
| Audit trail | Basic logs | Complete consent + action logging |
| Recording | Often enabled by default | Disabled by default, requires dual consent |

### Security by Design

1. **No hidden access**: The client always knows when their screen is being shared
2. **No persistence**: Closing the app ends the session. No background processes.
3. **No UAC bypass**: The agent runs as a normal user, respects OS permission prompts
4. **Encrypted everything**: All traffic uses TLS/DTLS-SRTP encryption
5. **Short-lived tokens**: Join links expire in 15 minutes
6. **Single-use tokens**: Once used, a token cannot be reused
7. **Audit everything**: Every consent event, permission change, and session action is logged

### Technical Flow (Simplified)

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Technician  │         │   Server     │         │    Client    │
│  Dashboard   │         │  (Backend)   │         │   Browser    │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │  1. Create Session     │                        │
       │───────────────────────▶│                        │
       │                        │                        │
       │  2. Return Join URL    │                        │
       │◀───────────────────────│                        │
       │                        │                        │
       │  3. Send Link ─────────┼───────────────────────▶│
       │     (via email/chat)   │                        │
       │                        │                        │
       │                        │  4. Client Opens Link  │
       │                        │◀───────────────────────│
       │                        │                        │
       │                        │  5. Validate Token     │
       │                        │───────────────────────▶│
       │                        │                        │
       │                        │  6. Show Consent Screen│
       │                        │◀───────────────────────│
       │                        │                        │
       │                        │  7. Client Approves    │
       │                        │◀───────────────────────│
       │                        │                        │
       │  8. Notify: Approved   │                        │
       │◀───────────────────────│                        │
       │                        │                        │
       │  9. WebRTC Signaling   │  10. WebRTC Signaling  │
       │◀──────────────────────▶│◀──────────────────────▶│
       │                        │                        │
       │  11. Screen Stream ────┼───────────────────────▶│
       │     (encrypted)        │    (encrypted)         │
       │                        │                        │
       │  12. Input Events ─────┼───────────────────────▶│
       │     (if permitted)     │    (if permitted)      │
       │                        │                        │
       │                        │  13. Client Ends       │
       │                        │◀───────────────────────│
       │                        │                        │
       │  14. Session Ended     │                        │
       │◀───────────────────────│                        │
```

### Use Cases

- **IT Help Desk**: Employee calls IT support, technician helps fix their computer remotely
- **Family Tech Support**: Parent helps child with computer issue from another city
- **Customer Support**: Company assists customer with software installation
- **Remote Tutoring**: Teacher shows student how to use software on their computer
- **Code Review**: Developer shares screen for pair programming assistance

### What ScreenKonect Does NOT Do

- **No hidden persistence**: Agent only runs when the user installs it voluntarily with clear disclosure
- **No stealth mode**: Always shows visible indicator when active
- **No unattended access without enrollment**: Cannot connect to a computer without prior device enrollment
- **No recording by default**: Recording requires explicit consent from both parties
- **No privilege escalation**: Respects OS security boundaries
- **No anti-forensics**: Leaves clear audit trail

### Device Enrollment (Optional Persistence)

ScreenKonect supports **optional device enrollment** for returning clients. This is a voluntary feature that makes it easier for clients to receive support multiple times.

#### How It Works

1. **Client installs the agent** (voluntary, with clear disclosure)
2. **Agent shows visible indicator** ("ScreenKonect Agent Running")
3. **Technician sends enrollment request** or client self-enrolls
4. **Client approves enrollment** once
5. **Device is registered** in the system
6. **Future sessions are easier** - client can connect with one click

#### Access Policies

All devices can be configured with one of three access policies:

| Policy | Description | Client Can Block? | Use Case |
|--------|-------------|-------------------|----------|
| `consent_required` | Client must approve each session | Yes | Personal devices, default |
| `notification_only` | Technician connects, client sees notification | No | Company devices, testing |
| `admin_only` | Only admins can connect, no notification | No | Company devices, IT only |

**Default:** `consent_required` - Always safe, requires explicit consent.

#### What Enrollment Does

| Feature | Without Enrollment | With Enrollment |
|---------|-------------------|-----------------|
| Connection method | One-time link each time | Link or device list |
| Consent required | Every session | Depends on policy |
| Visible indicator | During sessions only | Always when agent running |
| Technician can see device | No | Yes (if allowed) |
| Quick reconnect | No | Yes (one click) |
| Uninstall | N/A | Easy uninstall option |

#### What Enrollment Does NOT Do

- **Still shows indicator** when agent is running
- **Can be uninstalled** at any time
- **No hidden background** processes
- **No auto-connect** without approval (unless policy is notification_only/admin_only)
- **Audit trail** for all access

#### Enrollment Flow

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    Client    │         │   Server     │         │  Technician  │
│   (Agent)    │         │  (Backend)   │         │  Dashboard   │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │  1. Install Agent      │                        │
       │  (with disclosure)     │                        │
       │───────────────────────▶│                        │
       │                        │                        │
       │  2. Register Device    │                        │
       │───────────────────────▶│                        │
       │                        │                        │
       │  3. Device Enrolled    │                        │
       │◀───────────────────────│                        │
       │                        │                        │
       │  [Visible Indicator]   │                        │
       │  "Agent Running"       │                        │
       │                        │                        │
       │                        │  4. See Device List    │
       │                        │◀───────────────────────│
       │                        │                        │
       │                        │  5. Create Session     │
       │                        │     for Device         │
       │                        │◀───────────────────────│
       │                        │                        │
       │  6. Receive Request    │                        │
       │◀───────────────────────│                        │
       │                        │                        │
       │  7. Approve/Reject     │                        │
       │  (or auto-approve)     │                        │
       │───────────────────────▶│                        │
       │                        │                        │
       │                        │  8. Session Active     │
       │                        │◀───────────────────────│
```

#### Agent Visibility

When the agent is installed and running, it shows:

```
┌─────────────────────────────────────────────────┐
│  ScreenKonect Agent - Ready for Support         │
│  ─────────────────────────────────────────────  │
│  Status: Waiting for connection                 │
│  Device: My Computer                            │
│  ─────────────────────────────────────────────  │
│  [Settings]  [Uninstall]  [Exit]                │
└─────────────────────────────────────────────────┘
```

This indicator:
- Is always visible when the agent is running
- Cannot be hidden or minimized
- Shows the agent status clearly
- Provides easy access to settings and uninstall

## What Has Been Done (Phase 1: Secure MVP)

### Monorepo Foundation
- npm workspaces configured for TypeScript packages
- Cargo workspace for Rust desktop agent
- Comprehensive `.gitignore` for all platforms
- `rust-toolchain.toml` for Rust development
- Root `tsconfig.json` with project configuration

### Shared Packages
- **@screenkonect/shared** - TypeScript types, constants, crypto utilities (bcrypt, JWT, token generation)
- **@screenkonect/db** - Drizzle ORM schema with 10 tables, migrations, PostgreSQL client
- **@screenkonect/config** - YAML configuration loading with Zod validation

### Backend Services (Node.js + Fastify + TypeScript)
- **Auth Service** (port 4000) - User registration, login, JWT tokens, refresh token rotation, `/me` endpoint
- **Session Service** (port 4001) - Session CRUD, consent flow, permission management, join tokens, access policies
- **Device Service** (port 4004) - Device enrollment, authentication, heartbeat, management
- **Signaling Service** (port 4002) - WebSocket signaling for WebRTC, Redis pub/sub
- **Audit Service** (port 4003) - Immutable audit logging, query endpoints

### Frontend Applications (React + TypeScript + Tailwind CSS)
- **Technician Dashboard** (port 5173) - Login, session list, create sessions, join URLs, remote viewer
- **Client Consent UI** (port 5174) - Consent screen with permission toggles, session indicator
- Both apps have `index.html`, `vite.config.ts`, Tailwind/PostCSS configuration, and favicon

### Desktop Agent (Rust)
- **Config module** - CLI argument parsing with `--url`, `--token`, `--monitor`, `--quality`, `--fps`
- **Error module** - Custom error types with proper conversions
- **Consent module** - Polls server for consent state, waits for approval/rejection with timeout
- **Signaling module** - WebSocket client using `tokio-tungstenite`, message routing via channels
- **Capture module** - Platform-specific screenshot capture:
  - Windows: PowerShell `CopyFromScreen`
  - macOS: `screencapture` command
  - Linux: `scrot`/`gnome-screenshot`/`import` fallback chain
- **Input module** - Platform-specific input injection:
  - Windows: PowerShell `SendKeys`
  - macOS: `osascript` System Events
  - Linux: `xdotool`
- **WebRTC module** - Peer connection management, message routing, input event dispatching

### Database Schema (PostgreSQL)
- `users` - Technician accounts with roles and company association
- `companies` - Optional company grouping
- `devices` - Registered desktop agents with enrollment tokens and access policies
- `sessions` - Support sessions with status, consent state, access mode, and device linking
- `device_sessions` - Tracks device-session connections
- `session_tokens` - One-time join tokens
- `consent_events` - Audit trail for consent actions
- `audit_logs` - Immutable audit records
- `refresh_tokens` - JWT refresh tokens
- `rate_limit_events` - Rate limiting tracking

### Configuration
- `config/default.yaml` - Main configuration
- `config/session-policy.yaml` - Session policies (expiry, timeouts, permissions)
- `config/security.yaml` - JWT secrets, rate limits, CORS
- `config/observability.yaml` - Logging, tracing, metrics
- `.env.example` - Environment variable template

### Testing
- `vitest.config.ts` - Test runner configuration
- `packages/shared/src/__tests__/crypto.test.ts` - Password hashing, token generation tests
- `packages/shared/src/__tests__/token.test.ts` - JWT generation/verification tests

### Deployment
- `deploy/docker-compose.yaml` - Full local development stack (10 services)
- `deploy/Dockerfile.base` - Base Node.js Docker image (development)
- `deploy/Dockerfile.production` - Multi-stage production build with non-root user
- `.github/workflows/ci.yaml` - CI pipeline (lint, typecheck, test, build, security)
- `Makefile` - Common development commands

### Documentation
- `README.md` - This file
- `SECURITY.md` - Security policy and vulnerability reporting
- `CONTRIBUTING.md` - Contribution guidelines
- `CODE_OF_CONDUCT.md` - Code of conduct
- `LICENSE.md` - MIT license
- `CHANGELOG.md` - Version history
- `docs/architecture.md` - System architecture
- `docs/session-lifecycle.md` - Session state machine
- `docs/consent-and-permissions.md` - Consent model
- `docs/threat-model.md` - Security threat analysis
- `docs/deployment.md` - Deployment guide
- `docs/operations.md` - Operations guide
- `docs/api.md` - API reference
- `docs/client-agent.md` - Client agent documentation
- `docs/device-enrollment.md` - Device enrollment documentation
- `docs/man/remote-support-agent.1.md` - Agent man page
- `docs/man/remote-support-server.1.md` - Server man page
- `api/openapi.yaml` - OpenAPI 3.0 specification

## Key Features

- **Consent-first design**: No screen data is transmitted until the client explicitly approves
- **Permission granularity**: Clients choose exactly what access to grant (view, control, clipboard, file transfer, audio)
- **Persistent session indicator**: Clients always see when their screen is being shared
- **Instant revocation**: Clients can end the session at any time with one click
- **Audit trail**: Complete logging of all session events for compliance
- **End-to-end encryption**: All media traffic encrypted with DTLS-SRTP
- **NAT traversal**: Works behind firewalls using TURN fallback

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Technician     │     │  Backend        │     │  Client         │
│  Dashboard      │────▶│  Services       │◀────│  Agent/Browser  │
│  (React/TS)     │     │  (Node.js)      │     │  (Rust/Browser) │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              ┌─────▼─────┐            ┌──────▼──────┐
              │ PostgreSQL │            │    Redis    │
              └───────────┘            └─────────────┘
```

## Session Flow

```
1. Technician creates session via dashboard
2. System generates one-time join token and URL
3. Technician sends link to client
4. Client opens link in browser
5. Client sees consent screen with permission options
6. Client chooses permissions and clicks "Approve"
7. Server verifies consent, activates session
8. Technician can now view/control client's screen
9. Client can end session at any time
10. Session ends, audit log recorded
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose (Docker Desktop on Windows)
- PostgreSQL 16+ (or use Docker)
- Redis 7+ (or use Docker)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/screenkonect.git
cd screenkonect

# Install dependencies
make install

# Start services
make dev
```

The application will be available at:
- Technician Dashboard: http://localhost:5173
- Client Consent UI: http://localhost:5174
- Auth API: http://localhost:4000
- Session API: http://localhost:4001
- Signaling: ws://localhost:4002
- Audit API: http://localhost:4003
- Device API: http://localhost:4004

### Docker Setup (everything in containers)

```bash
# Start all services (PostgreSQL, Redis, APIs, web apps)
docker compose -f deploy/docker-compose.yaml up -d --build

# Apply database migrations (first run only)
npm run db:migrate -w @screenkonect/db

# View logs
docker compose -f deploy/docker-compose.yaml logs -f

# Stop services
docker compose -f deploy/docker-compose.yaml down
```

### Hybrid Setup (DB/Redis in Docker, services on the host)

This is the fastest way to develop or run without building app images:

```bash
# 1. Start only PostgreSQL + Redis in Docker (images already cached)
docker compose -f deploy/docker-compose.yaml up -d postgres redis

# 2. Apply migrations once
npm run db:migrate -w @screenkonect/db

# 3. Start the 5 backend services
npm run dev

# 4. In two more terminals, start the web apps
npm run dev -w apps/web-dashboard
npm run dev -w apps/client-consent-ui
```

### How to check it is running

```bash
# Docker containers
docker compose -f deploy/docker-compose.yaml ps

# API health (each returns {"status":"ok"} / HTTP 200)
curl http://localhost:4000/healthz
curl http://localhost:4001/healthz
curl http://localhost:4002/healthz
curl http://localhost:4003/healthz
curl http://localhost:4004/healthz

# Web apps (HTTP 200)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
curl -s -o /dev/null -w "%{http_code}" http://localhost:5174/

# Live logs (host mode: runtime/dev.log; Docker mode: docker compose logs)
```

### How to stop it

```bash
# Full Docker stack
docker compose -f deploy/docker-compose.yaml down

# Hybrid mode: stop the npm processes (Ctrl+C in each terminal) and:
docker compose -f deploy/docker-compose.yaml down
```

### How to use it (end to end)

1. Open the Technician Dashboard at http://localhost:5173 and **log in**.
2. Click **New Session** — the dashboard shows a one-time join link.
3. Send that link to the person you are helping (email, chat, SMS).
4. They open the link in a browser, see the consent screen, pick the
   permissions they allow, and click **Approve**.
5. The dashboard switches to **Connected** and shows their screen. Use the
   controls to view (and, if granted, control) their machine.
6. Either side can end the session at any time; the session and consent
   events are stored in the audit log.

#### Creating an account (the Dashboard has no "Sign up" button yet)

The web Dashboard only renders a **login** form — there is no in-app
registration screen. To get credentials, register through the auth API
directly (the UI calls the same endpoint):

```bash
# from the host, hit the auth service (port 4000)
curl -X POST http://localhost:4000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123","display_name":"You"}'

# then log in with those same credentials at http://localhost:5173
```

> In Docker mode the Dashboard proxies `/v1/auth/*` to the `auth` container,
> so you can also POST to `http://localhost:5173/v1/auth/register` instead of
> port 4000. The other `/v1/*` paths are routed to their own services (see
> "API proxy routing" below).

## Tool Usage

### Make Commands

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make install` | Install all npm dependencies |
| `make build` | Build all packages |
| `make dev` | Start all services in development mode |
| `make test` | Run test suite |
| `make lint` | Run ESLint |
| `make typecheck` | Run TypeScript type checking |
| `make clean` | Remove build artifacts and node_modules |
| `make docker-up` | Start the full stack with Docker |
| `make docker-down` | Stop Docker services |
| `make docker-logs` | View Docker container logs |
| `make db-migrate` | Run database migrations |
| `make db-generate` | Generate new database migration |
| `make db-studio` | Open Drizzle Studio (database GUI) |
| `make format` | Format code with Prettier |
| `make setup` | Install dependencies and run migrations |
| `make status` | Show running containers and API health |

### npm Scripts (from root)

| Script | Description |
|--------|-------------|
| `npm run build` | Build all workspace packages |
| `npm run dev` | Start all backend services concurrently |
| `npm test` | Run Vitest test suite |
| `npm run lint` | Run ESLint across all packages |
| `npm run typecheck` | Run TypeScript compiler checks |
| `npm run db:migrate` | Run database migrations |
| `npm run format` | Format all files with Prettier |

### Individual Service Commands

```bash
# Start auth service only
npm run dev -w services/auth

# Start session service only
npm run dev -w services/session

# Start device service only
npm run dev -w services/device

# Start signaling service only
npm run dev -w services/signaling

# Start audit service only
npm run dev -w services/audit

# Build specific package
npm run build -w packages/shared

# Typecheck specific service
npm run typecheck -w services/auth
```

### Docker Commands

All commands use the compose file in `deploy/` (project name: `screenkonect`).

```bash
# Start all services
docker compose -f deploy/docker-compose.yaml up -d --build

# Start specific service
docker compose -f deploy/docker-compose.yaml up -d postgres

# View logs for specific service
docker compose -f deploy/docker-compose.yaml logs -f auth

# List running containers
docker compose -f deploy/docker-compose.yaml ps

# Stop all services
docker compose -f deploy/docker-compose.yaml down

# Remove volumes (fresh start)
docker compose -f deploy/docker-compose.yaml down -v
```

Containers are named `screenkonect-*` (e.g. `screenkonect-auth`) so they never
collide with other Docker stacks such as a SIEM.

### Database Commands

```bash
# Run migrations
npm run db:migrate -w @screenkonect/db

# Generate new migration after schema changes
npm run db:generate -w @screenkonect/db

# Open database GUI
npm run db:studio -w @screenkonect/db

# Push schema directly (dev only)
npm run db:push -w @screenkonect/db
```

### Rust Desktop Agent Commands

```bash
# Build the agent
cargo build --release

# Run the agent
cargo run --release -- \
  --url wss://signaling.example.com \
  --token <session-token> \
  --monitor 0 \
  --quality 80 \
  --fps 30

# Run with debug logging
RUST_LOG=debug cargo run -- --url wss://localhost:4002 --token abc123
```

### API Testing

```bash
# Health check
curl http://localhost:4000/healthz

# Register user
curl -X POST http://localhost:4000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","display_name":"Test User"}'

# Login
curl -X POST http://localhost:4000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Create session (requires auth token)
curl -X POST http://localhost:4001/v1/sessions \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{}'

# Create session for specific device
curl -X POST http://localhost:4001/v1/sessions \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"device_id":"<device-uuid>"}'

# List sessions
curl http://localhost:4001/v1/sessions \
  -H "Authorization: Bearer <access_token>"

# Enroll a new device
curl -X POST http://localhost:4004/v1/devices/enroll \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"device_name":"My Computer","platform":"windows","hostname":"DESKTOP-ABC123"}'

# List enrolled devices
curl http://localhost:4004/v1/devices \
  -H "Authorization: Bearer <access_token>"

# Device authentication (called by agent)
curl -X POST http://localhost:4004/v1/devices/authenticate \
  -H "Content-Type: application/json" \
  -d '{"enrollment_token":"<enrollment_token>","hostname":"DESKTOP-ABC123"}'

# Device heartbeat (called by agent periodically)
curl -X POST http://localhost:4004/v1/devices/<device-id>/heartbeat

# Update device settings
curl -X PATCH http://localhost:4004/v1/devices/<device-id> \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"require_approval":false,"allowed_technician_ids":["<technician-uuid>"]}'

# Remove device (uninstall)
curl -X DELETE http://localhost:4004/v1/devices/<device-id> \
  -H "Authorization: Bearer <access_token>"
```

## Project Structure

```
screenkonect/
├── apps/
│   ├── web-dashboard/              # Technician React app (Vite + Tailwind)
│   │   ├── src/
│   │   │   ├── App.tsx             # Router and auth context
│   │   │   ├── pages/Login.tsx     # Login page
│   │   │   ├── pages/Dashboard.tsx # Session list dashboard
│   │   │   └── pages/Session.tsx   # Remote viewer page
│   │   └── vite.config.ts
│   ├── client-consent-ui/          # Client browser consent page
│   │   ├── src/
│   │   │   ├── App.tsx             # Main app with state machine
│   │   │   ├── ConsentScreen.tsx   # Permission chooser
│   │   │   └── SessionIndicator.tsx # Active session indicator
│   │   └── vite.config.ts
│   └── desktop-agent/              # Rust native agent
│       ├── Cargo.toml
│       ├── src/
│       │   ├── main.rs             # Entry point
│       │   ├── capture/            # Screen capture (DXGI/ScreenCaptureKit/PipeWire)
│       │   ├── input/              # Input injection
│       │   ├── webrtc/             # WebRTC pipeline
│       │   ├── signaling.rs        # WebSocket signaling client
│       │   ├── consent.rs          # Consent enforcement
│       │   ├── config.rs           # CLI config
│       │   └── error.rs            # Error types
│       └── tauri/                  # Tauri UI (planned)
├── services/
│   ├── auth/                       # Authentication service
│   │   └── src/
│   │       ├── index.ts            # Fastify server
│   │       └── routes/auth.ts      # Register, login, refresh, logout
│   ├── session/                    # Session management
│   │   └── src/
│   │       ├── index.ts            # Fastify server
│   │       ├── routes/sessions.ts  # Session CRUD, join
│   │       └── routes/consent.ts   # Approve, reject, revoke
│   ├── device/                     # Device enrollment and management
│   │   └── src/
│   │       ├── index.ts            # Fastify server
│   │       └── routes/devices.ts   # Enroll, authenticate, heartbeat
│   ├── signaling/                  # WebRTC signaling
│   │   └── src/
│   │       ├── index.ts            # Fastify + WebSocket server
│   │       └── handlers/webrtc.ts  # Offer/answer/ICE exchange
│   └── audit/                      # Audit logging
│       └── src/
│           ├── index.ts            # Fastify server
│           └── routes/audit.ts     # Audit log queries
├── packages/
│   ├── shared/                     # Shared types and utilities
│   │   └── src/
│   │       ├── types/              # TypeScript interfaces
│   │       ├── constants/          # App constants
│   │       └── utils/              # Crypto, token utilities
│   ├── db/                         # Database schema and migrations
│   │   ├── src/
│   │   │   ├── schema.ts           # Drizzle ORM schema
│   │   │   └── client.ts           # PostgreSQL client
│   │   └── migrations/             # SQL migrations
│   └── config/                     # Configuration management
│       └── src/index.ts            # YAML loader with Zod validation
├── config/                         # YAML configuration files
├── deploy/                         # Docker and deployment configs
├── docs/                           # Documentation
├── api/                            # OpenAPI specification
└── HOW-IT-WORKS.md                 # Non-technical explanation
```

## Configuration

### Session Policy (`config/session-policy.yaml`)

```yaml
default_expiry_minutes: 60        # Session expires after 1 hour
idle_timeout_minutes: 15          # Disconnect after 15 min inactivity
consent_timeout_ms: 300000        # 5 min to approve consent
require_client_approval: true     # Client must approve
allow_remote_control: true        # Client can grant control
allow_recording: false            # Recording disabled by default
require_recording_consent: true   # Both parties must consent to record
```

### Security (`config/security.yaml`)

```yaml
jwt_access_secret: "<change-in-production>"
jwt_refresh_secret: "<change-in-production>"
bcrypt_salt_rounds: 12
max_login_attempts: 5
login_lockout_ms: 1800000         # 30 min lockout
cors_origins:
  - "http://localhost:5173"
  - "http://localhost:5174"
```

## API Endpoints

### Auth
- `GET /v1/auth/me` - Get current user info
- `POST /v1/auth/register` - Register new user
- `POST /v1/auth/login` - Login
- `POST /v1/auth/refresh` - Refresh access token
- `POST /v1/auth/logout` - Logout

### Sessions
- `POST /v1/sessions` - Create session
- `GET /v1/sessions` - List sessions
- `GET /v1/sessions/:id` - Get session details
- `POST /v1/sessions/:id/end` - End session (technician)
- `POST /v1/sessions/join` - Join session (client)

### Consent
- `POST /v1/sessions/:id/approve` - Approve session
- `POST /v1/sessions/:id/reject` - Reject session
- `POST /v1/sessions/:id/revoke` - Revoke active session
- `POST /v1/sessions/:id/permissions` - Update permissions
- `GET /v1/sessions/:id/consent-state` - Get consent state

### Devices
- `POST /v1/devices/enroll` - Generate enrollment token
- `POST /v1/devices/authenticate` - Device authentication (agent)
- `GET /v1/devices` - List enrolled devices
- `GET /v1/devices/:id` - Get device details
- `PATCH /v1/devices/:id` - Update device settings
- `DELETE /v1/devices/:id` - Remove device (uninstall)
- `GET /v1/devices/:id/sessions` - Get device session history
- `POST /v1/devices/:id/heartbeat` - Device heartbeat (agent)
- `POST /v1/devices/:id/re-enroll` - Generate new enrollment token

### WebSocket
- `/ws/signaling` - WebRTC signaling

## Testing Over the Internet

### Local Testing (Same Network)

For testing on the same network (e.g., both devices at home), no port forwarding is needed:

1. Start the server (Docker or hybrid, see Quick Start)
2. Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
3. Access from other devices on the same network:
   - Dashboard: `http://192.168.x.x:5173`
   - Client UI: `http://192.168.x.x:5174`

> The Vite dev servers listen on all interfaces (`host: true`), so LAN access
> works out of the box. The web apps proxy `/v1/*` to the correct backend
> **by path prefix** and `/ws` to the signaling service, so only the two web
> ports (5173, 5174) are needed for browser access:
>
> | Path prefix | Routed to (Docker service) | Host port |
> |-------------|----------------------------|-----------|
> | `/v1/auth` | `auth` | 4000 |
> | `/v1/sessions` | `session` | 4001 |
> | `/v1/devices` | `device` | 4004 |
> | `/v1/audit` | `audit` | 4003 |
> | `/ws` (WebSocket) | `signaling` | 4002 |
>
> These targets are set via `VITE_AUTH_TARGET`, `VITE_SESSION_TARGET`,
> `VITE_DEVICE_TARGET`, `VITE_AUDIT_TARGET` and `VITE_SIGNALING_TARGET` in
> `deploy/docker-compose.yaml` (with `localhost` defaults for hybrid mode).
> This routing is why a session can be created from the Dashboard even though
> the session API lives on a different container than auth.

> **Docker gotcha — env changes need a recreate, not a restart:** editing the
> `environment:` block in `deploy/docker-compose.yaml` (e.g. the `VITE_*_TARGET`
> vars) is **not** picked up by `docker compose restart` — that reuses the
> existing container config. After changing compose env, run
> `docker compose -f deploy/docker-compose.yaml up -d` so the affected
> containers are recreated. If "New Session" returns a 404/500, this is almost
> always the cause.

### Testing Over the Internet

To test from different networks (e.g., your computer and a friend's computer), you have several options:

#### Option 1: Port Forwarding (Self-Hosted)

Forward these ports on your router to your computer's local IP:

| Port | Service | Protocol |
|------|---------|----------|
| 4000 | Auth API | HTTP |
| 4001 | Session API | HTTP |
| 4002 | Signaling | WebSocket |
| 4003 | Audit API | HTTP |
| 4004 | Device API | HTTP |
| 5173 | Dashboard | HTTP |
| 5174 | Client UI | HTTP |

**Steps:**
1. Find your computer's local IP (e.g., `192.168.1.100`)
2. Login to your router (usually `192.168.1.1` or `192.168.0.1`)
3. Find "Port Forwarding" or "Virtual Server" settings
4. Add rules to forward each port to your local IP
5. Find your public IP: visit https://whatismyipaddress.com
6. Access from anywhere: `http://YOUR_PUBLIC_IP:5173`

**Security note:** Only forward ports temporarily for testing. Use a VPN or tunnel for production.

#### Option 2: Cloudflare Tunnel (Recommended — Free, No Port Forwarding)

A Cloudflare Tunnel exposes one or more local ports through a public HTTPS URL
and **never opens a port on your router**. Use it when clients should be able
to reach your instance from any network without installing anything.

```bash
# Install cloudflared
winget install cloudflare.cloudflared  # Windows
# or: brew install cloudflared         # Mac
# or: sudo apt install cloudflared     # Linux

# 1. Start the stack first (any mode from Quick Start)

# 2a. QUICK MODE — one public URL per port (no login, no domain needed)
cloudflared tunnel --url http://localhost:5173
cloudflared tunnel --url http://localhost:5174
# NOTE: run each port in its own terminal, or use one command per port.

# 2b. FULL MODE — named tunnel with a permanent hostname on your own domain
cloudflared tunnel login
cloudflared tunnel create screenkonect

# Create a config file ~/.cloudflared/config.yml that routes each service
# to its local port through one tunnel:
#   tunnel: <tunnel-id>
#   credentials-file: C:\Users\<you>\.cloudflared\<tunnel-id>.json
#   ingress:
#     - hostname: dashboard.yourdomain.com
#       service: http://localhost:5173
#     - hostname: consent.yourdomain.com
#       service: http://localhost:5174
#     - hostname: api.yourdomain.com
#       service: http://localhost:4000
#     - service: http_status:404
#
# Route the DNS records:
cloudflared tunnel route dns screenkonect dashboard.yourdomain.com
cloudflared tunnel route dns screenkonect consent.yourdomain.com
cloudflared tunnel route dns screenkonect api.yourdomain.com

# Run the tunnel
cloudflared tunnel run screenkonect
```

After it connects you get public HTTPS URLs like `https://dashboard.yourdomain.com`.
Send those to the client instead of your local addresses. The web apps use
relative `/v1` / `/ws` paths, so they keep working behind the tunnel with no
code changes.

#### Option 3: Tailscale Funnel (Recommended for Nigeria - Free, No Port Forward, 1 Port)

Tailscale creates a **private WireGuard network** + **public Funnel** on top of your single gateway `8090` (`deploy/Caddyfile:1`). The client needs **no install, just a browser**. Free for personal use (100 devices, no card).

**Why 8090:** `docker-compose.yaml:247` exposes **only** `8090->80` via `gateway` (Caddy). It routes `/`→dashboard:5173, `/join/*`→consent-ui:5174, `/v1/*`→APIs, `/ws`→signaling. `8080` is taken by chael SIEM locally, so ScreenKonect uses `8090`.

1. Install Tailscale (already done on this PC - `C:\Program Files\Tailscale\tailscale.exe` `1.102.3`):
    ```powershell
    # If not installed:
    Invoke-WebRequest -Uri https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe -OutFile $env:TEMP\tailscale-setup.exe; Start-Process $env:TEMP\tailscale-setup.exe /S -Wait
    ```
2. Sign in (already `tobi53154@` `100.65.87.116`):
    ```powershell
    & "C:\Program Files\Tailscale\tailscale.exe" up
    # browser opens -> login with Google/GitHub/Microsoft
    ```
3. Enable **Serve/Funnel** once (one click per tailnet):
   - Visit `https://login.tailscale.com/admin/machines` -> your `desktop-a780de3` -> enable `Funnel` (or open the link `tailscale funnel` prints: `https://login.tailscale.com/f/funnel?node=...`)
   - For private tailnet only (no public), enable `Serve` instead: `https://login.tailscale.com/f/serve?node=...`

4. Expose single gateway (public internet, no port forward):
    ```powershell
    & "C:\Program Files\Tailscale\tailscale.exe" funnel --bg 8090
    # prints: https://desktop-a780de3.tailXXXX.ts.net
    # check: & "C:\Program Files\Tailscale\tailscale.exe" funnel status
    ```
    - You: `https://desktop-a780de3.tailXXXX.ts.net` (dashboard)
    - Client: `https://desktop-a780de3.tailXXXX.ts.net/join/ABC123?token=xyz` (join link - dashboard generates with `8090` host, replace `localhost:8090` with funnel host)

5. Private tailnet only (client must be on your tailnet, more secure):
    ```powershell
    & "C:\Program Files\Tailscale\tailscale.exe" serve --bg 8090
    # https://desktop-a780de3.tailXXXX.ts.net (tailnet only)
    ```
    Share via `Admin Console` -> `Machines` -> `Share` or invite client to tailnet.

> Which one to pick? `Funnel` = anyone with URL (public, like Cloudflare). `Serve` = only tailnet (private). Gateway `8090` makes both 1 URL, not 7.

### Running Alongside Other Docker Stacks (e.g. a SIEM)

ScreenKonect runs fine next to your SIEM stack in the same Docker Desktop.
Its containers are named `screenkonect-*` and it uses a private compose
network, so it will not interfere with your SIEM containers.

**Host ports used by ScreenKonect (defaults):**

| Port | Service | Notes |
|------|---------|-------|
| 5432 | PostgreSQL | container-internal service; published for host tools |
| 6380 | Redis | deliberately different from the common 6379 |
| 4000-4004 | Auth / Session / Signaling / Audit / Device APIs | |
| 5173 | Technician Dashboard | direct, or via gateway 8090 `/` |
| 5174 | Client Consent UI | direct, or via gateway 8090 `/join` |
| 8090 | Gateway (Caddy) | **Single public port** - routes `/`, `/join/*`, `/v1/*`, `/ws` |

**Before starting, verify nothing else on your host already uses these
ports** (your SIEM included):

```powershell
# Windows
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 4000..4004,5173,5174,5432,6380 }

# Or simply: docker ps --format "{{.Names}} {{.Ports}}"  # shows published ports of every stack
```

If a port is taken, override it **without touching the compose file** — put
any of these in the project root `.env` (or pass them to the command):

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

```bash
docker compose -f deploy/docker-compose.yaml up -d --build
```

> Note: PostgreSQL inside the compose network still listens on 5432 for the
> other ScreenKonect containers — only the host mapping changes.

### Firewall Rules

If connections fail, check your firewall:

**Windows:**
```powershell
# Allow Node.js through firewall
New-NetFirewallRule -DisplayName "ScreenKonect" -Direction Inbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow
```

**macOS:**
```bash
# Allow Node.js in System Preferences > Security & Privacy > Firewall
```

**Linux:**
```bash
# Allow ports through UFW
sudo ufw allow 4000:4004
sudo ufw allow 5173:5174
```

### Testing Checklist

1. [ ] Start server: `make dev` (or the Docker compose mode)
2. [ ] Register a user: `http://localhost:5173`
3. [ ] Create a session from the dashboard
4. [ ] Open the client join link in another browser/device
5. [ ] Approve consent on the client side
6. [ ] Verify screen sharing works
7. [ ] Test remote control (if granted)
8. [ ] Test session ending from both sides

## Security

- All traffic encrypted in transit (TLS/WSS/DTLS-SRTP)
- One-time cryptographically random session tokens
- Consent required before any media transmission
- JWT tokens with short expiry and refresh rotation
- Rate limiting on authentication endpoints
- Audit logging for all session events
- No secrets in client bundles
- CSP headers and security best practices

See [SECURITY.md](SECURITY.md) for full security policy.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System design and component overview |
| [Session Lifecycle](docs/session-lifecycle.md) | Session state machine and transitions |
| [Consent and Permissions](docs/consent-and-permissions.md) | Consent model and permission types |
| [Device Enrollment](docs/device-enrollment.md) | Device registration and persistence |
| [Threat Model](docs/threat-model.md) | Security threats and mitigations |
| [Deployment Guide](docs/deployment.md) | Production deployment instructions |
| [Operations Guide](docs/operations.md) | Monitoring, maintenance, scaling |
| [API Reference](docs/api.md) | REST and WebSocket API docs |
| [Client Agent](docs/client-agent.md) | Desktop agent documentation |
| [OpenAPI Spec](api/openapi.yaml) | Machine-readable API specification |

## Roadmap

### Phase 2: Native Desktop Agent
- [x] Implement Rust screen capture (DXGI, ScreenCaptureKit, PipeWire)
- [x] Implement input injection
- [x] WebRTC media pipeline
- [x] Signaling client
- [x] Consent enforcement
- [ ] Tauri UI for consent indicator
- [ ] Signed binaries and secure auto-update

### Phase 3: Production Hardening
- [ ] TURN server deployment
- [ ] OpenTelemetry observability
- [ ] Load testing
- [ ] Security audit
- [ ] Performance optimization

### Phase 4: Enterprise Features
- [ ] SSO/OIDC integration
- [ ] Team workspaces
- [ ] Session recording with dual consent
- [ ] File transfer with virus scanning
- [ ] Role-based admin controls
- [ ] Unattended access (with enrollment and MFA)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

MIT License - See [LICENSE.md](LICENSE.md) for details.

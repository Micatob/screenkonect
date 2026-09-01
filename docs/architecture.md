# Architecture

## Overview

ScreenKonect is a consent-based remote desktop support tool built with a microservices architecture. The system prioritizes security and privacy by requiring explicit client consent before any screen data is transmitted.

## System Components

### Frontend Applications

1. **Technician Dashboard** (`apps/web-dashboard`)
   - React + TypeScript
   - Vite for building
   - Tailwind CSS for styling
   - WebRTC for remote viewing
   - WebSocket for real-time updates

2. **Client Consent UI** (`apps/client-consent-ui`)
   - React + TypeScript
   - Minimal footprint
   - Consent screen with permission choices
   - Persistent session indicator

### Backend Services

1. **Auth Service** (`services/auth`)
   - Fastify + TypeScript
   - JWT authentication
   - User management
   - Token refresh rotation

2. **Session Service** (`services/session`)
   - Fastify + TypeScript
   - Session lifecycle management
   - Consent state tracking
   - Permission management

3. **Signaling Service** (`services/signaling`)
   - Fastify + WebSocket
   - WebRTC offer/answer exchange
   - ICE candidate relay
   - Redis pub/sub for scaling

4. **Audit Service** (`services/audit`)
   - Fastify + TypeScript
   - Immutable audit logs
   - Session event tracking
   - Compliance reporting

### Shared Packages

1. **Shared Types** (`packages/shared`)
   - TypeScript type definitions
   - Constants
   - Utility functions

2. **Database** (`packages/db`)
   - Drizzle ORM schema
   - Migrations
   - Database client

3. **Config** (`packages/config`)
   - YAML configuration loading
   - Zod validation
   - Environment variable support

## Data Flow

### Session Creation

```
Technician → Auth Service → Session Service → Database
                                      ↓
                              Generate Join Token
                                      ↓
                              Return Join URL
```

### Client Join

```
Client → Join URL → Session Service → Validate Token
                                      ↓
                              Create Pending Session
                                      ↓
                              Show Consent Screen
```

### Consent Approval

```
Client → Approve → Session Service → Update Consent State
                                      ↓
                              Notify Technician
                                      ↓
                              Activate WebRTC
```

### Media Streaming

```
Client Agent → WebRTC → TURN/STUN → Technician Dashboard
         ↓
   Screen Capture
         ↓
   Hardware Encoding
         ↓
   DTLS-SRTP Encryption
```

## Security Architecture

### Authentication Flow

1. User submits credentials
2. Auth service validates against database
3. Access token (15 min) and refresh token (30 days) issued
4. Refresh tokens are rotated on use
5. Old refresh tokens are revoked

### Session Security

1. Session codes are cryptographically random (8 chars)
2. Join tokens are 32 bytes, hashed before storage
3. Tokens are single-use
4. Sessions expire after configured duration
5. Idle timeout disconnects inactive sessions

### Consent Enforcement

1. Client opens join URL
2. Token validated server-side
3. Session enters `pending_approval` state
4. Client sees consent screen
5. Client approves with chosen permissions
6. Server verifies consent before allowing media
7. Consent events logged for audit

### Media Encryption

1. WebRTC uses DTLS-SRTP by default
2. No media transmitted before consent
3. TURN server provides TLS fallback
4. All signaling over WSS

## Deployment Architecture

### Development

```
Docker Compose
├── PostgreSQL
├── Redis
├── Auth Service
├── Session Service
├── Signaling Service
├── Audit Service
├── Web Dashboard
└── Client Consent UI
```

### Production

```
Kubernetes Cluster
├── Ingress Controller
├── Auth Service (replicas)
├── Session Service (replicas)
├── Signaling Service (replicas)
├── Audit Service (replicas)
├── Web Dashboard (CDN)
├── Client Consent UI (CDN)
├── PostgreSQL (managed)
├── Redis (managed)
└── TURN Server
```

## Scalability

### Horizontal Scaling

- All services are stateless
- Session state stored in Redis
- Database connections pooled
- Load balancer distributes traffic

### Signaling Scaling

- Redis pub/sub for message routing
- Multiple signaling instances
- Session affinity not required
- WebSocket connections balanced

## Monitoring

### Metrics

- Active sessions
- Consent approval rate
- Connection failures
- Media bitrate/latency
- Error rates
- Resource utilization

### Logging

- Structured JSON logs
- Request IDs for tracing
- Session IDs for correlation
- Audit logs for compliance

### Tracing

- OpenTelemetry integration
- Distributed tracing
- Performance monitoring

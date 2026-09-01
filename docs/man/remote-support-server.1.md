# screenkonect-server(1)

## NAME

screenkonect-server - Consent-based remote desktop support server

## SYNOPSIS

**screenkonect-server** [*OPTIONS*]

## DESCRIPTION

**screenkonect-server** is the backend server for ScreenKonect, a consent-based remote desktop support tool. It handles authentication, session management, WebRTC signaling, and audit logging.

## OPTIONS

**--port** *PORT*
  Server port (default: 3000)

**--host** *HOST*
  Server host (default: 0.0.0.0)

**--config** *PATH*
  Path to configuration directory (default: ./config)

**--log-level** *LEVEL*
  Log level: debug, info, warn, error (default: info)

**--help**
  Show help message

**--version**
  Show version

## SERVICES

The server runs the following services:

- **Auth Service**: User authentication and token management
- **Session Service**: Session lifecycle and consent management
- **Signaling Service**: WebRTC offer/answer exchange
- **Audit Service**: Audit logging and compliance

## CONFIGURATION

Configuration is loaded from YAML files in the config directory:

**default.yaml**
  Main configuration file

**session-policy.yaml**
  Session policy settings

**security.yaml**
  Security configuration

**observability.yaml**
  Observability settings

## ENVIRONMENT VARIABLES

**DATABASE_URL**
  PostgreSQL connection string

**REDIS_URL**
  Redis connection string

**JWT_ACCESS_SECRET**
  JWT access token secret

**JWT_REFRESH_SECRET**
  JWT refresh token secret

**NODE_ENV**
  Environment: development, production

## API ENDPOINTS

### Auth

- **POST /v1/auth/register** - Register user
- **POST /v1/auth/login** - Login
- **POST /v1/auth/refresh** - Refresh token
- **POST /v1/auth/logout** - Logout

### Sessions

- **POST /v1/sessions** - Create session
- **GET /v1/sessions** - List sessions
- **GET /v1/sessions/:id** - Get session
- **POST /v1/sessions/:id/end** - End session
- **POST /v1/sessions/join** - Join session

### Consent

- **POST /v1/sessions/:id/approve** - Approve session
- **POST /v1/sessions/:id/reject** - Reject session
- **POST /v1/sessions/:id/revoke** - Revoke session

### Audit

- **GET /v1/audit** - List audit logs
- **GET /v1/audit/:id** - Get audit log

## WEBSOCKET ENDPOINTS

**/ws/signaling**
  WebRTC signaling for media streaming

## HEALTH CHECKS

**GET /healthz**
  Health check endpoint

**GET /readyz**
  Readiness check endpoint

## SECURITY

- JWT authentication with short-lived tokens
- Refresh token rotation
- Rate limiting on all endpoints
- CORS protection
- CSP headers
- Audit logging for all actions

## FILES

**config/default.yaml**
  Main configuration

**config/session-policy.yaml**
  Session policies

**config/security.yaml**
  Security settings

**config/observability.yaml**
  Observability settings

## EXAMPLES

```bash
# Start server with defaults
screenkonect-server

# Start on custom port
screenkonect-server --port 8080

# Start with custom config
screenkonect-server --config /etc/screenkonect

# Start in production mode
NODE_ENV=production screenkonect-server
```

## EXIT STATUS

**0**
  Success (shutdown)

**1**
  Error (failed to start)

## SEE ALSO

**screenkonect-agent(1)**

## AUTHORS

ScreenKonect Contributors

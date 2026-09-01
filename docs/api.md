# API Reference

## Overview

ScreenKonect provides REST APIs for session management and authentication, and WebSocket APIs for real-time signaling.

## Base URLs

- **Auth Service**: `https://api.screenkonect.com/v1/auth`
- **Session Service**: `https://api.screenkonect.com/v1/sessions`
- **Audit Service**: `https://api.screenkonect.com/v1/audit`
- **Signaling**: `wss://signaling.screenkonect.com/ws/signaling`

## Authentication

All protected endpoints require a Bearer token:

```
Authorization: Bearer <access_token>
```

## Auth Endpoints

### POST /v1/auth/register

Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "display_name": "John Doe"
}
```

**Response (201):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 900,
  "token_type": "Bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "John Doe",
    "role": "technician"
  }
}
```

### POST /v1/auth/login

Authenticate a user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 900,
  "token_type": "Bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "John Doe",
    "role": "technician"
  }
}
```

### POST /v1/auth/refresh

Refresh access token.

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 900,
  "token_type": "Bearer"
}
```

### POST /v1/auth/logout

Logout and revoke refresh token.

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

## Session Endpoints

### POST /v1/sessions

Create a new support session.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "max_duration_minutes": 60,
  "idle_timeout_minutes": 15,
  "recording_enabled": false,
  "metadata": {}
}
```

**Response (201):**
```json
{
  "session": {
    "id": "uuid",
    "technician_id": "uuid",
    "status": "created",
    "session_code": "ABC12345",
    "consent_state": "none",
    "permissions": {
      "view": false,
      "control": false,
      "clipboard": false,
      "file_transfer": false,
      "audio": false
    },
    "created_at": "2024-01-01T00:00:00Z"
  },
  "join_url": "https://app.screenkonect.com/join/ABC12345?token=xyz",
  "join_token": "xyz"
}
```

### GET /v1/sessions

List all sessions for the authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "status": "active",
      "session_code": "ABC12345",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET /v1/sessions/:id

Get session details.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "session": {
    "id": "uuid",
    "technician_id": "uuid",
    "status": "active",
    "session_code": "ABC12345",
    "consent_state": "approved",
    "permissions": {
      "view": true,
      "control": true,
      "clipboard": false,
      "file_transfer": false,
      "audio": false
    },
    "client_platform": "windows",
    "started_at": "2024-01-01T00:01:00Z"
  }
}
```

### POST /v1/sessions/:id/end

End a session (technician only).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "session": {
    "id": "uuid",
    "status": "ended",
    "ended_at": "2024-01-01T01:00:00Z",
    "ended_reason": "technician_ended"
  }
}
```

### POST /v1/sessions/join

Client joins a session using token.

**Request:**
```json
{
  "token": "xyz",
  "platform": "windows",
  "device_name": "My Computer"
}
```

**Response (200):**
```json
{
  "session": {
    "id": "uuid",
    "status": "pending_approval",
    "consent_state": "pending"
  },
  "requires_consent": true
}
```

## Consent Endpoints

### POST /v1/sessions/:id/approve

Client approves the session.

**Request:**
```json
{
  "permissions": {
    "view": true,
    "control": true,
    "clipboard": false,
    "file_transfer": false,
    "audio": false
  }
}
```

**Response (200):**
```json
{
  "session": {
    "id": "uuid",
    "status": "active",
    "consent_state": "approved",
    "permissions": {
      "view": true,
      "control": true,
      "clipboard": false,
      "file_transfer": false,
      "audio": false
    }
  }
}
```

### POST /v1/sessions/:id/reject

Client rejects the session.

**Request:**
```json
{
  "reason": "Not comfortable with remote access"
}
```

**Response (200):**
```json
{
  "session": {
    "id": "uuid",
    "status": "ended",
    "consent_state": "denied",
    "ended_reason": "client_revoked"
  }
}
```

### POST /v1/sessions/:id/revoke

Client revokes active session.

**Response (200):**
```json
{
  "session": {
    "id": "uuid",
    "status": "ended",
    "consent_state": "revoked",
    "ended_reason": "client_revoked"
  }
}
```

### POST /v1/sessions/:id/permissions

Client updates permissions.

**Request:**
```json
{
  "permissions": {
    "view": true,
    "control": false,
    "clipboard": true,
    "file_transfer": false,
    "audio": false
  }
}
```

**Response (200):**
```json
{
  "session": {
    "id": "uuid",
    "permissions": {
      "view": true,
      "control": false,
      "clipboard": true,
      "file_transfer": false,
      "audio": false
    }
  }
}
```

### GET /v1/sessions/:id/consent-state

Get current consent state.

**Response (200):**
```json
{
  "consent_state": "approved",
  "permissions": {
    "view": true,
    "control": true,
    "clipboard": false,
    "file_transfer": false,
    "audio": false
  }
}
```

## Audit Endpoints

### GET /v1/audit

List audit logs.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `session_id`: Filter by session
- `user_id`: Filter by user
- `action`: Filter by action
- `start_date`: Filter by start date
- `end_date`: Filter by end date
- `limit`: Max results (default: 100)
- `offset`: Pagination offset

**Response (200):**
```json
{
  "logs": [
    {
      "id": 1,
      "session_id": "uuid",
      "user_id": "uuid",
      "action": "session.created",
      "details": {},
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "limit": 100,
  "offset": 0
}
```

## WebSocket Signaling

### Connection

```
wss://signaling.screenkonect.com/ws/signaling
```

### Messages

**Offer (Client → Server):**
```json
{
  "type": "offer",
  "session_id": "uuid",
  "payload": {
    "type": "offer",
    "sdp": "v=0\r\n..."
  }
}
```

**Answer (Server → Client):**
```json
{
  "type": "answer",
  "session_id": "uuid",
  "payload": {
    "type": "answer",
    "sdp": "v=0\r\n..."
  }
}
```

**ICE Candidate:**
```json
{
  "type": "ice-candidate",
  "session_id": "uuid",
  "payload": {
    "candidate": "candidate:...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

**Consent Update:**
```json
{
  "type": "consent-update",
  "session_id": "uuid",
  "payload": {
    "consent_state": "approved",
    "permissions": {
      "view": true,
      "control": true
    }
  }
}
```

**Session End:**
```json
{
  "type": "session-end",
  "session_id": "uuid",
  "payload": {
    "reason": "client_revoked"
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request parameters"
}
```

### 401 Unauthorized
```json
{
  "error": "Missing or invalid authorization header"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

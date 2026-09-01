# Session Lifecycle

## Overview

A ScreenKonect session goes through several states from creation to completion. This document describes each state and the transitions between them.

## State Diagram

```
┌─────────────┐
│   Created   │
└──────┬──────┘
       │ Client opens link
       ▼
┌─────────────────┐
│ PendingApproval │
└──────┬──────────┘
       │ Client approves / denies
       ├──────────────────┐
       ▼                  ▼
┌──────────────┐    ┌─────────┐
│    Active    │    │  Denied │
└──────┬───────┘    └─────────┘
       │
       ├──────────────────┐
       │                  │
       ▼                  ▼
┌──────────┐        ┌─────────┐
│  Paused  │        │  Ended  │
└────┬─────┘        └─────────┘
     │
     └──────────────┐
                    ▼
              ┌─────────┐
              │  Ended  │
              └─────────┘
```

## States

### Created

- Technician has created a session
- Join token generated
- Waiting for client to open the link
- No screen data transmitted

**Transitions:**
- → `PendingApproval`: Client opens join URL and validates token

### PendingApproval

- Client has joined the session
- Consent screen displayed
- Client choosing permissions
- No screen data transmitted

**Transitions:**
- → `Active`: Client approves consent
- → `Ended`: Client denies consent or token expires

### Active

- Client has approved the session
- Screen sharing may be active
- Remote control may be enabled
- All consent events logged

**Transitions:**
- → `Paused`: Client pauses the session
- → `Ended`: Client revokes, technician ends, or timeout

### Paused

- Client has temporarily paused the session
- Screen sharing suspended
- Can be resumed at any time

**Transitions:**
- → `Active`: Client resumes the session
- → `Ended`: Client revokes or timeout

### Ended

- Session has terminated
- All resources released
- Audit log recorded
- Cannot be resumed

## Consent Events

| Event | Description |
|-------|-------------|
| `consent_requested` | System requests client consent |
| `consent_approved` | Client approves the session |
| `consent_denied` | Client denies the session |
| `consent_revoked` | Client revokes previously granted consent |
| `permission_granted` | Client grants additional permission |
| `permission_revoked` | Client revokes a permission |

## Token Lifecycle

### Join Token

1. **Generated**: When technician creates session
2. **Delivered**: Via join URL to client
3. **Validated**: When client opens URL
4. **Consumed**: After successful validation
5. **Expired**: After configured timeout (default: 15 minutes)

### Session Code

1. **Generated**: When technician creates session
2. **Used**: For session identification
3. **Valid**: Throughout session lifetime
4. **Invalidated**: After session ends

## Timeouts

| Timeout | Default | Description |
|---------|---------|-------------|
| Consent timeout | 5 minutes | Time for client to approve |
| Session expiry | 60 minutes | Maximum session duration |
| Idle timeout | 15 minutes | Inactivity disconnect |
| Token expiry | 15 minutes | Join token validity |

## Error Handling

### Token Errors

- Invalid token: Return 401 Unauthorized
- Expired token: Return 401 with "token expired" message
- Used token: Return 401 with "token already used" message

### Session Errors

- Session not found: Return 404
- Session ended: Return 400 with "session ended" message
- Unauthorized access: Return 403

### Consent Errors

- Invalid consent state: Return 400 with current state
- Permission denied: Return 403
- Rate limited: Return 429

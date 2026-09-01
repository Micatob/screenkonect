# Device Enrollment

## Overview

ScreenKonect supports optional device enrollment for returning clients. This feature allows clients to install the agent once and easily reconnect for future support sessions while maintaining full consent control.

## How It Works

### Enrollment Flow

```
1. Client downloads and installs the agent
2. Agent shows installation disclosure
3. Client runs agent for the first time
4. Agent generates enrollment request
5. Technician or client initiates enrollment
6. Client approves enrollment
7. Device is registered in the system
8. Future sessions are easier to connect
```

### What Happens During Enrollment

1. **Agent Installation**: Client downloads and installs the agent with clear disclosure
2. **First Run**: Agent shows "Ready for Support" indicator
3. **Registration**: Agent contacts server and registers device
4. **Approval**: Client or technician approves the enrollment
5. **Storage**: Device info stored securely with enrollment token

## Benefits

### For Clients

- **Easy reconnection**: One-click to join future sessions
- **Persistent indicator**: Always know when agent is running
- **Clear control**: Easy access to settings and uninstall
- **Consent maintained**: Still approve every session

### For Technicians

- **Device list**: See all enrolled devices
- **Quick connect**: Connect to known devices easily
- **Device info**: See platform, hostname, last seen
- **Session history**: View past sessions for each device

## Security Model

### What Enrollment Does

| Feature | Without Enrollment | With Enrollment |
|---------|-------------------|-----------------|
| Connection method | One-time link each time | Link or device list |
| Consent required | Every session | Every session (always) |
| Visible indicator | During sessions only | Always when agent running |
| Technician can see device | No | Yes (if allowed) |
| Quick reconnect | No | Yes (one click) |
| Uninstall | N/A | Easy uninstall option |

### What Enrollment Does NOT Do

- **Still requires consent** for every session
- **Still shows indicator** when agent is running
- **Can be uninstalled** at any time
- **No hidden background** processes
- **No auto-connect** without approval
- **User controls** which technicians can connect

## Agent Visibility

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

## API Endpoints

### Enroll Device

```http
POST /v1/devices/enroll
Authorization: Bearer <token>
Content-Type: application/json

{
  "device_name": "My Computer",
  "platform": "windows",
  "hostname": "DESKTOP-ABC123",
  "mac_address": "00:11:22:33:44:55"
}
```

Response:
```json
{
  "device": {
    "id": "uuid",
    "device_name": "My Computer",
    "platform": "windows",
    "hostname": "DESKTOP-ABC123",
    "is_active": true,
    "require_approval": true,
    "enrolled_at": "2024-01-01T00:00:00Z"
  },
  "enrollment_token": "abc123...",
  "enrollment_url": "screenkonect://enroll?token=abc123..."
}
```

### Device Authentication

```http
POST /v1/devices/authenticate
Content-Type: application/json

{
  "enrollment_token": "abc123...",
  "hostname": "DESKTOP-ABC123"
}
```

Response:
```json
{
  "device_id": "uuid",
  "device_name": "My Computer",
  "require_approval": true,
  "allowed_technician_ids": ["technician-uuid"]
}
```

### Device Heartbeat

```http
POST /v1/devices/:id/heartbeat
```

Response:
```json
{
  "status": "ok",
  "require_approval": true
}
```

## Device Settings

### Require Approval

When `require_approval` is true (default):
- Every session requires explicit client consent
- Technician cannot connect without approval
- Client sees consent screen each time

When `require_approval` is false:
- Trusted technicians can connect without consent screen
- Still shows indicator when connected
- Client can revoke at any time

### Allowed Technicians

The `allowed_technician_ids` array controls which technicians can:
- See the device in their device list
- Create sessions for this device
- Connect to this device (if approval not required)

## Session Flow with Enrolled Device

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Technician  │         │   Server     │         │    Client    │
│  Dashboard   │         │  (Backend)   │         │   (Agent)    │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │  1. See Device List    │                        │
       │◀───────────────────────│                        │
       │                        │                        │
       │  2. Select Device      │                        │
       │───────────────────────▶│                        │
       │                        │                        │
       │  3. Create Session     │                        │
       │     for Device         │                        │
       │───────────────────────▶│                        │
       │                        │                        │
       │                        │  4. Notify Agent      │
       │                        │───────────────────────▶│
       │                        │                        │
       │                        │  5. Show Request      │
       │                        │◀───────────────────────│
       │                        │                        │
       │                        │  6. Approve/Reject    │
       │                        │◀───────────────────────│
       │                        │                        │
       │  7. Session Active     │                        │
       │◀───────────────────────│                        │
```

## Uninstall Process

### Via Agent

1. Client clicks "Uninstall" in agent UI
2. Agent shows confirmation dialog
3. Client confirms uninstall
4. Agent removes itself from system
5. Device marked as inactive in database

### Via API

```http
DELETE /v1/devices/:id
Authorization: Bearer <token>
```

Response:
```json
{
  "message": "Device removed"
}
```

## Privacy Considerations

### Data Collected

- Device name (user-provided)
- Platform and version
- Hostname
- Last IP address
- Last seen timestamp
- Agent version

### Data Not Collected

- Screen content (without consent)
- Keystrokes (without consent)
- Files or documents
- Personal information
- Location data

### Data Retention

- Device data retained while device is active
- Inactive devices removed after 90 days
- Session data retained per audit policy
- Client can request data deletion

## Troubleshooting

### Agent Not Connecting

1. Check network connectivity
2. Verify enrollment token is valid
3. Check if device is marked as inactive
4. Review server logs for errors

### Cannot See Device

1. Verify technician is in allowed list
2. Check device is active
3. Refresh device list
4. Check device heartbeat is working

### Session Not Starting

1. Verify device requires approval
2. Check if client approved the request
3. Review consent events in audit log
4. Check session status

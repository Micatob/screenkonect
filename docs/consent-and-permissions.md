# Consent and Permissions

## Overview

ScreenKonect implements a consent-first approach to remote support. No screen data is transmitted until the client explicitly approves the session and grants specific permissions.

## Consent Model

### Principles

1. **Explicit Consent**: Clients must actively approve every session
2. **Granular Permissions**: Clients choose exactly what access to grant
3. **Revocable**: Clients can end the session at any time
4. **Transparent**: Clients always see what is being shared
5. **Auditable**: All consent events are logged

### Consent Flow

```
1. Technician creates session
2. Client opens join URL
3. Client sees consent screen
4. Client reviews what will be shared
5. Client chooses permissions
6. Client clicks "Approve"
7. Server records consent
8. Session becomes active
9. Client can revoke at any time
```

## Permission Types

### View Screen (Required)

- **Description**: Allows technician to see the client's screen
- **Default**: Enabled (required for support)
- **Cannot be disabled**: This is the minimum required for remote support

### Remote Control

- **Description**: Allows technician to control mouse and keyboard
- **Default**: Disabled
- **OS Permissions**: May require accessibility permissions on macOS
- **Risks**: Technician can interact with the client's system

### Clipboard Sync

- **Description**: Allows copying text between devices
- **Default**: Disabled
- **Risks**: Sensitive data could be copied

### File Transfer

- **Description**: Allows sending and receiving files
- **Default**: Disabled
- **Risks**: Malicious files could be transferred
- **Mitigations**: Size limits, virus scan hooks (planned)

### Audio Sharing

- **Description**: Shares system audio
- **Default**: Disabled
- **Risks**: Sensitive audio could be captured

## Consent Screen

The consent screen displays:

1. **Header**: Clear indication of remote support request
2. **What will be shared**: List of active permissions
3. **Permission toggles**: Client can enable/disable optional permissions
4. **Important notice**: Client can end session at any time
5. **Approve/Deny buttons**: Clear action buttons

## Session Indicator

When a session is active, the client sees:

1. **Persistent indicator**: Always visible on screen
2. **"Screen Shared" text**: Clear status message
3. **Pulsing dot**: Visual indication of active sharing
4. **Details panel**: Click to see active permissions
5. **End Session button**: One-click to terminate

## Server-Side Enforcement

### Consent State Verification

```typescript
// Before allowing media transmission
if (session.consent_state !== 'approved') {
  throw new Error('Consent not approved');
}
```

### Permission Checking

```typescript
// Before allowing remote control
if (!session.permissions.control) {
  throw new Error('Remote control not permitted');
}
```

### Audit Logging

```typescript
// Log all consent events
await db.insert(consentEvents).values({
  session_id: sessionId,
  event_type: 'consent_approved',
  granted_by: 'client',
  permissions: selectedPermissions,
  ip_address: clientIp,
});
```

## Privacy by Default

### Data Minimization

- Only collect necessary information
- No recording by default
- Short-lived tokens
- Automatic session expiry

### Transparency

- Clear privacy notice on consent screen
- Visible session indicator
- Permission list always shown
- Audit log accessible

### User Control

- Clients can end session instantly
- Clients can revoke specific permissions
- Clients can pause the session
- No hidden background processes

## Compliance Considerations

### GDPR/CCPA

- Explicit consent for data processing
- Right to access audit logs
- Right to deletion (session data)
- Data retention policies

### Recording

- Recording disabled by default
- Dual consent required (both parties)
- Visible recording indicator
- Consent events logged

### Audit Trail

- All consent events recorded
- Immutable audit logs
- Retention policy configurable
- Export capability (planned)

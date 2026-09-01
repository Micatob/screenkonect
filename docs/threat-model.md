# Threat Model

## Overview

This document identifies potential threats to ScreenKonect and the mitigations implemented to address them.

## Threat Categories

### 1. Authentication Threats

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| Credential theft | High | Medium | bcrypt hashing, rate limiting, MFA-ready |
| Token theft | High | Medium | Short-lived tokens, refresh rotation, revocation |
| Session hijacking | High | Low | Session-bound tokens, IP binding (planned) |
| Brute force attacks | Medium | Medium | Rate limiting, account lockout |
| Password spray | Medium | Medium | Rate limiting, account lockout |

### 2. Session Threats

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| Unauthorized session access | High | Low | One-time tokens, consent requirement |
| Token replay attacks | High | Low | Single-use tokens, hashed storage |
| Session fixation | Medium | Low | Random session codes, token rotation |
| Session hijacking | High | Low | Session-bound tokens, WSS |
| Race conditions | Medium | Low | Database transactions, atomic operations |

### 3. Consent Threats

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| Bypassing consent | Critical | Very Low | Server-side verification, consent state checks |
| Consent manipulation | High | Low | Immutable consent events, audit logging |
| Hidden screen capture | Critical | Very Low | Consent required before media flow |
| Silent remote control | Critical | Very Low | Permission checks, client indicator |
| Consent revocation bypass | High | Low | Immediate disconnection, server-side enforcement |

### 4. Media Threats

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| Eavesdropping | High | Low | DTLS-SRTP encryption, TLS signaling |
| Man-in-the-middle | High | Very Low | Certificate pinning, WSS |
| Media interception | High | Low | End-to-end encryption |
| TURN server compromise | Medium | Low | Short-lived credentials, TLS |
| WebRTC vulnerabilities | Medium | Low | Keep dependencies updated |

### 5. Input Injection Threats

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| Unauthorized input | High | Low | Permission checks, consent verification |
| Input injection attacks | Medium | Low | Rate limiting, input validation |
| Keyboard logging | High | Low | No logging, encrypted transport |
| Mouse manipulation | Medium | Low | Session-scoped, rate limited |

### 6. Data Threats

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| Data exfiltration | High | Low | No recording by default, audit logging |
| PII exposure | Medium | Low | Minimal data collection, encryption |
| Audit log tampering | Medium | Very Low | Append-only logs, separate storage |
| Secret exposure | High | Low | Environment variables, no client secrets |

### 7. Infrastructure Threats

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| DDoS attacks | Medium | Medium | Rate limiting, CDN, auto-scaling |
| Server compromise | High | Low | Container isolation, minimal privileges |
| Database breach | High | Low | Encryption at rest, access controls |
| Redis compromise | Medium | Low | Authentication, network isolation |

### 8. Client-Side Threats

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| Malicious agent | Critical | Very Low | Signed binaries, consent requirement |
| Hidden persistence | Critical | Very Low | No auto-start, visible indicator |
| Privilege escalation | High | Very Low | User-level execution, no UAC bypass |
| Screen recording | High | Low | Consent required, visible indicator |

## Mitigation Details

### Authentication

```typescript
// Password hashing
const hash = await bcrypt.hash(password, 12);

// Token generation
const token = crypto.randomBytes(32).toString('hex');

// Token hashing for storage
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
```

### Session Security

```typescript
// One-time token validation
const sessionToken = await db.query.sessionTokens.findFirst({
  where: and(
    eq(sessionTokens.token_hash, tokenHash),
    eq(sessionTokens.used, false),
    gt(sessionTokens.expires_at, new Date())
  ),
});

// Mark token as used
await db.update(sessionTokens)
  .set({ used: true, used_at: new Date() })
  .where(eq(sessionTokens.id, sessionToken.id));
```

### Consent Enforcement

```typescript
// Server-side consent check
if (session.consent_state !== 'approved') {
  throw new Error('Consent not approved');
}

// Permission check
if (!session.permissions.control) {
  throw new Error('Remote control not permitted');
}

// Audit logging
await db.insert(consentEvents).values({
  session_id: sessionId,
  event_type: 'consent_approved',
  granted_by: 'client',
  permissions: selectedPermissions,
});
```

### Transport Security

```typescript
// TLS configuration
const app = fastify({
  https: {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert'),
  },
});

// WSS for WebSocket
const ws = new WebSocket('wss://signaling.example.com');
```

## Security Controls

### Preventive Controls

1. **Authentication**: JWT with short expiry
2. **Authorization**: Role-based access control
3. **Encryption**: TLS 1.3, DTLS-SRTP
4. **Validation**: Zod schema validation
5. **Rate limiting**: Request throttling
6. **Consent**: Explicit client approval

### Detective Controls

1. **Audit logging**: All events recorded
2. **Monitoring**: Anomaly detection
3. **Alerting**: Security event notifications
4. **Metrics**: Performance monitoring

### Corrective Controls

1. **Token revocation**: Immediate invalidation
2. **Session termination**: Instant disconnection
3. **Account lockout**: Brute force protection
4. **Incident response**: Security procedures

## Residual Risks

1. **Zero-day vulnerabilities**: Mitigated by keeping dependencies updated
2. **Physical access**: Mitigated by OS-level security
3. **Insider threats**: Mitigated by audit logging and access controls
4. **Social engineering**: Mitigated by user education

## Security Testing

### Penetration Testing

- Annual third-party security audits
- Bug bounty program (planned)
- Regular vulnerability scanning

### Code Security

- Static analysis with ESLint
- Dependency auditing with npm audit
- Container scanning in CI/CD

### Infrastructure Security

- Network segmentation
- Firewall rules
- Intrusion detection

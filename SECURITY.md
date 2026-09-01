# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in ScreenKonect, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email security@screenkonect.example.com with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a timeline for resolution.

## Security Measures

### Authentication
- JWT-based authentication with short-lived access tokens (15 minutes)
- Refresh token rotation with revocation support
- bcrypt password hashing with configurable salt rounds
- Rate limiting on login attempts

### Session Security
- Cryptographically random session codes (8 characters, alphanumeric)
- One-time join tokens (32 bytes, hex-encoded)
- Token hashing with SHA-256 before storage
- Session-bound tokens that cannot be reused
- Automatic session expiry

### Consent Enforcement
- Server-side consent state verification
- Client-side consent confirmation
- No media transmission before consent approval
- Consent events logged for audit trail
- Permission changes require explicit client action

### Transport Security
- TLS 1.3 for all HTTP traffic
- WSS (WebSocket Secure) for signaling
- DTLS-SRTP for WebRTC media encryption
- HSTS headers enabled

### Data Protection
- No secrets in client bundles
- Environment-based configuration
- Encrypted storage for sensitive data
- Short-lived tokens with automatic expiry
- Audit logs are append-only

### Input Validation
- Zod schema validation for all inputs
- SQL injection prevention via parameterized queries
- XSS protection via CSP headers
- CSRF protection via SameSite cookies

## Security Checklist

- [ ] All traffic encrypted in transit
- [ ] Passwords hashed with bcrypt
- [ ] JWT tokens have short expiry
- [ ] Refresh tokens can be revoked
- [ ] Session tokens are one-time use
- [ ] Consent required before media flow
- [ ] Audit logging for all actions
- [ ] Rate limiting enabled
- [ ] CSP headers configured
- [ ] No secrets in code
- [ ] Dependencies audited regularly

## Dependency Security

We use `npm audit` to check for known vulnerabilities in dependencies. Run:

```bash
npm audit
npm audit fix
```

## Responsible Disclosure

We follow responsible disclosure practices:

1. Report received and acknowledged
2. Investigation and confirmation
3. Fix developed and tested
4. Security advisory published
5. Credit given to reporter (if desired)

## Contact

- Security Email: security@screenkonect.example.com
- PGP Key: [Link to PGP key]

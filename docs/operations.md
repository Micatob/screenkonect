# Operations Guide

## Overview

This guide covers operational procedures for running ScreenKonect in production.

## Monitoring

### Health Checks

All services expose health check endpoints:

```bash
# Check individual service
curl https://api.screenkonect.com/healthz

# Check readiness
curl https://api.screenkonect.com/readyz
```

### Metrics

Prometheus metrics available at `/metrics` endpoint:

- `screenkonect_sessions_active` - Active sessions count
- `screenkonect_sessions_created_total` - Total sessions created
- `screenkonect_consent_approved_total` - Total consent approvals
- `screenkonect_auth_login_total` - Total login attempts
- `screenkonect_auth_failed_total` - Failed login attempts
- `screenkonect_request_duration_seconds` - Request latency

### Logging

Structured JSON logs with:
- Request ID
- Session ID
- User ID
- Timestamp
- Log level
- Message

Example:
```json
{
  "requestId": "abc123",
  "sessionId": "uuid",
  "level": "info",
  "message": "Session created",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Incident Response

### Service Down

1. Check health endpoints
2. Review service logs
3. Check database connectivity
4. Check Redis connectivity
5. Restart affected service
6. Monitor recovery

### Security Incident

1. Identify affected scope
2. Revoke compromised tokens
3. Terminate affected sessions
4. Review audit logs
5. Notify affected users
6. Document incident

### Database Issues

1. Check connection pool
2. Review slow queries
3. Check disk space
4. Verify backups
5. Consider scaling

## Maintenance

### Database Maintenance

```bash
# Vacuum and analyze
vacuumdb -U screenkonect screenkonect -z

# Check table sizes
psql -U screenkonect -c "SELECT pg_size_pretty(pg_total_relation_size('sessions'));"
```

### Log Rotation

Configure log rotation for:
- Application logs
- Access logs
- Error logs

### Certificate Renewal

```bash
# Check certificate expiry
openssl x509 -enddate -noout -in /etc/letsencrypt/live/api.screenkonect.com/cert.pem

# Renew certificates
certbot renew
```

## Scaling

### Horizontal Scaling

1. Increase service replicas
2. Configure load balancer
3. Verify session affinity not required
4. Monitor connection distribution

### Vertical Scaling

1. Increase CPU/memory limits
2. Monitor resource utilization
3. Adjust connection pools
4. Optimize queries

## Backup and Recovery

### Database Backups

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump -U screenkonect screenkonect | gzip > /backups/db_$DATE.sql.gz

# Retention: 30 days
find /backups -name "*.sql.gz" -mtime +30 -delete
```

### Redis Backups

```bash
# Backup Redis
redis-cli -a password BGSAVE
cp /var/lib/redis/dump.rdb /backups/redis_$(date +%Y%m%d).rdb
```

### Recovery Procedure

1. Stop affected services
2. Restore database from backup
3. Restore Redis if needed
4. Verify data integrity
5. Restart services
6. Monitor recovery

## Performance Tuning

### Database

- Monitor slow queries
- Add indexes as needed
- Adjust connection pool size
- Consider read replicas

### Redis

- Monitor memory usage
- Configure eviction policies
- Use connection pooling
- Monitor key expiration

### Application

- Monitor request latency
- Profile hot paths
- Optimize database queries
- Cache frequent queries

## Security Operations

### Token Rotation

```bash
# Rotate JWT secrets
NEW_ACCESS_SECRET=$(openssl rand -hex 32)
NEW_REFRESH_SECRET=$(openssl rand -hex 32)

# Update environment variables
# Restart services
```

### Audit Log Review

```bash
# Check for suspicious activity
psql -U screenkonect -c "
  SELECT action, COUNT(*), DATE(created_at)
  FROM audit_logs
  WHERE created_at > NOW() - INTERVAL '7 days'
  GROUP BY action, DATE(created_at)
  ORDER BY count DESC;
"
```

### Vulnerability Scanning

```bash
# Scan dependencies
npm audit

# Scan containers
trivy image screenkonect/auth:latest
```

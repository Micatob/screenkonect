import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import dotenv from 'dotenv';

// Walk up from cwd to find the project root (where config/ and .env live)
function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'config', 'default.yaml'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const projectRoot = findProjectRoot();
dotenv.config({ path: path.join(projectRoot, '.env') });

const SessionPolicySchema = z.object({
  default_expiry_minutes: z.number().min(1).max(1440).default(60),
  max_expiry_minutes: z.number().min(1).max(1440).default(480),
  idle_timeout_minutes: z.number().min(1).max(120).default(15),
  one_time_link_usage: z.boolean().default(true),
  consent_timeout_ms: z.number().min(1000).max(300000).default(300000),
  require_client_approval: z.boolean().default(true),
  allow_remote_control: z.boolean().default(true),
  allow_file_transfer: z.boolean().default(false),
  allow_clipboard_sync: z.boolean().default(false),
  allow_recording: z.boolean().default(false),
  require_recording_consent: z.boolean().default(true),
  max_viewers_per_session: z.number().min(1).max(10).default(5),
  ip_allowlist: z.array(z.string()).optional(),
  audit_log_retention_days: z.number().min(1).max(365).default(90),
});

const SecurityConfigSchema = z.object({
  jwt_access_secret: z.string().min(32),
  jwt_refresh_secret: z.string().min(32),
  bcrypt_salt_rounds: z.number().min(10).max(20).default(12),
  max_login_attempts: z.number().min(3).max(20).default(5),
  login_lockout_ms: z.number().min(60000).max(3600000).default(1800000),
  token_expiry_ms: z.number().min(60000).max(3600000).default(900000),
  refresh_token_expiry_days: z.number().min(1).max(90).default(30),
  cors_origins: z.array(z.string()).default(['http://localhost:5173', 'http://localhost:5174']),
  rate_limit_window_ms: z.number().default(60000),
  rate_limit_max_requests: z.number().default(100),
});

const ObservabilityConfigSchema = z.object({
  log_level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  enable_tracing: z.boolean().default(false),
  otel_endpoint: z.string().url().optional(),
  sentry_dsn: z.string().url().optional(),
  enable_metrics: z.boolean().default(true),
  metrics_port: z.number().default(9090),
});

const AppConfigSchema = z.object({
  port: z.number().min(1).max(65535).default(3000),
  host: z.string().default('0.0.0.0'),
  database_url: z.string().url(),
  redis_url: z.string().url().default('redis://localhost:6379'),
  public_url: z.string().url().optional(),
  session_policy: SessionPolicySchema.default({}),
  security: SecurityConfigSchema,
  observability: ObservabilityConfigSchema.default({}),
});

export type SessionPolicy = z.infer<typeof SessionPolicySchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

function loadYamlConfig(filePath: string): Record<string, unknown> {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return parseYaml(content) || {};
  } catch {
    return {};
  }
}

export function loadConfig(configDir?: string): AppConfig {
  const dir = configDir || path.join(findProjectRoot(), 'config');

  const defaultConfig = loadYamlConfig(path.join(dir, 'default.yaml'));
  const sessionPolicy = loadYamlConfig(path.join(dir, 'session-policy.yaml'));
  const securityConfig = loadYamlConfig(path.join(dir, 'security.yaml'));
  const observabilityConfig = loadYamlConfig(path.join(dir, 'observability.yaml'));

  const rawConfig = {
    ...defaultConfig,
    session_policy: { ...(defaultConfig.session_policy as Record<string, unknown>), ...sessionPolicy },
    observability: { ...(defaultConfig.observability as Record<string, unknown>), ...observabilityConfig },
    database_url: process.env.DATABASE_URL || defaultConfig.database_url,
    redis_url: process.env.REDIS_URL || defaultConfig.redis_url,
    public_url: process.env.PUBLIC_URL || (defaultConfig as any).public_url,
    security: {
      ...(defaultConfig.security as Record<string, unknown>),
      ...securityConfig,
      jwt_access_secret: process.env.JWT_ACCESS_SECRET || (securityConfig as Record<string, unknown>).jwt_access_secret,
      jwt_refresh_secret: process.env.JWT_REFRESH_SECRET || (securityConfig as Record<string, unknown>).jwt_refresh_secret,
      cors_origins: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
        : (securityConfig as Record<string, unknown>).cors_origins,
    },
  };

  return AppConfigSchema.parse(rawConfig);
}

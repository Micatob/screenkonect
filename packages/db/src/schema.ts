import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  inet,
  jsonb,
  bigint,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique(),
  display_name: varchar('display_name', { length: 100 }),
  password_hash: varchar('password_hash', { length: 255 }),
  role: varchar('role', { length: 20 }).notNull().default('technician'),
  company_id: uuid('company_id'),
  mfa_enabled: boolean('mfa_enabled').default(false),
  mfa_secret: varchar('mfa_secret', { length: 255 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  last_login_at: timestamp('last_login_at', { withTimezone: true }),
});

export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }).unique(),
  default_access_policy: varchar('default_access_policy', { length: 30 }).default('notification_only'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    technician_id: uuid('technician_id')
      .notNull()
      .references(() => users.id),
    device_id: uuid('device_id').references(() => devices.id),
    status: varchar('status', { length: 20 }).notNull().default('created'),
    session_code: varchar('session_code', { length: 20 }).unique().notNull(),
    client_token_hash: varchar('client_token_hash', { length: 255 }),
    client_token_used: boolean('client_token_used').default(false),
    consent_state: varchar('consent_state', { length: 20 }).default('none'),
    access_mode: varchar('access_mode', { length: 20 }).default('consent'),
    permissions: jsonb('permissions')
      .default({
        view: false,
        control: false,
        clipboard: false,
        file_transfer: false,
        audio: false,
      })
      .$type<{
        view: boolean;
        control: boolean;
        clipboard: boolean;
        file_transfer: boolean;
        audio: boolean;
      }>(),
    client_platform: varchar('client_platform', { length: 20 }),
    client_ip: inet('client_ip'),
    client_approx_location: varchar('client_approx_location', { length: 100 }),
    max_duration_minutes: integer('max_duration_minutes').default(60),
    idle_timeout_minutes: integer('idle_timeout_minutes').default(15),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    started_at: timestamp('started_at', { withTimezone: true }),
    ended_at: timestamp('ended_at', { withTimezone: true }),
    ended_reason: varchar('ended_reason', { length: 50 }),
    recording_enabled: boolean('recording_enabled').default(false),
    recording_consent: boolean('recording_consent').default(false),
    metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
  },
  (table) => ({
    statusIdx: index('idx_sessions_status').on(table.status),
    technicianIdx: index('idx_sessions_technician').on(table.technician_id),
    codeIdx: index('idx_sessions_code').on(table.session_code),
    deviceIdx: index('idx_sessions_device').on(table.device_id),
  })
);

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    enrollment_token_hash: varchar('enrollment_token_hash', { length: 255 }).unique(),
    device_name: varchar('device_name', { length: 255 }),
    platform: varchar('platform', { length: 20 }),
    platform_version: varchar('platform_version', { length: 50 }),
    agent_version: varchar('agent_version', { length: 20 }),
    hostname: varchar('hostname', { length: 255 }),
    mac_address: varchar('mac_address', { length: 17 }),
    last_ip: inet('last_ip'),
    public_key: text('public_key'),
    enrolled_at: timestamp('enrolled_at', { withTimezone: true }).defaultNow(),
    last_seen_at: timestamp('last_seen_at', { withTimezone: true }),
    is_active: boolean('is_active').default(true),
    company_id: uuid('company_id').references(() => companies.id),
    assigned_user_id: uuid('assigned_user_id').references(() => users.id),
    access_policy: varchar('access_policy', { length: 30 }).default('consent_required'),
    allowed_technician_ids: jsonb('allowed_technician_ids').default([]).$type<string[]>(),
    notify_user_on_connect: boolean('notify_user_on_connect').default(true),
    metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
  },
  (table) => ({
    enrollmentTokenIdx: index('idx_devices_enrollment_token').on(table.enrollment_token_hash),
    hostnameIdx: index('idx_devices_hostname').on(table.hostname),
    companyIdx: index('idx_devices_company').on(table.company_id),
    assignedUserIdx: index('idx_devices_assigned_user').on(table.assigned_user_id),
  })
);

export const deviceSessions = pgTable(
  'device_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    device_id: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    session_id: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    connected_at: timestamp('connected_at', { withTimezone: true }).defaultNow(),
    disconnected_at: timestamp('disconnected_at', { withTimezone: true }),
    disconnect_reason: varchar('disconnect_reason', { length: 50 }),
  },
  (table) => ({
    deviceIdx: index('idx_device_sessions_device').on(table.device_id),
    sessionIdx: index('idx_device_sessions_session').on(table.session_id),
  })
);

export const sessionTokens = pgTable(
  'session_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    session_id: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    token_hash: varchar('token_hash', { length: 255 }).notNull(),
    token_type: varchar('token_type', { length: 20 }).notNull(),
    used: boolean('used').default(false),
    used_at: timestamp('used_at', { withTimezone: true }),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    tokenHashIdx: index('idx_session_tokens_hash').on(table.token_hash),
  })
);

export const consentEvents = pgTable(
  'consent_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    session_id: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    event_type: varchar('event_type', { length: 30 }).notNull(),
    granted_by: varchar('granted_by', { length: 20 }).notNull(),
    permissions: jsonb('permissions').$type<Record<string, boolean> | null>(),
    ip_address: inet('ip_address'),
    user_agent: text('user_agent'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    sessionIdx: index('idx_consent_events_session').on(table.session_id),
  })
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    session_id: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    device_id: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 50 }).notNull(),
    details: jsonb('details').default({}).$type<Record<string, unknown>>(),
    ip_address: inet('ip_address'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    sessionIdx: index('idx_audit_logs_session').on(table.session_id),
    userIdx: index('idx_audit_logs_user').on(table.user_id),
    deviceIdx: index('idx_audit_logs_device').on(table.device_id),
    createdIdx: index('idx_audit_logs_created').on(table.created_at),
  })
);

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token_hash: varchar('token_hash', { length: 255 }).notNull(),
  device_id: uuid('device_id').references(() => devices.id),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  revoked_at: timestamp('revoked_at', { withTimezone: true }),
});

export const rateLimitEvents = pgTable(
  'rate_limit_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    identifier: varchar('identifier', { length: 255 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    window_start: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').default(1),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    identifierIdx: index('idx_rate_limit_identifier').on(
      table.identifier,
      table.action,
      table.window_start
    ),
  })
);

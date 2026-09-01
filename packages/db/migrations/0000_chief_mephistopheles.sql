CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" uuid,
	"user_id" uuid,
	"device_id" uuid,
	"action" varchar(50) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255),
	"default_access_policy" varchar(30) DEFAULT 'notification_only',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "companies_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "consent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"granted_by" varchar(20) NOT NULL,
	"permissions" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now(),
	"disconnected_at" timestamp with time zone,
	"disconnect_reason" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_token_hash" varchar(255),
	"device_name" varchar(255),
	"platform" varchar(20),
	"platform_version" varchar(50),
	"agent_version" varchar(20),
	"hostname" varchar(255),
	"mac_address" varchar(17),
	"last_ip" "inet",
	"public_key" text,
	"enrolled_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone,
	"is_active" boolean DEFAULT true,
	"company_id" uuid,
	"assigned_user_id" uuid,
	"access_policy" varchar(30) DEFAULT 'consent_required',
	"allowed_technician_ids" jsonb DEFAULT '[]'::jsonb,
	"notify_user_on_connect" boolean DEFAULT true,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "devices_enrollment_token_hash_unique" UNIQUE("enrollment_token_hash")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rate_limit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"identifier" varchar(255) NOT NULL,
	"action" varchar(50) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"device_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "session_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"token_type" varchar(20) NOT NULL,
	"used" boolean DEFAULT false,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"device_id" uuid,
	"status" varchar(20) DEFAULT 'created' NOT NULL,
	"session_code" varchar(20) NOT NULL,
	"client_token_hash" varchar(255),
	"client_token_used" boolean DEFAULT false,
	"consent_state" varchar(20) DEFAULT 'none',
	"access_mode" varchar(20) DEFAULT 'consent',
	"permissions" jsonb DEFAULT '{"view":false,"control":false,"clipboard":false,"file_transfer":false,"audio":false}'::jsonb,
	"client_platform" varchar(20),
	"client_ip" "inet",
	"client_approx_location" varchar(100),
	"max_duration_minutes" integer DEFAULT 60,
	"idle_timeout_minutes" integer DEFAULT 15,
	"created_at" timestamp with time zone DEFAULT now(),
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"ended_reason" varchar(50),
	"recording_enabled" boolean DEFAULT false,
	"recording_consent" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "sessions_session_code_unique" UNIQUE("session_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"display_name" varchar(100),
	"password_hash" varchar(255),
	"role" varchar(20) DEFAULT 'technician' NOT NULL,
	"company_id" uuid,
	"mfa_enabled" boolean DEFAULT false,
	"mfa_secret" varchar(255),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_tokens" ADD CONSTRAINT "session_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_session" ON "audit_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_device" ON "audit_logs" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_consent_events_session" ON "consent_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_device_sessions_device" ON "device_sessions" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_device_sessions_session" ON "device_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_devices_enrollment_token" ON "devices" USING btree ("enrollment_token_hash");--> statement-breakpoint
CREATE INDEX "idx_devices_hostname" ON "devices" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX "idx_devices_company" ON "devices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_devices_assigned_user" ON "devices" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "idx_rate_limit_identifier" ON "rate_limit_events" USING btree ("identifier","action","window_start");--> statement-breakpoint
CREATE INDEX "idx_session_tokens_hash" ON "session_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_status" ON "sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sessions_technician" ON "sessions" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_code" ON "sessions" USING btree ("session_code");--> statement-breakpoint
CREATE INDEX "idx_sessions_device" ON "sessions" USING btree ("device_id");
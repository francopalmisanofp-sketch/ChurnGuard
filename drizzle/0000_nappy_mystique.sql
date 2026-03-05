CREATE TYPE "public"."decline_type" AS ENUM('soft', 'hard', 'sca_required');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'executing', 'done', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('email', 'retry');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('job_failed', 'payment_recovered', 'plan_past_due', 'plan_expiring');--> statement-breakpoint
CREATE TYPE "public"."org_plan" AS ENUM('starter', 'growth', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'in_dunning', 'recovered', 'hard_churn', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('active', 'past_due', 'canceled', 'trialing');--> statement-breakpoint
CREATE TABLE "dunning_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"failed_payment_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_type" "job_type" NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"attempt_number" integer DEFAULT 0 NOT NULL,
	"result" jsonb,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"email_subject" text,
	"email_body_preview" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "failed_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stripe_event_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_invoice_id" text NOT NULL,
	"stripe_subscription_id" text,
	"customer_email" text NOT NULL,
	"customer_name" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"failure_reason" text,
	"decline_type" "decline_type" NOT NULL,
	"status" "payment_status" DEFAULT 'in_dunning' NOT NULL,
	"dunning_step" integer DEFAULT 0 NOT NULL,
	"recovered_at" timestamp with time zone,
	"recovered_amount" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "org_role" NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "org_role" DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"stripe_webhook_secret" text,
	"stripe_account_id" text,
	"resend_domain" text,
	"plan" "org_plan" DEFAULT 'starter' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"logo_url" text,
	"brand_color" text DEFAULT '#000000',
	"stripe_customer_id_churnguard" text,
	"stripe_subscription_id_churnguard" text,
	"plan_status" "plan_status" DEFAULT 'trialing' NOT NULL,
	"plan_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"failed_payment_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period" date NOT NULL,
	"total_failed" integer DEFAULT 0 NOT NULL,
	"total_recovered" integer DEFAULT 0 NOT NULL,
	"recovery_rate" numeric(5, 2),
	"mrr_saved" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dunning_jobs" ADD CONSTRAINT "dunning_jobs_failed_payment_id_failed_payments_id_fk" FOREIGN KEY ("failed_payment_id") REFERENCES "public"."failed_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dunning_jobs" ADD CONSTRAINT "dunning_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failed_payments" ADD CONSTRAINT "failed_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_tokens" ADD CONSTRAINT "payment_tokens_failed_payment_id_failed_payments_id_fk" FOREIGN KEY ("failed_payment_id") REFERENCES "public"."failed_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_tokens" ADD CONSTRAINT "payment_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_metrics" ADD CONSTRAINT "recovery_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_jobs_idx" ON "dunning_jobs" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "job_org_idx" ON "dunning_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_event_idx" ON "failed_payments" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "org_status_idx" ON "failed_payments" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_token_idx" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "notifications_org_unread_idx" ON "notifications" USING btree ("organization_id","read","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "org_user_idx" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "token_lookup_idx" ON "payment_tokens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "org_period_idx" ON "recovery_metrics" USING btree ("organization_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_event_idx" ON "webhook_events" USING btree ("stripe_event_id");
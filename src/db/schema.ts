import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// --- Enums ---

export const declineTypeEnum = pgEnum("decline_type", [
  "soft",
  "hard",
  "sca_required",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "in_dunning",
  "recovered",
  "hard_churn",
  "cancelled",
]);

export const jobTypeEnum = pgEnum("job_type", ["email", "retry"]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "executing",
  "done",
  "failed",
  "cancelled",
]);

export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "viewer"]);

export const orgPlanEnum = pgEnum("org_plan", [
  "starter",
  "growth",
  "percentage",
]);

// --- Tables ---

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    stripeWebhookSecret: text("stripe_webhook_secret"),
    stripeAccountId: text("stripe_account_id"),
    resendDomain: text("resend_domain"),
    plan: orgPlanEnum("plan").default("starter").notNull(),
    onboardingCompleted: boolean("onboarding_completed")
      .default(false)
      .notNull(),
    settings: jsonb("settings").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("slug_idx").on(table.slug)]
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id").notNull(),
    role: orgRoleEnum("role").default("owner").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("org_user_idx").on(table.organizationId, table.userId),
  ]
);

export const failedPayments = pgTable(
  "failed_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    stripeEventId: text("stripe_event_id").notNull(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeInvoiceId: text("stripe_invoice_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    customerEmail: text("customer_email").notNull(),
    customerName: text("customer_name"),
    amount: integer("amount").notNull(),
    currency: text("currency").default("usd").notNull(),
    failureReason: text("failure_reason"),
    declineType: declineTypeEnum("decline_type").notNull(),
    status: paymentStatusEnum("status").default("in_dunning").notNull(),
    dunningStep: integer("dunning_step").default(0).notNull(),
    recoveredAt: timestamp("recovered_at", { withTimezone: true }),
    recoveredAmount: integer("recovered_amount"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("stripe_event_idx").on(table.stripeEventId),
    index("org_status_idx").on(table.organizationId, table.status),
  ]
);

export const dunningJobs = pgTable(
  "dunning_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    failedPaymentId: uuid("failed_payment_id")
      .references(() => failedPayments.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    jobType: jobTypeEnum("job_type").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    status: jobStatusEnum("status").default("pending").notNull(),
    attemptNumber: integer("attempt_number").default(0).notNull(),
    result: jsonb("result").$type<{
      success: boolean;
      error?: string;
      emailId?: string;
    }>(),
    emailSubject: text("email_subject"),
    emailBodyPreview: text("email_body_preview"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("pending_jobs_idx").on(table.status, table.scheduledAt),
    index("job_org_idx").on(table.organizationId),
  ]
);

export const recoveryMetrics = pgTable(
  "recovery_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    period: date("period").notNull(),
    totalFailed: integer("total_failed").default(0).notNull(),
    totalRecovered: integer("total_recovered").default(0).notNull(),
    recoveryRate: numeric("recovery_rate", { precision: 5, scale: 2 }),
    mrrSaved: integer("mrr_saved").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("org_period_idx").on(table.organizationId, table.period),
  ]
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(
      () => organizations.id
    ),
    stripeEventId: text("stripe_event_id").notNull(),
    eventType: text("event_type").notNull(),
    processed: boolean("processed").default(false).notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("webhook_event_idx").on(table.stripeEventId)]
);

// --- Relations ---

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  failedPayments: many(failedPayments),
  dunningJobs: many(dunningJobs),
  recoveryMetrics: many(recoveryMetrics),
}));

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
  })
);

export const failedPaymentsRelations = relations(
  failedPayments,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [failedPayments.organizationId],
      references: [organizations.id],
    }),
    dunningJobs: many(dunningJobs),
  })
);

export const dunningJobsRelations = relations(dunningJobs, ({ one }) => ({
  failedPayment: one(failedPayments, {
    fields: [dunningJobs.failedPaymentId],
    references: [failedPayments.id],
  }),
  organization: one(organizations, {
    fields: [dunningJobs.organizationId],
    references: [organizations.id],
  }),
}));

export const recoveryMetricsRelations = relations(
  recoveryMetrics,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [recoveryMetrics.organizationId],
      references: [organizations.id],
    }),
  })
);

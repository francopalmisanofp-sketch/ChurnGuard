import type {
  organizations,
  organizationMembers,
  failedPayments,
  dunningJobs,
  recoveryMetrics,
  webhookEvents,
} from "@/db/schema";

// Inferred types from Drizzle schema
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;

export type FailedPayment = typeof failedPayments.$inferSelect;
export type NewFailedPayment = typeof failedPayments.$inferInsert;

export type DunningJob = typeof dunningJobs.$inferSelect;
export type NewDunningJob = typeof dunningJobs.$inferInsert;

export type RecoveryMetric = typeof recoveryMetrics.$inferSelect;
export type NewRecoveryMetric = typeof recoveryMetrics.$inferInsert;

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

// Decline types
export type DeclineType = "soft" | "hard" | "sca_required";

// Payment statuses
export type PaymentStatus =
  | "pending"
  | "in_dunning"
  | "recovered"
  | "hard_churn"
  | "cancelled";

// Job types
export type JobType = "email" | "retry";
export type JobStatus = "pending" | "executing" | "done" | "failed" | "cancelled";

// Org roles
export type OrgRole = "owner" | "admin" | "viewer";
export type OrgPlan = "starter" | "growth" | "percentage";

// Email generation context
export interface EmailGenerationContext {
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  companyName: string;
  attemptNumber: number;
  declineType: DeclineType;
  updatePaymentUrl: string;
}

// Generated email
export interface GeneratedEmail {
  subject: string;
  body: string;
}

// Dashboard KPIs
export interface DashboardKPIs {
  mrrRecovered: number;
  recoveryRate: number;
  annualValueSaved: number;
  totalFailed: number;
  totalRecovered: number;
  activeInDunning: number;
}

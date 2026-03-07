import type {
  organizations,
  organizationMembers,
  failedPayments,
  dunningJobs,
  recoveryMetrics,
  webhookEvents,
  paymentTokens,
  notifications,
  invitations,
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

export type PaymentToken = typeof paymentTokens.$inferSelect;
export type NewPaymentToken = typeof paymentTokens.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;

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

// Plan statuses
export type PlanStatus = "active" | "past_due" | "canceled" | "trialing";

// Notification types
export type NotificationType =
  | "job_failed"
  | "payment_recovered"
  | "plan_past_due"
  | "plan_expiring";

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

// MRR Trend
export interface MrrTrendPoint {
  period: string;
  mrrSaved: number;
  totalFailed: number;
  totalRecovered: number;
}

// Decline Breakdown
export interface DeclineBreakdownItem {
  declineType: string;
  count: number;
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

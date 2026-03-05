import { db } from "@/db";
import {
  dunningJobs,
  failedPayments,
  organizations,
  notifications,
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { generateDunningEmail } from "@/lib/email/generator";
import { sendEmail } from "@/lib/email/sender";
import { stripe } from "@/lib/stripe/client";
import type { EmailGenerationContext } from "@/types";

const GRACE_PERIOD_DAYS = 7;
const BACKOFF_HOURS = [1, 4, 24];
const MAX_RETRIES = 3;

/**
 * Check if an organization's plan is active enough to process dunning jobs.
 * Allows a 7-day grace period for past_due plans.
 */
function isOrgActive(org: typeof organizations.$inferSelect): boolean {
  if (org.planStatus === "active") return true;
  if (org.planStatus === "trialing") {
    return !org.planExpiresAt || new Date() < org.planExpiresAt;
  }
  if (org.planStatus === "past_due") {
    if (!org.planExpiresAt) return false;
    const graceEnd = new Date(org.planExpiresAt.getTime());
    graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
    return new Date() < graceEnd;
  }
  return false; // canceled
}

/**
 * Reschedule a job with exponential backoff, or mark as definitively failed.
 */
async function handleJobFailure(
  job: typeof dunningJobs.$inferSelect,
  payment: typeof failedPayments.$inferSelect,
  org: typeof organizations.$inferSelect,
  errorMsg: string,
  now: Date
): Promise<void> {
  if (job.retryCount < MAX_RETRIES) {
    const backoffMs = BACKOFF_HOURS[job.retryCount] * 60 * 60 * 1000;
    await db
      .update(dunningJobs)
      .set({
        status: "pending",
        retryCount: job.retryCount + 1,
        scheduledAt: new Date(Date.now() + backoffMs),
        result: { success: false, error: errorMsg },
      })
      .where(eq(dunningJobs.id, job.id));
  } else {
    // Definitive failure
    await db
      .update(dunningJobs)
      .set({
        status: "failed",
        executedAt: now,
        result: { success: false, error: errorMsg },
      })
      .where(eq(dunningJobs.id, job.id));
    await alertOnDefinitiveFailure(job, payment, org, errorMsg);
  }
}

/**
 * Create in-app notification and send internal alert email on definitive job failure.
 */
async function alertOnDefinitiveFailure(
  job: typeof dunningJobs.$inferSelect,
  payment: typeof failedPayments.$inferSelect,
  org: typeof organizations.$inferSelect,
  errorMsg: string
): Promise<void> {
  const amountStr = `$${(payment.amount / 100).toFixed(2)}`;

  // 1. In-app notification
  await db.insert(notifications).values({
    organizationId: org.id,
    type: "job_failed",
    title: "Dunning job failed permanently",
    body: `Job for ${payment.customerEmail} (${amountStr}) failed after ${MAX_RETRIES} retries: ${errorMsg}`,
    metadata: { jobId: job.id, paymentId: payment.id, error: errorMsg },
  });

  // 2. Internal alert email
  await sendEmail({
    to: "alerts@churnguard.com",
    from: "noreply@churnguard.com",
    subject: `[ChurnGuard Alert] Job failed: ${org.name}`,
    text: `Organization: ${org.name} (${org.slug})\nPayment: ${payment.customerEmail} - ${amountStr}\nJob type: ${job.jobType}\nError: ${errorMsg}\nRetries exhausted: ${MAX_RETRIES}`,
  });
}

/**
 * Process all pending dunning jobs that are scheduled for now or earlier.
 * Called by the hourly cron job.
 *
 * Uses FOR UPDATE SKIP LOCKED to prevent double processing by concurrent cron runs.
 * Skips orgs with expired/canceled plans.
 * Retries failed jobs with exponential backoff (1h, 4h, 24h).
 */
export async function processPendingJobs(): Promise<number> {
  const now = new Date();

  // Atomically acquire pending jobs — prevents double processing
  const acquiredRows = await db.execute<{ id: string }>(sql`
    UPDATE dunning_jobs SET status = 'executing'
    WHERE id IN (
      SELECT id FROM dunning_jobs
      WHERE status = 'pending' AND scheduled_at <= ${now}
      ORDER BY scheduled_at ASC
      LIMIT 100
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `);

  const acquiredIds = Array.from(acquiredRows).map((r) => r.id);
  if (acquiredIds.length === 0) return 0;

  // Fetch full data for acquired jobs
  const jobs = await db
    .select({
      job: dunningJobs,
      payment: failedPayments,
      org: organizations,
    })
    .from(dunningJobs)
    .innerJoin(failedPayments, eq(dunningJobs.failedPaymentId, failedPayments.id))
    .innerJoin(organizations, eq(dunningJobs.organizationId, organizations.id))
    .where(inArray(dunningJobs.id, acquiredIds));

  let processed = 0;

  for (const { job, payment, org } of jobs) {
    // Plan gate — cancel jobs for orgs with expired plans
    if (!isOrgActive(org)) {
      await db
        .update(dunningJobs)
        .set({ status: "cancelled", executedAt: now })
        .where(eq(dunningJobs.id, job.id));
      continue;
    }

    // Skip if payment is no longer in dunning
    if (payment.status !== "in_dunning") {
      await db
        .update(dunningJobs)
        .set({ status: "cancelled", executedAt: now })
        .where(eq(dunningJobs.id, job.id));
      continue;
    }

    try {
      if (job.jobType === "email") {
        await processEmailJob(job, payment, org);
      } else if (job.jobType === "retry") {
        await processRetryJob(job, payment, org);
      }
      processed++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      await handleJobFailure(job, payment, org, errorMsg, now);
    }
  }

  return processed;
}

async function processEmailJob(
  job: typeof dunningJobs.$inferSelect,
  payment: typeof failedPayments.$inferSelect,
  org: typeof organizations.$inferSelect
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.churnguard.com";
  const updatePaymentUrl = `${appUrl}/update-payment/${payment.id}`;

  const ctx: EmailGenerationContext = {
    customerName: payment.customerName ?? "",
    customerEmail: payment.customerEmail,
    amount: payment.amount,
    currency: payment.currency,
    companyName: org.name,
    attemptNumber: payment.dunningStep,
    declineType: payment.declineType,
    updatePaymentUrl,
  };

  // Generate personalized email
  const email = await generateDunningEmail(ctx);

  // Send email
  const fromAddress = org.resendDomain
    ? `noreply@${org.resendDomain}`
    : `noreply@churnguard.com`;

  const result = await sendEmail({
    to: payment.customerEmail,
    from: fromAddress,
    subject: email.subject,
    text: email.body,
  });

  const success = "id" in result;

  if (success) {
    // Mark job done + advance dunning step
    await db
      .update(dunningJobs)
      .set({
        status: "done",
        executedAt: new Date(),
        emailSubject: email.subject,
        emailBodyPreview: email.body.substring(0, 200),
        result: { success: true, emailId: result.id },
      })
      .where(eq(dunningJobs.id, job.id));

    await db
      .update(failedPayments)
      .set({
        dunningStep: sql`${failedPayments.dunningStep} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(failedPayments.id, payment.id));
  } else {
    // Email send failed — use retry backoff
    const errorMsg = "error" in result ? result.error : "Unknown email error";
    await handleJobFailure(job, payment, org, errorMsg, new Date());
  }
}

async function processRetryJob(
  job: typeof dunningJobs.$inferSelect,
  payment: typeof failedPayments.$inferSelect,
  org: typeof organizations.$inferSelect
): Promise<void> {
  try {
    // Attempt to pay the invoice via Stripe
    const invoice = await stripe.invoices.pay(payment.stripeInvoiceId);

    if (invoice.status === "paid") {
      // Payment recovered! Cancel remaining dunning jobs
      await db
        .update(dunningJobs)
        .set({ status: "cancelled", executedAt: new Date() })
        .where(
          and(
            eq(dunningJobs.failedPaymentId, payment.id),
            eq(dunningJobs.status, "pending")
          )
        );

      // Update failed payment status
      await db
        .update(failedPayments)
        .set({
          status: "recovered",
          recoveredAt: new Date(),
          recoveredAmount: payment.amount,
          updatedAt: new Date(),
        })
        .where(eq(failedPayments.id, payment.id));

      // Mark job as done
      await db
        .update(dunningJobs)
        .set({
          status: "done",
          executedAt: new Date(),
          result: { success: true },
        })
        .where(eq(dunningJobs.id, job.id));
    } else {
      // Still failing — mark done (not a job error, just invoice not paid)
      await db
        .update(dunningJobs)
        .set({
          status: "done",
          executedAt: new Date(),
          result: { success: false, error: `Invoice status: ${invoice.status}` },
        })
        .where(eq(dunningJobs.id, job.id));
    }
  } catch (error) {
    // Stripe API error — use retry backoff
    const errorMsg = error instanceof Error ? error.message : "Stripe retry failed";
    await handleJobFailure(job, payment, org, errorMsg, new Date());
  }
}

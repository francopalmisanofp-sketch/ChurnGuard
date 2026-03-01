import { db } from "@/db";
import {
  dunningJobs,
  failedPayments,
  organizations,
} from "@/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { generateDunningEmail } from "@/lib/email/generator";
import { sendEmail } from "@/lib/email/sender";
import { stripe } from "@/lib/stripe/client";
import type { EmailGenerationContext } from "@/types";

/**
 * Process all pending dunning jobs that are scheduled for now or earlier.
 * Called by the hourly cron job.
 * Returns the number of jobs processed.
 */
export async function processPendingJobs(): Promise<number> {
  const now = new Date();

  // Fetch pending jobs that are due
  const pendingJobs = await db
    .select({
      job: dunningJobs,
      payment: failedPayments,
      org: organizations,
    })
    .from(dunningJobs)
    .innerJoin(failedPayments, eq(dunningJobs.failedPaymentId, failedPayments.id))
    .innerJoin(organizations, eq(dunningJobs.organizationId, organizations.id))
    .where(
      and(
        eq(dunningJobs.status, "pending"),
        lte(dunningJobs.scheduledAt, now)
      )
    )
    .limit(100);

  let processed = 0;

  for (const { job, payment, org } of pendingJobs) {
    // Skip if payment is no longer in dunning
    if (payment.status !== "in_dunning") {
      await db
        .update(dunningJobs)
        .set({ status: "cancelled", executedAt: now })
        .where(eq(dunningJobs.id, job.id));
      continue;
    }

    // Mark as executing
    await db
      .update(dunningJobs)
      .set({ status: "executing" })
      .where(eq(dunningJobs.id, job.id));

    try {
      if (job.jobType === "email") {
        await processEmailJob(job.id, payment, org);
      } else if (job.jobType === "retry") {
        await processRetryJob(job.id, payment);
      }
      processed++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      await db
        .update(dunningJobs)
        .set({
          status: "failed",
          executedAt: now,
          result: { success: false, error: errorMsg },
        })
        .where(eq(dunningJobs.id, job.id));
    }
  }

  return processed;
}

async function processEmailJob(
  jobId: string,
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

  // Update job
  await db
    .update(dunningJobs)
    .set({
      status: success ? "done" : "failed",
      executedAt: new Date(),
      emailSubject: email.subject,
      emailBodyPreview: email.body.substring(0, 200),
      result: success
        ? { success: true, emailId: result.id }
        : { success: false, error: "error" in result ? result.error : "Unknown" },
    })
    .where(eq(dunningJobs.id, jobId));

  // Advance dunning step on the payment
  if (success) {
    await db
      .update(failedPayments)
      .set({
        dunningStep: sql`${failedPayments.dunningStep} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(failedPayments.id, payment.id));
  }
}

async function processRetryJob(
  jobId: string,
  payment: typeof failedPayments.$inferSelect
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
        .where(eq(dunningJobs.id, jobId));
    } else {
      // Still failing
      await db
        .update(dunningJobs)
        .set({
          status: "done",
          executedAt: new Date(),
          result: { success: false, error: `Invoice status: ${invoice.status}` },
        })
        .where(eq(dunningJobs.id, jobId));
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Stripe retry failed";
    await db
      .update(dunningJobs)
      .set({
        status: "failed",
        executedAt: new Date(),
        result: { success: false, error: errorMsg },
      })
      .where(eq(dunningJobs.id, jobId));
  }
}

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import {
  webhookEvents,
  failedPayments,
  dunningJobs,
  organizations,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { classifyDecline } from "@/lib/stripe/decline-classifier";
import { scheduleDunningJobs } from "@/lib/dunning/scheduler";
import { stripe } from "@/lib/stripe/client";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Get org slug from query param: /api/webhooks/stripe?org=my-saas
  const orgSlug = request.nextUrl.searchParams.get("org");
  if (!orgSlug) {
    return NextResponse.json(
      { error: "Missing org parameter" },
      { status: 400 }
    );
  }

  // Look up organization
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org || !org.stripeWebhookSecret) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  // Verify webhook signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      org.stripeWebhookSecret
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency check
  const [existing] = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(eq(webhookEvents.stripeEventId, event.id))
    .limit(1);

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Store event
  await db.insert(webhookEvents).values({
    organizationId: org.id,
    stripeEventId: event.id,
    eventType: event.type,
    processed: false,
    payload: event.data.object as unknown as Record<string, unknown>,
  });

  // Process event
  try {
    switch (event.type) {
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice, org.id);
        break;
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          org.id
        );
        break;
    }

    // Mark as processed
    await db
      .update(webhookEvents)
      .set({ processed: true })
      .where(eq(webhookEvents.stripeEventId, event.id));
  } catch (error) {
    // Log error but still return 200 to avoid Stripe retry storm
    console.error("Webhook processing error:", error);
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  organizationId: string
) {
  const declineType = classifyDecline(
    invoice.last_finalization_error?.code ?? null,
    invoice.last_finalization_error?.message ?? null
  );

  const [payment] = await db
    .insert(failedPayments)
    .values({
      organizationId,
      stripeEventId: `inv_fail_${invoice.id}_${Date.now()}`,
      stripeCustomerId:
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id ?? "",
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: (() => {
        const sub = invoice.parent?.subscription_details?.subscription;
        if (!sub) return null;
        return typeof sub === "string" ? sub : sub.id;
      })(),
      customerEmail: invoice.customer_email ?? "unknown@example.com",
      customerName: invoice.customer_name ?? null,
      amount: invoice.amount_due,
      currency: invoice.currency,
      failureReason: invoice.last_finalization_error?.message ?? null,
      declineType,
      status: "in_dunning",
    })
    .returning();

  // Schedule dunning jobs
  await scheduleDunningJobs(payment);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const invoiceId = invoice.id;

  // Find matching failed payment that's still in dunning
  const [payment] = await db
    .select()
    .from(failedPayments)
    .where(
      and(
        eq(failedPayments.stripeInvoiceId, invoiceId),
        eq(failedPayments.status, "in_dunning")
      )
    )
    .limit(1);

  if (!payment) return;

  // Cancel all pending dunning jobs
  await db
    .update(dunningJobs)
    .set({ status: "cancelled", executedAt: new Date() })
    .where(
      and(
        eq(dunningJobs.failedPaymentId, payment.id),
        eq(dunningJobs.status, "pending")
      )
    );

  // Mark payment as recovered
  await db
    .update(failedPayments)
    .set({
      status: "recovered",
      recoveredAt: new Date(),
      recoveredAmount: invoice.amount_paid,
      updatedAt: new Date(),
    })
    .where(eq(failedPayments.id, payment.id));
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  organizationId: string
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? "";

  // Find any in-dunning payments for this customer/org
  const payments = await db
    .select()
    .from(failedPayments)
    .where(
      and(
        eq(failedPayments.organizationId, organizationId),
        eq(failedPayments.stripeCustomerId, customerId),
        eq(failedPayments.status, "in_dunning")
      )
    );

  for (const payment of payments) {
    // Cancel pending jobs
    await db
      .update(dunningJobs)
      .set({ status: "cancelled", executedAt: new Date() })
      .where(
        and(
          eq(dunningJobs.failedPaymentId, payment.id),
          eq(dunningJobs.status, "pending")
        )
      );

    // Mark as hard churn
    await db
      .update(failedPayments)
      .set({ status: "hard_churn", updatedAt: new Date() })
      .where(eq(failedPayments.id, payment.id));
  }
}

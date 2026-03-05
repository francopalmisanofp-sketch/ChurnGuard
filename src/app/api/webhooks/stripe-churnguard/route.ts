import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { webhookEvents, organizations, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe/client";
import { getPlanFromPriceId } from "@/lib/stripe/churnguard-billing";

export const maxDuration = 30;

const STRIPE_STATUS_MAP: Record<string, "active" | "past_due" | "canceled" | "trialing"> = {
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "canceled",
  trialing: "trialing",
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_CHURNGUARD_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_CHURNGUARD_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
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

  // Store event (organizationId is null — resolved per-handler)
  await db.insert(webhookEvents).values({
    stripeEventId: event.id,
    eventType: event.type,
    processed: false,
    payload: event.data.object as unknown as Record<string, unknown>,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice
        );
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice
        );
        break;
    }

    await db
      .update(webhookEvents)
      .set({ processed: true })
      .where(eq(webhookEvents.stripeEventId, event.id));
  } catch (error) {
    console.error("ChurnGuard billing webhook error:", error);
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.org_id;
  if (!orgId) return;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (!customerId) return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subscriptionId) return;

  // Retrieve subscription to get period end and price
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id;
  const plan = priceId ? getPlanFromPriceId(priceId) : null;

  await db
    .update(organizations)
    .set({
      stripeCustomerIdChurnguard: customerId,
      stripeSubscriptionIdChurnguard: subscriptionId,
      plan: plan ?? "starter",
      planStatus: "active",
      planExpiresAt: firstItem
        ? new Date(firstItem.current_period_end * 1000)
        : null,
      onboardingCompleted: true,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.stripeSubscriptionIdChurnguard, subscriptionId))
    .limit(1);

  if (!org) return;

  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id;
  const plan = priceId ? getPlanFromPriceId(priceId) : null;
  const planStatus = STRIPE_STATUS_MAP[subscription.status] ?? "active";

  await db
    .update(organizations)
    .set({
      ...(plan && { plan }),
      planStatus,
      ...(firstItem && {
        planExpiresAt: new Date(firstItem.current_period_end * 1000),
      }),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, org.id));
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.stripeSubscriptionIdChurnguard, subscriptionId))
    .limit(1);

  if (!org) return;

  await db
    .update(organizations)
    .set({ planStatus: "canceled", updatedAt: new Date() })
    .where(eq(organizations.id, org.id));

  await db.insert(notifications).values({
    organizationId: org.id,
    type: "plan_expiring",
    title: "Subscription canceled",
    body: "Your ChurnGuard subscription has been canceled. Your plan will remain active until the current period ends.",
    metadata: { subscriptionId },
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.stripeCustomerIdChurnguard, customerId))
    .limit(1);

  if (!org) return;

  await db
    .update(organizations)
    .set({ planStatus: "past_due", updatedAt: new Date() })
    .where(eq(organizations.id, org.id));

  await db.insert(notifications).values({
    organizationId: org.id,
    type: "plan_past_due",
    title: "Payment failed",
    body: "Your ChurnGuard plan payment failed. Please update your payment method to avoid service interruption.",
    metadata: { invoiceId: invoice.id },
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.stripeCustomerIdChurnguard, customerId))
    .limit(1);

  if (!org) return;

  const periodEnd = invoice.lines?.data?.[0]?.period?.end;

  await db
    .update(organizations)
    .set({
      planStatus: "active",
      ...(periodEnd && { planExpiresAt: new Date(periodEnd * 1000) }),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, org.id));
}

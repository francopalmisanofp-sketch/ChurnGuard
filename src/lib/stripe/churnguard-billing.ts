import Stripe from "stripe";
import { stripe } from "./client";

const PRICE_IDS: Record<string, "starter" | "growth"> = {
  [process.env.STRIPE_STARTER_PRICE_ID!]: "starter",
  [process.env.STRIPE_GROWTH_PRICE_ID!]: "growth",
};

const PLAN_TO_PRICE: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID!,
  growth: process.env.STRIPE_GROWTH_PRICE_ID!,
};

export function getPlanFromPriceId(
  priceId: string
): "starter" | "growth" | null {
  return PRICE_IDS[priceId] ?? null;
}

export async function createCheckoutSession(
  orgId: string,
  plan: "starter" | "growth",
  returnUrl: string,
  stripeCustomerId?: string | null
) {
  const priceId = PLAN_TO_PRICE[plan];
  if (!priceId) throw new Error(`Unknown plan: ${plan}`);

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { org_id: orgId },
    success_url: `${returnUrl}?checkout=success`,
    cancel_url: `${returnUrl}?checkout=canceled`,
  };

  if (stripeCustomerId) {
    params.customer = stripeCustomerId;
  }

  const session = await stripe.checkout.sessions.create(params);
  return session.url;
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string
) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

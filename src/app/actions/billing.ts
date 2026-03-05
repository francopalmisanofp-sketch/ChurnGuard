"use server";

import { redirect } from "next/navigation";
import { getAuthAndOrg } from "@/lib/auth";
import {
  createCheckoutSession,
  createPortalSession,
} from "@/lib/stripe/churnguard-billing";

export async function startCheckout(plan: "starter" | "growth") {
  const { org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };
  if (org.role !== "owner") {
    return { error: "Only the organization owner can manage billing" };
  }

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`;

  const checkoutUrl = await createCheckoutSession(
    org.id,
    plan,
    returnUrl,
    org.stripeCustomerIdChurnguard
  );

  if (!checkoutUrl) {
    return { error: "Failed to create checkout session" };
  }

  redirect(checkoutUrl);
}

export async function openCustomerPortal() {
  const { org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };
  if (org.role !== "owner") {
    return { error: "Only the organization owner can manage billing" };
  }

  if (!org.stripeCustomerIdChurnguard) {
    return { error: "No active subscription found" };
  }

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`;

  const portalUrl = await createPortalSession(
    org.stripeCustomerIdChurnguard,
    returnUrl
  );

  if (!portalUrl) {
    return { error: "Failed to create portal session" };
  }

  redirect(portalUrl);
}

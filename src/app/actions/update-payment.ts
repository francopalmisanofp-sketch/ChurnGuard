"use server";

import { db } from "@/db";
import { failedPayments, dunningJobs, notifications } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  validatePaymentToken,
  invalidatePaymentToken,
} from "@/lib/tokens/payment-tokens";
import { stripe } from "@/lib/stripe/client";
import { z } from "zod/v4";
import Stripe from "stripe";

// --- Stripe error mapping ---

const DECLINE_MESSAGES: Record<string, string> = {
  card_declined: "Your card was declined. Please try a different card.",
  insufficient_funds: "Insufficient funds. Please try a different card.",
  expired_card: "Your card has expired. Please use a different card.",
  processing_error: "A processing error occurred. Please try again.",
  incorrect_cvc: "Incorrect CVC. Please check your card details.",
  authentication_required:
    "Additional authentication is required. Please try again.",
};

function getDeclineMessage(error: Stripe.errors.StripeError): {
  errorType: "card_declined" | "insufficient_funds" | "system_error";
  message: string;
} {
  const code = error.decline_code ?? error.code ?? "";

  if (code === "insufficient_funds") {
    return {
      errorType: "insufficient_funds",
      message: DECLINE_MESSAGES.insufficient_funds,
    };
  }

  if (code in DECLINE_MESSAGES) {
    return {
      errorType: "card_declined",
      message: DECLINE_MESSAGES[code],
    };
  }

  if (error instanceof Stripe.errors.StripeCardError) {
    return {
      errorType: "card_declined",
      message: DECLINE_MESSAGES.card_declined,
    };
  }

  return {
    errorType: "system_error",
    message: "An error occurred. Please try again later.",
  };
}

// --- Server Actions ---

/**
 * Get public payment details for the update-payment page.
 * No internal IDs or subscriber email exposed.
 */
export async function getPaymentDetails(token: string) {
  const result = await validatePaymentToken(token);
  if (!result) {
    return { success: false as const, error: "expired" as const };
  }

  const { failedPayment, organization } = result;
  return {
    success: true as const,
    data: {
      amount: failedPayment.amount,
      currency: failedPayment.currency,
      companyName: organization.name,
      logoUrl: organization.logoUrl,
      brandColor: organization.brandColor ?? "#000000",
    },
  };
}

/**
 * Create a Stripe SetupIntent for the subscriber to enter a new card.
 */
export async function createSetupIntent(token: string) {
  const result = await validatePaymentToken(token);
  if (!result) {
    return { error: "Token expired or invalid" };
  }

  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: result.failedPayment.stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session",
    });

    return { clientSecret: setupIntent.client_secret! };
  } catch {
    return { error: "Unable to initialize payment form" };
  }
}

const confirmSchema = z.object({
  token: z.string().uuid(),
  setupIntentId: z.string().min(1),
});

/**
 * Confirm the new payment method and retry the failed invoice.
 * On success: recovers payment, cancels pending jobs, invalidates token.
 * On card decline: token stays valid so subscriber can retry.
 */
export async function confirmAndRetryInvoice(
  token: string,
  setupIntentId: string
) {
  // Validate inputs
  const parsed = confirmSchema.safeParse({ token, setupIntentId });
  if (!parsed.success) {
    return {
      success: false as const,
      errorType: "system_error" as const,
      message: "Invalid request",
    };
  }

  // Validate token
  const result = await validatePaymentToken(parsed.data.token);
  if (!result) {
    return {
      success: false as const,
      errorType: "system_error" as const,
      message: "Token expired or invalid",
    };
  }

  const { failedPayment, organization } = result;

  try {
    // Retrieve the completed SetupIntent
    const setupIntent = await stripe.setupIntents.retrieve(
      parsed.data.setupIntentId
    );

    if (setupIntent.status !== "succeeded" || !setupIntent.payment_method) {
      return {
        success: false as const,
        errorType: "system_error" as const,
        message: "Payment method setup was not completed. Please try again.",
      };
    }

    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

    // Update the customer's default payment method
    await stripe.customers.update(failedPayment.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Retry the failed invoice
    const invoice = await stripe.invoices.pay(failedPayment.stripeInvoiceId);

    if (invoice.status === "paid") {
      // Cancel pending dunning jobs
      await db
        .update(dunningJobs)
        .set({ status: "cancelled", executedAt: new Date() })
        .where(
          and(
            eq(dunningJobs.failedPaymentId, failedPayment.id),
            eq(dunningJobs.status, "pending")
          )
        );

      // Mark payment as recovered
      await db
        .update(failedPayments)
        .set({
          status: "recovered",
          recoveredAt: new Date(),
          recoveredAmount: failedPayment.amount,
          updatedAt: new Date(),
        })
        .where(eq(failedPayments.id, failedPayment.id));

      // Invalidate token
      await invalidatePaymentToken(parsed.data.token);

      // Create recovery notification
      await db.insert(notifications).values({
        organizationId: organization.id,
        type: "payment_recovered",
        title: "Payment recovered",
        body: `${failedPayment.customerEmail} updated their payment method and recovered $${(failedPayment.amount / 100).toFixed(2)}.`,
        metadata: { paymentId: failedPayment.id },
      });

      return { success: true as const };
    }

    // Invoice not paid (unexpected status)
    return {
      success: false as const,
      errorType: "system_error" as const,
      message: "Payment could not be processed. Please try again later.",
    };
  } catch (error) {
    // Stripe card errors — token stays valid
    if (error instanceof Stripe.errors.StripeError) {
      return { success: false as const, ...getDeclineMessage(error) };
    }

    // System error — log server-side, don't expose internals
    console.error(
      "[confirmAndRetryInvoice] Unexpected error:",
      error instanceof Error ? error.message : "Unknown"
    );

    return {
      success: false as const,
      errorType: "system_error" as const,
      message: "An error occurred. Please try again later.",
    };
  }
}

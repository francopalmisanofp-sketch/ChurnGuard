import { db } from "@/db";
import { paymentTokens, failedPayments, organizations } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

const TOKEN_EXPIRY_DAYS = 30;

/**
 * Create an opaque token for the update-payment URL in dunning emails.
 * Each email job generates a distinct token (30-day expiry).
 */
export async function createPaymentToken(
  failedPaymentId: string,
  organizationId: string
): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

  await db.insert(paymentTokens).values({
    token,
    failedPaymentId,
    organizationId,
    expiresAt,
  });

  return token;
}

/**
 * Validate a payment token: must exist, not expired, not used.
 * Returns the associated failed payment and organization, or null.
 */
export async function validatePaymentToken(token: string) {
  const [row] = await db
    .select({
      failedPayment: failedPayments,
      organization: organizations,
    })
    .from(paymentTokens)
    .innerJoin(
      failedPayments,
      eq(paymentTokens.failedPaymentId, failedPayments.id)
    )
    .innerJoin(
      organizations,
      eq(paymentTokens.organizationId, organizations.id)
    )
    .where(
      and(
        eq(paymentTokens.token, token),
        gt(paymentTokens.expiresAt, new Date()),
        isNull(paymentTokens.usedAt)
      )
    )
    .limit(1);

  return row ?? null;
}

/**
 * Mark a token as used (sets usedAt). Call only after confirmed payment success.
 * The record is kept for audit — not deleted.
 */
export async function invalidatePaymentToken(token: string): Promise<void> {
  await db
    .update(paymentTokens)
    .set({ usedAt: new Date() })
    .where(eq(paymentTokens.token, token));
}

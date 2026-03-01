import type { DeclineType } from "@/types";

const HARD_DECLINE_CODES = new Set([
  "stolen_card",
  "lost_card",
  "card_not_supported",
  "invalid_account",
  "account_closed",
  "pickup_card",
  "restricted_card",
  "security_violation",
  "fraudulent",
  "invalid_number",
]);

const SCA_REQUIRED_CODES = new Set([
  "authentication_required",
  "card_declined_rate_limit_or_authentication_required",
]);

/**
 * Classify a Stripe decline code into soft, hard, or sca_required.
 * Soft declines are retryable (insufficient funds, temporary issues).
 * Hard declines require a new payment method.
 * SCA declines need customer authentication.
 */
export function classifyDecline(
  declineCode: string | null | undefined,
  failureMessage: string | null | undefined
): DeclineType {
  if (!declineCode) {
    // If no code, check failure message for auth keywords
    if (failureMessage?.toLowerCase().includes("authentication")) {
      return "sca_required";
    }
    return "soft"; // Default to soft (retryable)
  }

  if (SCA_REQUIRED_CODES.has(declineCode)) {
    return "sca_required";
  }

  if (HARD_DECLINE_CODES.has(declineCode)) {
    return "hard";
  }

  // Everything else (insufficient_funds, processing_error, etc.) is soft
  return "soft";
}

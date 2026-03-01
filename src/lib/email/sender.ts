import { Resend } from "resend";

interface SendEmailParams {
  to: string;
  from: string;
  subject: string;
  text: string;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Send an email via Resend with exponential backoff retry on transient errors (429, 5xx).
 * Permanent errors (400, invalid email) are not retried.
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<{ id: string } | { error: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { error: "RESEND_API_KEY not configured" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await resend.emails.send({
        from: params.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
      });

      if (error) {
        // Permanent client errors — don't retry
        if (error.message?.includes("validation") || error.name === "validation_error") {
          return { error: error.message };
        }

        // Transient — retry with backoff
        if (attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(4, attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        return { error: error.message };
      }

      return { id: data?.id ?? "unknown" };
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(4, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  return { error: "Max retries exceeded" };
}

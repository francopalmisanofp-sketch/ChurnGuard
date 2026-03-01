import Anthropic from "@anthropic-ai/sdk";
import type { EmailGenerationContext, GeneratedEmail } from "@/types";
import { getStaticTemplate } from "./templates";

const SYSTEM_PROMPT = `You are a payment recovery email specialist. Write a brief, empathetic dunning email for a SaaS subscription payment that failed.

Rules:
- Keep it under 150 words
- Use plain text (no HTML, no markdown formatting)
- Be empathetic and helpful, never blame the customer
- Include exactly ONE call-to-action: the payment update URL provided
- Use the customer's first name if available
- Mention the specific amount and company name
- Match the urgency level to the attempt number (0=friendly, 1=reminder, 2=urgent, 3=final warning)
- Output ONLY valid JSON with "subject" and "body" keys, nothing else`;

function buildUserPrompt(ctx: EmailGenerationContext): string {
  const urgencyLevel = ["friendly alert", "helpful reminder", "urgent notice", "final warning"][
    Math.min(ctx.attemptNumber, 3)
  ];

  return `Write a ${urgencyLevel} dunning email with these details:
- Customer name: ${ctx.customerName || "Customer"}
- Amount: $${(ctx.amount / 100).toFixed(2)} ${ctx.currency.toUpperCase()}
- Company name: ${ctx.companyName}
- Attempt number: ${ctx.attemptNumber} (of 4 total)
- Decline type: ${ctx.declineType}
- Payment update URL: ${ctx.updatePaymentUrl}

Return JSON: {"subject": "...", "body": "..."}`;
}

/**
 * Generate a personalized dunning email using Claude AI.
 * Falls back to static template if the API call fails.
 */
export async function generateDunningEmail(
  ctx: EmailGenerationContext
): Promise<GeneratedEmail> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return getStaticTemplate(ctx);
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(ctx) }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text) as GeneratedEmail;

    if (parsed.subject && parsed.body) {
      return parsed;
    }

    return getStaticTemplate(ctx);
  } catch {
    return getStaticTemplate(ctx);
  }
}

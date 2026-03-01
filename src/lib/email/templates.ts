import type { EmailGenerationContext, GeneratedEmail } from "@/types";

function formatAmount(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

/** Day 0 — Friendly alert */
function day0Template(ctx: EmailGenerationContext): GeneratedEmail {
  const amount = formatAmount(ctx.amount, ctx.currency);
  return {
    subject: `Your ${amount} payment didn't go through`,
    body: `Hi${ctx.customerName ? ` ${ctx.customerName}` : ""},

We noticed your recent payment of ${amount} didn't go through. This happens sometimes — no worries.

Please update your payment method so you don't lose access:

${ctx.updatePaymentUrl}

If you've already updated your card, you can ignore this email.

Thanks,
The ${ctx.companyName} team`,
  };
}

/** Day 3 — Helpful reminder */
function day3Template(ctx: EmailGenerationContext): GeneratedEmail {
  const amount = formatAmount(ctx.amount, ctx.currency);
  return {
    subject: `Quick reminder: update your payment method (${amount})`,
    body: `Hi${ctx.customerName ? ` ${ctx.customerName}` : ""},

Just a quick reminder — your payment of ${amount} still hasn't gone through. We'd hate for you to lose access to your account.

It only takes a moment to update your card:

${ctx.updatePaymentUrl}

If you're having trouble, just reply to this email and we'll help.

Best,
The ${ctx.companyName} team`,
  };
}

/** Day 7 — Urgency */
function day7Template(ctx: EmailGenerationContext): GeneratedEmail {
  const amount = formatAmount(ctx.amount, ctx.currency);
  return {
    subject: `Your ${ctx.companyName} access will be paused soon`,
    body: `Hi${ctx.customerName ? ` ${ctx.customerName}` : ""},

Your payment of ${amount} has been unsuccessful for the past week. Your account access will be paused in a few days if we can't process your payment.

Please update your payment method now:

${ctx.updatePaymentUrl}

We don't want to see you go — please take a moment to fix this.

The ${ctx.companyName} team`,
  };
}

/** Day 10 — Final warning */
function day10Template(ctx: EmailGenerationContext): GeneratedEmail {
  const amount = formatAmount(ctx.amount, ctx.currency);
  return {
    subject: `Final notice: your ${ctx.companyName} subscription`,
    body: `Hi${ctx.customerName ? ` ${ctx.customerName}` : ""},

This is a final reminder that your payment of ${amount} has not been processed. Your subscription will be cancelled tomorrow unless you update your payment method.

Update your card now to keep your account:

${ctx.updatePaymentUrl}

After cancellation, you may lose access to your data and settings. If you need help, reply to this email.

The ${ctx.companyName} team`,
  };
}

/** Hard decline — Request new card (single email) */
function hardDeclineTemplate(ctx: EmailGenerationContext): GeneratedEmail {
  const amount = formatAmount(ctx.amount, ctx.currency);
  return {
    subject: `Action needed: your payment card was declined`,
    body: `Hi${ctx.customerName ? ` ${ctx.customerName}` : ""},

Your payment of ${amount} was declined by your bank. This usually means the card can no longer be used for this subscription.

Please add a new payment method to continue your ${ctx.companyName} subscription:

${ctx.updatePaymentUrl}

If you believe this is an error, please contact your bank or reply to this email for help.

The ${ctx.companyName} team`,
  };
}

/** SCA required — Authentication needed */
function scaTemplate(ctx: EmailGenerationContext): GeneratedEmail {
  const amount = formatAmount(ctx.amount, ctx.currency);
  return {
    subject: `Authentication required for your ${amount} payment`,
    body: `Hi${ctx.customerName ? ` ${ctx.customerName}` : ""},

Your bank requires additional verification for your payment of ${amount}. Please complete the authentication to continue your ${ctx.companyName} subscription:

${ctx.updatePaymentUrl}

This is a one-time step required by your bank for security purposes.

The ${ctx.companyName} team`,
  };
}

/** Get the static fallback template for a given attempt and decline type. */
export function getStaticTemplate(
  ctx: EmailGenerationContext
): GeneratedEmail {
  if (ctx.declineType === "hard") {
    return hardDeclineTemplate(ctx);
  }
  if (ctx.declineType === "sca_required") {
    return scaTemplate(ctx);
  }

  // Soft decline — escalating sequence
  switch (ctx.attemptNumber) {
    case 0:
      return day0Template(ctx);
    case 1:
      return day3Template(ctx);
    case 2:
      return day7Template(ctx);
    case 3:
      return day10Template(ctx);
    default:
      return day10Template(ctx);
  }
}

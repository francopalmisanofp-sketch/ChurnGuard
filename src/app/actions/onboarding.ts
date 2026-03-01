"use server";

import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthAndOrg } from "@/lib/auth";
import { z } from "zod/v4";

const webhookSecretSchema = z.object({
  webhookSecret: z.string().startsWith("whsec_"),
});

const emailDomainSchema = z.object({
  domain: z
    .string()
    .min(3)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
});

export async function saveWebhookSecret(formData: FormData) {
  const { org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };

  const parsed = webhookSecretSchema.safeParse({
    webhookSecret: formData.get("webhookSecret"),
  });

  if (!parsed.success) {
    return { error: "Invalid webhook secret. It should start with whsec_" };
  }

  await db
    .update(organizations)
    .set({
      stripeWebhookSecret: parsed.data.webhookSecret,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, org.id));

  return { success: true };
}

export async function saveEmailDomain(formData: FormData) {
  const { org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };

  const parsed = emailDomainSchema.safeParse({
    domain: formData.get("domain"),
  });

  if (!parsed.success) {
    return { error: "Invalid domain format" };
  }

  await db
    .update(organizations)
    .set({
      resendDomain: parsed.data.domain,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, org.id));

  return { success: true };
}

export async function completeOnboarding() {
  const { org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };

  await db
    .update(organizations)
    .set({
      onboardingCompleted: true,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, org.id));

  return { success: true };
}

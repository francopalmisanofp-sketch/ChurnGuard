"use server";

import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthAndOrg } from "@/lib/auth";
import { z } from "zod/v4";

const settingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  resendDomain: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/)
    .optional()
    .or(z.literal("")),
});

export async function updateSettings(formData: FormData) {
  const { org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };
  if (org.role !== "owner" && org.role !== "admin") {
    return { error: "Insufficient permissions" };
  }

  const parsed = settingsSchema.safeParse({
    name: formData.get("name") || undefined,
    resendDomain: formData.get("resendDomain") || undefined,
  });

  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.resendDomain !== undefined) {
    updates.resendDomain = parsed.data.resendDomain || null;
  }

  await db
    .update(organizations)
    .set(updates)
    .where(eq(organizations.id, org.id));

  return { success: true };
}

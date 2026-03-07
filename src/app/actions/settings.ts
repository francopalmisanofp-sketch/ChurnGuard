"use server";

import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthAndOrg } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod/v4";

export async function getOrgSettings() {
  const { org } = await getAuthAndOrg();
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    resendDomain: org.resendDomain,
    logoUrl: org.logoUrl,
    brandColor: org.brandColor,
    plan: org.plan,
    planStatus: org.planStatus,
    planExpiresAt: org.planExpiresAt,
    stripeWebhookSecret: !!org.stripeWebhookSecret,
    stripeCustomerIdChurnguard: org.stripeCustomerIdChurnguard,
    role: org.role,
  };
}

export type OrgSettings = NonNullable<Awaited<ReturnType<typeof getOrgSettings>>>;

const settingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  resendDomain: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/)
    .optional()
    .or(z.literal("")),
});

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
] as const;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

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

/**
 * Upload organization logo to Supabase Storage.
 * Accepts PNG, JPG, SVG up to 2MB. Owner/Admin only.
 */
export async function uploadLogo(formData: FormData) {
  const { org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };
  if (org.role !== "owner" && org.role !== "admin") {
    return { error: "Insufficient permissions" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file provided" };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return { error: "Unsupported format. Use PNG, JPG, or SVG." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: "File too large. Maximum 2MB." };
  }

  const ext = MIME_TO_EXT[file.type] ?? "png";
  const path = `${org.id}/${Date.now()}-logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return { error: "Upload failed. Please try again." };
  }

  const { data: urlData } = supabase.storage
    .from("logos")
    .getPublicUrl(path);

  await db
    .update(organizations)
    .set({ logoUrl: urlData.publicUrl, updatedAt: new Date() })
    .where(eq(organizations.id, org.id));

  return { success: true, logoUrl: urlData.publicUrl };
}

/**
 * Update organization brand color. Must be a 6-digit hex color.
 * Owner/Admin only.
 */
export async function updateBrandColor(color: string) {
  const { org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };
  if (org.role !== "owner" && org.role !== "admin") {
    return { error: "Insufficient permissions" };
  }

  if (!HEX_COLOR_REGEX.test(color)) {
    return { error: "Invalid color. Use hex format (e.g. #FF5733)." };
  }

  await db
    .update(organizations)
    .set({ brandColor: color, updatedAt: new Date() })
    .where(eq(organizations.id, org.id));

  return { success: true };
}

/**
 * Remove organization logo and reset to default (company name).
 * Owner/Admin only.
 */
export async function removeLogo() {
  const { org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };
  if (org.role !== "owner" && org.role !== "admin") {
    return { error: "Insufficient permissions" };
  }

  // Delete file from Storage if a logo exists
  if (org.logoUrl) {
    try {
      const url = new URL(org.logoUrl);
      // Storage URL path: /storage/v1/object/public/logos/<org-id>/<filename>
      const storagePath = url.pathname.split("/logos/")[1];
      if (storagePath) {
        const supabase = createAdminClient();
        await supabase.storage.from("logos").remove([storagePath]);
      }
    } catch {
      // If URL parsing fails, still clear the DB field
    }
  }

  await db
    .update(organizations)
    .set({ logoUrl: null, updatedAt: new Date() })
    .where(eq(organizations.id, org.id));

  return { success: true };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { organizations, organizationMembers } from "@/db/schema";
import { redirect } from "next/navigation";
import { z } from "zod/v4";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  orgName: z.string().min(2).max(100),
});

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Invalid email or password format" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    orgName: formData.get("orgName"),
  });

  if (!parsed.success) {
    return { error: "Invalid input. Check all fields." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Failed to create account" };
  }

  // Create organization
  const slug = parsed.data.orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const [org] = await db
    .insert(organizations)
    .values({
      name: parsed.data.orgName,
      slug: `${slug}-${Date.now().toString(36)}`,
      planExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })
    .returning();

  // Add user as owner
  await db.insert(organizationMembers).values({
    organizationId: org.id,
    userId: data.user.id,
    role: "owner",
  });

  redirect("/dashboard/onboarding");
}

export async function signInWithMagicLink(formData: FormData) {
  const email = formData.get("email");
  if (!email || typeof email !== "string" || !z.email().safeParse(email).success) {
    return { error: "Invalid email" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Check your email for a login link" };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

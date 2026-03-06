"use server";

import { db } from "@/db";
import { invitations, organizationMembers } from "@/db/schema";
import { getAuthAndOrg } from "@/lib/auth";
import { sendEmail } from "@/lib/email/sender";
import { createAdminClient } from "@/lib/supabase/admin";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod/v4";

const emailSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "viewer"]),
});

// --- Helpers ---

function requireOwner(role: string) {
  if (role !== "owner") {
    throw new Error("Only the organization owner can perform this action");
  }
}

function requireOwnerOrAdmin(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new Error("Insufficient permissions");
  }
}

// --- Actions ---

export async function inviteMember(email: string, role: "admin" | "viewer") {
  const { user, org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };
  requireOwner(org.role);

  const parsed = emailSchema.safeParse({ email, role });
  if (!parsed.success) return { error: "Invalid email or role" };

  // Check if email is already a member
  const admin = createAdminClient();
  const { data: userList } = await admin.auth.admin.listUsers();
  const existingUser = userList?.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (existingUser) {
    const existing = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, org.id),
          eq(organizationMembers.userId, existingUser.id)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      return { error: "This user is already a member of the organization" };
    }
  }

  // Check for pending invitation
  const pending = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, org.id),
        eq(invitations.email, email.toLowerCase()),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date())
      )
    )
    .limit(1);
  if (pending.length > 0) {
    return { error: "A pending invitation already exists for this email" };
  }

  // Create invitation
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(invitations).values({
    organizationId: org.id,
    email: email.toLowerCase(),
    role,
    token,
    expiresAt,
  });

  // Send invitation email
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const acceptUrl = `${baseUrl}/accept-invitation?token=${token}`;

  await sendEmail({
    to: email,
    from: org.resendDomain
      ? `ChurnGuard <noreply@${org.resendDomain}>`
      : `ChurnGuard <noreply@churnguard.com>`,
    subject: `You've been invited to join ${org.name} on ChurnGuard`,
    text: `Hi,\n\nYou've been invited to join ${org.name} on ChurnGuard as ${role === "admin" ? "an admin" : "a viewer"}.\n\nClick the link below to accept the invitation:\n${acceptUrl}\n\nThis invitation expires in 7 days.\n\nBest,\nChurnGuard`,
  });

  return { success: true };
}

export async function revokeMember(memberId: string) {
  const { user, org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };
  requireOwner(org.role);

  // Find the member
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.id, memberId))
    .limit(1);

  if (!member || member.organizationId !== org.id) {
    return { error: "Member not found" };
  }

  if (member.userId === user.id) {
    return { error: "You cannot remove yourself from the organization" };
  }

  await db
    .delete(organizationMembers)
    .where(eq(organizationMembers.id, memberId));

  return { success: true };
}

export async function changeRole(
  memberId: string,
  newRole: "admin" | "viewer"
) {
  const { user, org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };
  requireOwner(org.role);

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.id, memberId))
    .limit(1);

  if (!member || member.organizationId !== org.id) {
    return { error: "Member not found" };
  }

  if (member.userId === user.id) {
    return { error: "You cannot change your own role" };
  }

  await db
    .update(organizationMembers)
    .set({ role: newRole })
    .where(eq(organizationMembers.id, memberId));

  return { success: true };
}

export async function getMembers() {
  const { user, org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };
  requireOwnerOrAdmin(org.role);

  const members = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, org.id));

  const admin = createAdminClient();
  const membersWithEmail = await Promise.all(
    members.map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.userId);
      return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        email: data.user?.email ?? "unknown",
        createdAt: m.createdAt,
      };
    })
  );

  return { data: membersWithEmail };
}

export async function cancelInvitation(invitationId: string) {
  const { user, org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };
  requireOwner(org.role);

  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.id, invitationId))
    .limit(1);

  if (!invitation || invitation.organizationId !== org.id) {
    return { error: "Invitation not found" };
  }

  await db.delete(invitations).where(eq(invitations.id, invitationId));

  return { success: true };
}

export async function getPendingInvitations() {
  const { user, org } = await getAuthAndOrg();
  if (!org) return { error: "Organization not found" };
  requireOwnerOrAdmin(org.role);

  const pending = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, org.id),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date())
      )
    );

  return { data: pending };
}

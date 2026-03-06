import { db } from "@/db";
import { invitations, organizationMembers } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
  }

  // Find valid invitation
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.token, token),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!invitation) {
    return NextResponse.redirect(
      new URL("/login?error=invitation_expired", request.url)
    );
  }

  // Check if user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(`/accept-invitation?token=${token}`);
    return NextResponse.redirect(
      new URL(`/login?next=${next}`, request.url)
    );
  }

  // Verify email matches
  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.redirect(
      new URL("/login?error=invitation_email_mismatch", request.url)
    );
  }

  // Check not already a member
  const existing = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, invitation.organizationId),
        eq(organizationMembers.userId, user.id)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Already a member — just mark invitation accepted and redirect
    await db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id));
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Add as member
  await db.insert(organizationMembers).values({
    organizationId: invitation.organizationId,
    userId: user.id,
    role: invitation.role,
  });

  // Mark invitation as accepted
  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  return NextResponse.redirect(new URL("/", request.url));
}

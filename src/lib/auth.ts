import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { organizationMembers, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

/** Get authenticated user or redirect to login. */
export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/** Get the organization for the authenticated user. */
export async function getOrganization(userId: string) {
  const members = await db
    .select({
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);

  if (members.length === 0) return null;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, members[0].organizationId))
    .limit(1);

  return org ? { ...org, role: members[0].role } : null;
}

/** Get auth + org in one call. Redirects if not authenticated. */
export async function getAuthAndOrg() {
  const user = await requireAuth();
  const org = await getOrganization(user.id);
  return { user, org };
}

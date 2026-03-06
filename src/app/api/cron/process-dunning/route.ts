import { NextRequest, NextResponse } from "next/server";
import { processPendingJobs } from "@/lib/dunning/processor";
import { refreshMetrics } from "@/lib/metrics/refresh";
import { db } from "@/db";
import { organizations, notifications } from "@/db/schema";
import { and, eq, inArray, lte } from "drizzle-orm";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel Cron sends this header)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Sweep expired trials → past_due
    const expiredTrials = await db
      .update(organizations)
      .set({ planStatus: "past_due", updatedAt: new Date() })
      .where(
        and(
          eq(organizations.planStatus, "trialing"),
          lte(organizations.planExpiresAt, new Date())
        )
      )
      .returning({ id: organizations.id });

    for (const org of expiredTrials) {
      await db.insert(notifications).values({
        organizationId: org.id,
        type: "plan_expiring",
        title: "Trial expired",
        body: "Your 14-day trial has ended. Subscribe to a plan to continue using ChurnGuard.",
        metadata: {},
      });
    }

    // Process pending dunning jobs
    const processed = await processPendingJobs();

    // Refresh metrics only for orgs with active plans
    const allOrgs = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        inArray(organizations.planStatus, ["active", "trialing", "past_due"])
      );

    for (const org of allOrgs) {
      await refreshMetrics(org.id);
    }

    return NextResponse.json({
      success: true,
      expiredTrials: expiredTrials.length,
      jobsProcessed: processed,
      orgsRefreshed: allOrgs.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

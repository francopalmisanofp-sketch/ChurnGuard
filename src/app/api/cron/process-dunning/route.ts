import { NextRequest, NextResponse } from "next/server";
import { processPendingJobs } from "@/lib/dunning/processor";
import { refreshMetrics } from "@/lib/metrics/refresh";
import { db } from "@/db";
import { organizations } from "@/db/schema";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel Cron sends this header)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Process pending dunning jobs
    const processed = await processPendingJobs();

    // Refresh metrics for all active organizations
    const allOrgs = await db
      .select({ id: organizations.id })
      .from(organizations);

    for (const org of allOrgs) {
      await refreshMetrics(org.id);
    }

    return NextResponse.json({
      success: true,
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

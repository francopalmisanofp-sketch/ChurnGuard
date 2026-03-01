import { db } from "@/db";
import { failedPayments, recoveryMetrics } from "@/db/schema";
import { eq, and, sql, gte, lt } from "drizzle-orm";

/**
 * Refresh recovery metrics for a given organization for the current month.
 * Aggregates from failed_payments table and upserts into recovery_metrics.
 */
export async function refreshMetrics(organizationId: string): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const periodStr = periodStart.toISOString().split("T")[0];

  const [stats] = await db
    .select({
      totalFailed: sql<number>`count(*)::int`,
      totalRecovered: sql<number>`count(*) filter (where ${failedPayments.status} = 'recovered')::int`,
      mrrSaved: sql<number>`coalesce(sum(${failedPayments.recoveredAmount}) filter (where ${failedPayments.status} = 'recovered'), 0)::int`,
    })
    .from(failedPayments)
    .where(
      and(
        eq(failedPayments.organizationId, organizationId),
        gte(failedPayments.createdAt, periodStart),
        lt(failedPayments.createdAt, periodEnd)
      )
    );

  const totalFailed = stats?.totalFailed ?? 0;
  const totalRecovered = stats?.totalRecovered ?? 0;
  const mrrSaved = stats?.mrrSaved ?? 0;
  const recoveryRate =
    totalFailed > 0
      ? Number(((totalRecovered / totalFailed) * 100).toFixed(2))
      : 0;

  // Upsert metrics
  await db
    .insert(recoveryMetrics)
    .values({
      organizationId,
      period: periodStr,
      totalFailed,
      totalRecovered,
      recoveryRate: String(recoveryRate),
      mrrSaved,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [recoveryMetrics.organizationId, recoveryMetrics.period],
      set: {
        totalFailed,
        totalRecovered,
        recoveryRate: String(recoveryRate),
        mrrSaved,
        updatedAt: new Date(),
      },
    });
}

"use server";

import { db } from "@/db";
import { failedPayments, dunningJobs, recoveryMetrics } from "@/db/schema";
import { eq, and, desc, sql, gte, lt } from "drizzle-orm";
import { getAuthAndOrg } from "@/lib/auth";
import type { DashboardKPIs, PaymentStatus, MrrTrendPoint, DeclineBreakdownItem } from "@/types";

export async function getPayments(
  status?: PaymentStatus,
  page: number = 1,
  pageSize: number = 20
) {
  const { org } = await getAuthAndOrg();
  if (!org) return { payments: [], total: 0 };

  const conditions = [eq(failedPayments.organizationId, org.id)];
  if (status) {
    conditions.push(eq(failedPayments.status, status));
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(failedPayments)
    .where(and(...conditions));

  const payments = await db
    .select()
    .from(failedPayments)
    .where(and(...conditions))
    .orderBy(desc(failedPayments.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    payments,
    total: countResult?.count ?? 0,
  };
}

export async function getPaymentDetail(paymentId: string) {
  const { org } = await getAuthAndOrg();
  if (!org) return null;

  const [payment] = await db
    .select()
    .from(failedPayments)
    .where(
      and(
        eq(failedPayments.id, paymentId),
        eq(failedPayments.organizationId, org.id)
      )
    )
    .limit(1);

  if (!payment) return null;

  const jobs = await db
    .select()
    .from(dunningJobs)
    .where(eq(dunningJobs.failedPaymentId, paymentId))
    .orderBy(dunningJobs.scheduledAt);

  return { payment, jobs };
}

export async function getMrrTrend(months: number = 6): Promise<MrrTrendPoint[]> {
  const { org } = await getAuthAndOrg();
  if (!org) return [];

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const rows = await db
    .select({
      period: recoveryMetrics.period,
      mrrSaved: recoveryMetrics.mrrSaved,
      totalFailed: recoveryMetrics.totalFailed,
      totalRecovered: recoveryMetrics.totalRecovered,
    })
    .from(recoveryMetrics)
    .where(
      and(
        eq(recoveryMetrics.organizationId, org.id),
        gte(recoveryMetrics.period, startDate.toISOString().slice(0, 10))
      )
    )
    .orderBy(recoveryMetrics.period);

  return rows.map((r) => ({
    period: typeof r.period === "string" ? r.period : r.period,
    mrrSaved: r.mrrSaved,
    totalFailed: r.totalFailed,
    totalRecovered: r.totalRecovered,
  }));
}

export async function getDeclineBreakdown(): Promise<DeclineBreakdownItem[]> {
  const { org } = await getAuthAndOrg();
  if (!org) return [];

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const rows = await db
    .select({
      declineType: failedPayments.declineType,
      count: sql<number>`count(*)::int`,
    })
    .from(failedPayments)
    .where(
      and(
        eq(failedPayments.organizationId, org.id),
        gte(failedPayments.createdAt, periodStart),
        lt(failedPayments.createdAt, periodEnd)
      )
    )
    .groupBy(failedPayments.declineType);

  return rows.map((r) => ({
    declineType: r.declineType,
    count: r.count,
  }));
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const { org } = await getAuthAndOrg();
  if (!org) {
    return {
      mrrRecovered: 0,
      recoveryRate: 0,
      annualValueSaved: 0,
      totalFailed: 0,
      totalRecovered: 0,
      activeInDunning: 0,
    };
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [stats] = await db
    .select({
      totalFailed: sql<number>`count(*)::int`,
      totalRecovered: sql<number>`count(*) filter (where ${failedPayments.status} = 'recovered')::int`,
      activeInDunning: sql<number>`count(*) filter (where ${failedPayments.status} = 'in_dunning')::int`,
      mrrRecovered: sql<number>`coalesce(sum(${failedPayments.recoveredAmount}) filter (where ${failedPayments.status} = 'recovered'), 0)::int`,
    })
    .from(failedPayments)
    .where(
      and(
        eq(failedPayments.organizationId, org.id),
        gte(failedPayments.createdAt, periodStart),
        lt(failedPayments.createdAt, periodEnd)
      )
    );

  const totalFailed = stats?.totalFailed ?? 0;
  const totalRecovered = stats?.totalRecovered ?? 0;
  const mrrRecovered = stats?.mrrRecovered ?? 0;
  const recoveryRate =
    totalFailed > 0
      ? Number(((totalRecovered / totalFailed) * 100).toFixed(1))
      : 0;

  return {
    mrrRecovered,
    recoveryRate,
    annualValueSaved: mrrRecovered * 12,
    totalFailed,
    totalRecovered,
    activeInDunning: stats?.activeInDunning ?? 0,
  };
}

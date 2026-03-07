"use server";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getAuthAndOrg } from "@/lib/auth";
import type { NotificationItem } from "@/types";

export async function getNotifications(
  limit: number = 20
): Promise<NotificationItem[]> {
  const { org } = await getAuthAndOrg();
  if (!org) return [];

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.organizationId, org.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    read: r.read,
    metadata: r.metadata ?? {},
    createdAt: r.createdAt,
  }));
}

export async function getUnreadCount(): Promise<number> {
  const { org } = await getAuthAndOrg();
  if (!org) return 0;

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, org.id),
        eq(notifications.read, false)
      )
    );

  return result.count;
}

export async function markAsRead(notificationId: string): Promise<void> {
  const { org } = await getAuthAndOrg();
  if (!org) return;

  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.organizationId, org.id)
      )
    );
}

export async function markAllAsRead(): Promise<void> {
  const { org } = await getAuthAndOrg();
  if (!org) return;

  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.organizationId, org.id),
        eq(notifications.read, false)
      )
    );
}

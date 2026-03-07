"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from "@/app/actions/notifications";
import type { NotificationItem } from "@/types";

export function useNotifications(orgId: string, initialUnreadCount: number) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const panelOpenRef = useRef(false);

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          setUnreadCount((c) => c + 1);
          if (panelOpenRef.current && payload.new) {
            const row = payload.new as Record<string, unknown>;
            const item: NotificationItem = {
              id: row.id as string,
              type: row.type as NotificationItem["type"],
              title: row.title as string,
              body: row.body as string,
              read: false,
              metadata: (row.metadata as Record<string, unknown>) ?? {},
              createdAt: new Date(row.created_at as string),
            };
            setNotifications((prev) => [item, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  const fetchNotifications = useCallback(async () => {
    const data = await getNotifications();
    setNotifications(data);
    setLoaded(true);
  }, []);

  const handleMarkAsRead = useCallback(async (id: string) => {
    await markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const setPanelOpen = useCallback((open: boolean) => {
    panelOpenRef.current = open;
  }, []);

  return {
    unreadCount,
    notifications,
    loaded,
    fetchNotifications,
    handleMarkAsRead,
    handleMarkAllAsRead,
    setPanelOpen,
  };
}

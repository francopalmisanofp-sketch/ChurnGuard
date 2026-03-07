"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { startCheckout, openCustomerPortal } from "@/app/actions/billing";
import type { OrgSettings } from "@/app/actions/settings";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  percentage: "Percentage",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-600",
  trialing: "bg-blue-600",
  past_due: "bg-amber-600",
  canceled: "bg-red-600",
};

export function BillingTab({ settings }: { settings: OrgSettings }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isOwner = settings.role === "owner";

  const trialDaysLeft = settings.planStatus === "trialing" && settings.planExpiresAt
    ? Math.max(0, Math.ceil((new Date(settings.planExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  async function handlePortal() {
    setError(null);
    setLoading(true);
    try {
      const result = await openCustomerPortal();
      if (result?.error) setError(result.error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout(plan: "starter" | "growth") {
    setError(null);
    setLoading(true);
    try {
      const result = await startCheckout(plan);
      if (result?.error) setError(result.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Your ChurnGuard subscription plan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {PLAN_LABELS[settings.plan] ?? settings.plan}
          </Badge>
          <Badge className={STATUS_STYLES[settings.planStatus] ?? ""}>
            {settings.planStatus}
          </Badge>
        </div>

        {trialDaysLeft !== null && (
          <p className="text-sm text-muted-foreground">
            {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining in trial
          </p>
        )}

        {settings.planExpiresAt && settings.planStatus !== "trialing" && (
          <p className="text-sm text-muted-foreground">
            Expires: {new Date(settings.planExpiresAt).toLocaleDateString()}
          </p>
        )}

        {isOwner && settings.stripeCustomerIdChurnguard && (
          <Button onClick={handlePortal} disabled={loading}>
            {loading ? "Loading..." : "Manage Subscription"}
          </Button>
        )}

        {isOwner && !settings.stripeCustomerIdChurnguard && (
          <div className="flex gap-2">
            <Button
              onClick={() => handleCheckout("starter")}
              disabled={loading}
              variant="outline"
            >
              Upgrade to Starter
            </Button>
            <Button
              onClick={() => handleCheckout("growth")}
              disabled={loading}
            >
              Upgrade to Growth
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

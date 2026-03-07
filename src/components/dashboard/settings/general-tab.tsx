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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { updateSettings } from "@/app/actions/settings";
import type { OrgSettings } from "@/app/actions/settings";

export function GeneralTab({ settings }: { settings: OrgSettings }) {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canEdit = settings.role === "owner" || settings.role === "admin";

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const result = await updateSettings(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          Settings saved successfully.
        </div>
      )}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Update your organization details</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={settings.name}
                placeholder="Your Company"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resendDomain">Email Sending Domain</Label>
              <Input
                id="resendDomain"
                name="resendDomain"
                defaultValue={settings.resendDomain ?? ""}
                placeholder="mail.yoursaas.com"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Organization Slug</Label>
              <Input value={settings.slug} disabled />
              <p className="text-xs text-muted-foreground">
                Used in your webhook URL. Cannot be changed.
              </p>
            </div>
            {canEdit && (
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stripe Integration</CardTitle>
          <CardDescription>
            Your Stripe webhook connection status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {settings.stripeWebhookSecret ? (
              <>
                <Badge className="bg-green-600">Connected</Badge>
                <span className="text-sm text-muted-foreground">
                  Webhook secret configured
                </span>
              </>
            ) : (
              <>
                <Badge variant="secondary">Not configured</Badge>
                <span className="text-sm text-muted-foreground">
                  Set up your Stripe webhook in onboarding
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

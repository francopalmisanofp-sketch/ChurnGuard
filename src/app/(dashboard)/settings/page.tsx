"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { updateSettings } from "@/app/actions/settings";

export default function SettingsPage() {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    const result = await updateSettings(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization settings
        </p>
      </div>

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
          <CardDescription>
            Update your organization details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input id="name" name="name" placeholder="Your Company" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resendDomain">Email Sending Domain</Label>
              <Input
                id="resendDomain"
                name="resendDomain"
                placeholder="mail.yoursaas.com"
              />
            </div>
            <Button type="submit">Save Changes</Button>
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
            <Badge variant="secondary">Connected</Badge>
            <span className="text-sm text-muted-foreground">
              Webhook secret configured. To change it, contact support.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>
            Your ChurnGuard subscription plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge>Starter</Badge>
            <span className="text-sm text-muted-foreground">$49/month</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

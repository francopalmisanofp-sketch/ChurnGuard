"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveWebhookSecret, saveEmailDomain, completeOnboarding, skipToPlan } from "@/app/actions/onboarding";
import { startCheckout } from "@/app/actions/billing";

const STEPS = [
  { title: "Connect Stripe", description: "Enter your Stripe webhook secret" },
  { title: "Configure Email", description: "Set up your email sending domain" },
  { title: "Choose Plan", description: "Select your ChurnGuard plan" },
  { title: "Go Live", description: "Review and activate your dunning engine" },
];

const PLAN_STEP = 2;

export function OnboardingWizard({
  orgSlug,
  initialStep,
}: {
  orgSlug: string;
  initialStep?: string;
}) {
  const startStep = initialStep === "plan" ? PLAN_STEP : 0;
  const [step, setStep] = useState(startStep);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const isPlanOnly = initialStep === "plan";

  async function handleStep1(formData: FormData) {
    setSaving(true);
    setError(null);
    const result = await saveWebhookSecret(formData);
    setSaving(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setStep(1);
    }
  }

  async function handleStep2(formData: FormData) {
    setSaving(true);
    setError(null);
    const result = await saveEmailDomain(formData);
    setSaving(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setStep(PLAN_STEP);
    }
  }

  async function handleSelectPlan(plan: "starter" | "growth") {
    setSaving(true);
    setError(null);
    const result = await startCheckout(plan);
    setSaving(false);
    // startCheckout redirects on success; if we get here, there was an error
    if (result?.error) {
      setError(result.error);
    }
  }

  async function handleSkipPlan() {
    setSaving(true);
    setError(null);
    const result = await skipToPlan();
    setSaving(false);
    if (result?.error) {
      setError(result.error);
    } else {
      if (isPlanOnly) {
        router.push("/");
      } else {
        setStep(3);
      }
    }
  }

  async function handleGoLive() {
    setSaving(true);
    setError(null);
    const result = await completeOnboarding();
    setSaving(false);
    if (result?.error) {
      setError(result.error);
    } else {
      router.push("/");
    }
  }

  // Visible steps depend on mode
  const visibleSteps = isPlanOnly ? [STEPS[PLAN_STEP]] : STEPS;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Step indicator */}
      {!isPlanOnly && (
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  i <= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-px w-12 ${
                    i < step ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step 1: Connect Stripe */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[0].title}</CardTitle>
            <CardDescription>{STEPS[0].description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleStep1} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhookSecret">Stripe Webhook Secret</Label>
                <Input
                  id="webhookSecret"
                  name="webhookSecret"
                  type="password"
                  placeholder="whsec_..."
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your Stripe Dashboard → Developers → Webhooks.
                  Set the endpoint URL to:
                </p>
                <code className="block rounded bg-muted p-2 text-xs">
                  {process.env.NEXT_PUBLIC_APP_URL ?? "https://app.churnguard.com"}/api/webhooks/stripe?org={orgSlug}
                </code>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save & Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Configure Email */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[1].title}</CardTitle>
            <CardDescription>{STEPS[1].description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleStep2} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Email Sending Domain</Label>
                <Input
                  id="domain"
                  name="domain"
                  placeholder="mail.yoursaas.com"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This is the domain your dunning emails will be sent from.
                  You&apos;ll need to verify this domain in Resend.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(0)}
                >
                  Back
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save & Continue"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Choose Plan */}
      {step === PLAN_STEP && (
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[PLAN_STEP].title}</CardTitle>
            <CardDescription>{STEPS[PLAN_STEP].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSelectPlan("starter")}
                className="rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <div className="font-medium">Starter</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Up to 500 failed payments/month. Perfect for getting started.
                </p>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSelectPlan("growth")}
                className="rounded-lg border border-primary p-4 text-left transition-colors hover:bg-primary/5"
              >
                <div className="font-medium">Growth</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Unlimited failed payments. For scaling businesses.
                </p>
              </button>
            </div>
            <div className="flex items-center gap-2">
              {!isPlanOnly && (
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={handleSkipPlan}
                disabled={saving}
              >
                {saving ? "Skipping..." : "Continue with free trial"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Go Live */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[3].title}</CardTitle>
            <CardDescription>{STEPS[3].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <p>Your ChurnGuard setup is ready. Here&apos;s what will happen:</p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                <li>Failed payments will be detected automatically via Stripe webhooks</li>
                <li>AI-personalized recovery emails will be sent on Day 0, 3, 7, and 10</li>
                <li>Payment retries will be attempted on Day 3</li>
                <li>Your dashboard will show real-time recovery metrics</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(PLAN_STEP)}>
                Back
              </Button>
              <Button onClick={handleGoLive} disabled={saving}>
                {saving ? "Activating..." : "Activate ChurnGuard"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

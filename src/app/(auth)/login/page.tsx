"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { login, signInWithMagicLink } from "@/app/actions/auth";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handleLogin(formData: FormData) {
    setError(null);
    const result = await login(formData);
    if (result?.error) setError(result.error);
  }

  async function handleMagicLink(formData: FormData) {
    setError(null);
    const result = await signInWithMagicLink(formData);
    if (result?.error) setError(result.error);
    if (result?.success) setMagicLinkSent(true);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Sign in to ChurnGuard</CardTitle>
        <CardDescription>
          Enter your email and password to access your dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {magicLinkSent && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
            Check your email for a login link!
          </div>
        )}
        <form action={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full">
            Sign In
          </Button>
        </form>

        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            or
          </span>
        </div>

        <form action={handleMagicLink}>
          <input type="hidden" name="email" id="magic-email" />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            onClick={(e) => {
              const emailInput = document.getElementById("email") as HTMLInputElement;
              const hiddenInput = document.getElementById("magic-email") as HTMLInputElement;
              if (emailInput && hiddenInput) {
                hiddenInput.value = emailInput.value;
              }
            }}
          >
            Send Magic Link
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

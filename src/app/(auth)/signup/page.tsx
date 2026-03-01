"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup } from "@/app/actions/auth";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(formData: FormData) {
    setError(null);
    const result = await signup(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create your ChurnGuard account</CardTitle>
        <CardDescription>
          Start recovering failed payments in 5 minutes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <form action={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Company Name</Label>
            <Input
              id="orgName"
              name="orgName"
              placeholder="Acme Inc."
              required
              minLength={2}
            />
          </div>
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
            Create Account
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

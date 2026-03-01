import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">ChurnGuard</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Recover failed subscription payments on autopilot.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-powered dunning emails that recover 20-30% of failed payments.
        </p>
      </div>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/signup">Get Started</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/login">Sign In</Link>
        </Button>
      </div>
    </div>
  );
}

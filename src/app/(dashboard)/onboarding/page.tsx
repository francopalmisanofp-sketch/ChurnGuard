import { OnboardingWizard } from "@/components/onboarding/wizard-steps";
import { requireAuth, getOrganization } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Setup" };

export default async function OnboardingPage() {
  const user = await requireAuth();
  const org = await getOrganization(user.id);

  if (!org) {
    // User has no org — shouldn't happen normally, redirect to signup
    redirect("/signup");
  }

  if (org.onboardingCompleted) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Welcome to ChurnGuard</h1>
          <p className="mt-1 text-muted-foreground">
            Let&apos;s set up your payment recovery in 3 easy steps
          </p>
        </div>
        <OnboardingWizard orgSlug={org.slug} />
      </div>
    </div>
  );
}

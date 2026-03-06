import { OnboardingWizard } from "@/components/onboarding/wizard-steps";
import { requireAuth, getOrganization } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Setup" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const user = await requireAuth();
  const org = await getOrganization(user.id);
  const { step } = await searchParams;

  if (!org) {
    redirect("/signup");
  }

  // Allow access with ?step=plan even if onboarding is completed
  // (user was redirected here because plan was canceled)
  if (org.onboardingCompleted && step !== "plan") {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Welcome to ChurnGuard</h1>
          <p className="mt-1 text-muted-foreground">
            {step === "plan"
              ? "Choose a plan to continue using ChurnGuard"
              : "Let\u0027s set up your payment recovery in 3 easy steps"}
          </p>
        </div>
        <OnboardingWizard orgSlug={org.slug} initialStep={step} />
      </div>
    </div>
  );
}

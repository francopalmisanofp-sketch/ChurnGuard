import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { getAuthAndOrg } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUnreadCount } from "@/app/actions/notifications";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, org } = await getAuthAndOrg();

  if (!org) {
    redirect("/onboarding");
  }

  // Plan gate: canceled orgs must re-subscribe
  if (org.planStatus === "canceled") {
    redirect("/onboarding?step=plan");
  }

  // Onboarding gate: incomplete onboarding
  if (!org.onboardingCompleted) {
    redirect("/onboarding");
  }

  const unreadCount = await getUnreadCount();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header orgName={org.name} userEmail={user.email ?? ""} orgId={org.id} initialUnreadCount={unreadCount} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getOrgSettings } from "@/app/actions/settings";
import { getMembers, getPendingInvitations } from "@/app/actions/team";
import { SettingsTabs } from "@/components/dashboard/settings/settings-tabs";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getOrgSettings();
  if (!settings) redirect("/onboarding");

  const [membersResult, invitationsResult] = await Promise.all([
    settings.role !== "viewer" ? getMembers() : { data: [] },
    settings.role !== "viewer" ? getPendingInvitations() : { data: [] },
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization settings
        </p>
      </div>
      <SettingsTabs
        settings={settings}
        members={membersResult.data ?? []}
        invitations={invitationsResult.data ?? []}
      />
    </div>
  );
}

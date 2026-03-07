"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralTab } from "./general-tab";
import { BrandingTab } from "./branding-tab";
import { BillingTab } from "./billing-tab";
import { TeamTab } from "./team-tab";
import type { OrgSettings } from "@/app/actions/settings";

interface Member {
  id: string;
  userId: string;
  role: string;
  email: string;
  createdAt: Date | string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: Date | string;
}

export function SettingsTabs({
  settings,
  members,
  invitations,
}: {
  settings: OrgSettings;
  members: Member[];
  invitations: PendingInvitation[];
}) {
  const showTeam = settings.role !== "viewer";

  return (
    <Tabs defaultValue="general">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="branding">Branding</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
        {showTeam && <TabsTrigger value="team">Team</TabsTrigger>}
      </TabsList>
      <TabsContent value="general">
        <GeneralTab settings={settings} />
      </TabsContent>
      <TabsContent value="branding">
        <BrandingTab settings={settings} />
      </TabsContent>
      <TabsContent value="billing">
        <BillingTab settings={settings} />
      </TabsContent>
      {showTeam && (
        <TabsContent value="team">
          <TeamTab
            settings={settings}
            initialMembers={members}
            initialInvitations={invitations}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}

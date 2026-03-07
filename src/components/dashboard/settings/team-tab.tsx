"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  inviteMember,
  revokeMember,
  changeRole,
  cancelInvitation,
} from "@/app/actions/team";
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

export function TeamTab({
  settings,
  initialMembers,
  initialInvitations,
}: {
  settings: OrgSettings;
  initialMembers: Member[];
  initialInvitations: PendingInvitation[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [pendingInvitations, setPendingInvitations] = useState(initialInvitations);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "viewer">("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isOwner = settings.role === "owner";

  async function handleInvite() {
    if (!inviteEmail) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const result = await inviteMember(inviteEmail, inviteRole);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        setPendingInvitations((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            email: inviteEmail.toLowerCase(),
            role: inviteRole,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(memberId: string) {
    if (!confirm("Remove this member from the organization?")) return;
    setError(null);
    const result = await revokeMember(memberId);
    if (result.error) {
      setError(result.error);
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
  }

  async function handleChangeRole(memberId: string, newRole: "admin" | "viewer") {
    setError(null);
    const result = await changeRole(memberId, newRole);
    if (result.error) {
      setError(result.error);
    } else {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    setError(null);
    const result = await cancelInvitation(invitationId);
    if (result.error) {
      setError(result.error);
    } else {
      setPendingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    }
  }

  const ROLE_COLORS: Record<string, string> = {
    owner: "bg-purple-600",
    admin: "bg-blue-600",
    viewer: "",
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>People in your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {isOwner && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge
                      className={ROLE_COLORS[member.role] ?? ""}
                      variant={member.role === "viewer" ? "secondary" : "default"}
                    >
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </TableCell>
                  {isOwner && (
                    <TableCell>
                      {member.role !== "owner" && (
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(e) =>
                              handleChangeRole(
                                member.id,
                                e.target.value as "admin" | "viewer"
                              )
                            }
                            className="h-8 rounded-md border bg-background px-2 text-sm"
                          >
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRevoke(member.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Invite Member</CardTitle>
            <CardDescription>
              Send an invitation to join your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <label htmlFor="inviteEmail" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="inviteRole" className="text-sm font-medium">
                  Role
                </label>
                <select
                  id="inviteRole"
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as "admin" | "viewer")
                  }
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <Button onClick={handleInvite} disabled={loading || !inviteEmail}>
                {loading ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  {isOwner && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{inv.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </TableCell>
                    {isOwner && (
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCancelInvitation(inv.id)}
                        >
                          Cancel
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Settings,
  Mail,
  Trash2,
  Crown,
  Shield,
  Eye,
  UserPlus,
  Copy,
  Check,
  Loader2,
  ArrowLeft,
  Github,
  Key,
  Link,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  userRole: string;
  owner: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
  members: Array<{
    id: string;
    role: string;
    joinedAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      image?: string;
    };
  }>;
  _count: {
    members: number;
    workspaces: number;
    deployments: number;
    agents: number;
    presets: number;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  createdAt: string;
  inviter: {
    name: string;
    email: string;
  };
}

export default function TeamSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Edit team
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  
  // Integrations
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState("");
  const [openrouterConfigured, setOpenrouterConfigured] = useState(false);
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [connectingGithub, setConnectingGithub] = useState(false);
  const [savingOpenrouter, setSavingOpenrouter] = useState(false);
  
  // Invite member
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    fetchTeam();
    fetchInvitations();
    fetchIntegrations();
  }, [teamId]);

  const fetchTeam = async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
        setTeamName(data.name);
        setTeamDescription(data.description || "");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Failed to fetch team:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/invite`);
      if (res.ok) {
        const data = await res.json();
        setInvitations(data);
      }
    } catch (error) {
      console.error("Failed to fetch invitations:", error);
    }
  };

  const fetchIntegrations = async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/integrations`);
      if (res.ok) {
        const data = await res.json();
        setGithubConnected(data.githubConnected);
        setGithubUsername(data.githubUsername || "");
        setOpenrouterConfigured(data.openrouterConfigured);
      }
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
    }
  };

  const handleConnectGithub = async () => {
    setConnectingGithub(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/github`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchIntegrations();
        toast.success("GitHub connected successfully!");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to connect GitHub");
      }
    } catch (error) {
      console.error("Error connecting GitHub:", error);
      toast.error("Failed to connect GitHub");
    } finally {
      setConnectingGithub(false);
    }
  };

  const handleDisconnectGithub = async () => {
    if (!confirm("Disconnect GitHub from this team?")) return;

    try {
      const res = await fetch(`/api/teams/${teamId}/github`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchIntegrations();
        toast.success("GitHub disconnected");
      }
    } catch (error) {
      console.error("Error disconnecting GitHub:", error);
      toast.error("Failed to disconnect GitHub");
    }
  };

  const handleSaveOpenrouterKey = async () => {
    setSavingOpenrouter(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/integrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openrouterApiKey: openrouterKey,
        }),
      });

      if (res.ok) {
        await fetchIntegrations();
        setOpenrouterKey("");
        toast.success("OpenRouter API key saved!");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save API key");
      }
    } catch (error) {
      console.error("Error saving OpenRouter key:", error);
      toast.error("Failed to save API key");
    } finally {
      setSavingOpenrouter(false);
    }
  };

  const handleUpdateTeam = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName,
          description: teamDescription,
        }),
      });

      if (res.ok) {
        await fetchTeam();
        toast.success("Team updated successfully!");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update team");
      }
    } catch (error) {
      console.error("Error updating team:", error);
      toast.error("Failed to update team");
    } finally {
      setSaving(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      if (res.ok) {
        await fetchInvitations();
        setInviteDialogOpen(false);
        setInviteEmail("");
        setInviteRole("MEMBER");
        toast.success("Invitation sent successfully!", {
          description: `Invite sent to ${inviteEmail}`,
        });
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to send invitation");
      }
    } catch (error) {
      console.error("Error sending invitation:", error);
      toast.error("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        await fetchTeam();
        toast.success("Member removed from team");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to remove member");
      }
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member");
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (res.ok) {
        await fetchTeam();
        toast.success("Member role updated");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update role");
      }
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/teams/invite/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    toast.success("Invite link copied to clipboard");
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRemoveInvitation = async (invitationId: string) => {
    if (!confirm("Are you sure you want to cancel this invitation?")) return;

    try {
      const res = await fetch(`/api/teams/${teamId}/invite?invitationId=${invitationId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchInvitations();
        toast.success("Invitation cancelled");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to cancel invitation");
      }
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      toast.error("Failed to cancel invitation");
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "OWNER":
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case "ADMIN":
        return <Shield className="h-4 w-4 text-blue-500" />;
      case "MEMBER":
        return <Users className="h-4 w-4 text-emerald-500" />;
      case "VIEWER":
        return <Eye className="h-4 w-4 text-zinc-500" />;
      default:
        return null;
    }
  };

  const canManageMembers = team?.userRole === "OWNER" || team?.userRole === "ADMIN";

  if (loading) {
    return (
      <div className="flex h-screen bg-zinc-950">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        {/* Hero Header */}
        <div className="relative border-b border-zinc-800/50 bg-gradient-to-br from-zinc-900/50 via-zinc-950 to-black">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-emerald-500/5" />
          <div className="container mx-auto px-6 py-8 max-w-6xl relative">
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard")}
              className="mb-4 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-5">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10">
                  <Users className="h-10 w-10 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-zinc-100 mb-2">{team.name}</h1>
                  <p className="text-zinc-400 text-lg">{team.description || "No description"}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400">
                      {team.userRole}
                    </Badge>
                    <span className="text-sm text-zinc-600">@{team.slug}</span>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">{team._count.members}</div>
                  <div className="text-xs text-zinc-500 mt-1">Members</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-emerald-400">{team._count.workspaces}</div>
                  <div className="text-xs text-zinc-500 mt-1">Workspaces</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">{team._count.deployments}</div>
                  <div className="text-xs text-zinc-500 mt-1">Deployments</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 py-8 max-w-6xl">

          {/* Integrations */}
          {canManageMembers && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-zinc-100 mb-4 flex items-center gap-2">
                <Key className="h-6 w-6 text-emerald-400" />
                Integrations
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                {/* GitHub Card */}
                <Card className="bg-zinc-900/50 border-zinc-800/50 p-6 hover:border-zinc-700/50 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                      <Github className="h-5 w-5 text-zinc-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-100">GitHub</h3>
                      <p className="text-xs text-zinc-500">Source control integration</p>
                    </div>
                  </div>
                  
                  {githubConnected ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <div className="flex items-center gap-2 mb-1">
                          <Check className="h-4 w-4 text-emerald-400" />
                          <span className="text-sm text-emerald-400 font-medium">Connected</span>
                        </div>
                        <p className="text-sm text-zinc-300 font-mono">@{githubUsername}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDisconnectGithub}
                        className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                      >
                        <Unlink className="h-3.5 w-3.5 mr-2" />
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-zinc-500">
                        Connect your GitHub account to enable team repositories
                      </p>
                      <Button
                        onClick={handleConnectGithub}
                        disabled={connectingGithub}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                      >
                        {connectingGithub ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Link className="h-4 w-4 mr-2" />
                            Connect GitHub
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </Card>

                {/* OpenRouter Card */}
                <Card className="bg-zinc-900/50 border-zinc-800/50 p-6 hover:border-zinc-700/50 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                      <Key className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-100">OpenRouter</h3>
                      <p className="text-xs text-zinc-500">AI model API key</p>
                    </div>
                  </div>
                  
                  {openrouterConfigured ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <div className="flex items-center gap-2 mb-1">
                          <Check className="h-4 w-4 text-emerald-400" />
                          <span className="text-sm text-emerald-400 font-medium">Configured</span>
                        </div>
                        <p className="text-xs text-zinc-400">API key is encrypted and active</p>
                      </div>
                      <Button
                        onClick={() => setOpenrouterConfigured(false)}
                        variant="outline"
                        size="sm"
                        className="w-full border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                      >
                        Update Key
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-zinc-500">
                        Set API key for team AI agents
                      </p>
                      <Input
                        type="password"
                        value={openrouterKey}
                        onChange={(e) => setOpenrouterKey(e.target.value)}
                        placeholder="sk-or-v1-..."
                        className="bg-zinc-950 border-zinc-700 focus:border-emerald-500/50"
                      />
                      <Button
                        onClick={handleSaveOpenrouterKey}
                        disabled={!openrouterKey.trim() || savingOpenrouter}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
                      >
                        {savingOpenrouter ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save API Key"
                        )}
                      </Button>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* Team Settings & Members */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-zinc-100 mb-4 flex items-center gap-2">
              <Settings className="h-6 w-6 text-blue-400" />
              General Settings
            </h2>
            
            <Card className="bg-zinc-900/50 border-zinc-800/50 p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-zinc-300 text-sm font-medium">Team Name</Label>
                    <Input
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      disabled={!canManageMembers}
                      className="mt-2 bg-zinc-950 border-zinc-700 focus:border-blue-500/50"
                    />
                  </div>

                  <div>
                    <Label className="text-zinc-300 text-sm font-medium">Description</Label>
                    <Input
                      value={teamDescription}
                      onChange={(e) => setTeamDescription(e.target.value)}
                      disabled={!canManageMembers}
                      placeholder="What's your team working on?"
                      className="mt-2 bg-zinc-950 border-zinc-700 focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-zinc-300 text-sm font-medium">Team Slug</Label>
                    <Input
                      value={team.slug}
                      disabled
                      className="mt-2 bg-zinc-950 border-zinc-700 text-zinc-500"
                    />
                    <p className="text-xs text-zinc-600 mt-1.5">
                      Used in URLs and cannot be changed
                    </p>
                  </div>

                  {canManageMembers && (
                    <Button
                      onClick={handleUpdateTeam}
                      disabled={saving}
                      className="w-full bg-blue-500 hover:bg-blue-400 text-white mt-4"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Members Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
                <Users className="h-6 w-6 text-emerald-400" />
                Team Members
                <Badge variant="outline" className="border-zinc-700 text-zinc-400 ml-2">
                  {team.members.length}
                </Badge>
              </h2>
              {canManageMembers && (
                <Button
                  onClick={() => setInviteDialogOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              )}
            </div>

            <Card className="bg-zinc-900/50 border-zinc-800/50 p-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {team.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-4 rounded-lg bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors"
                  >
                    {member.user.image ? (
                      <img
                        src={member.user.image}
                        alt={member.user.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-emerald-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium text-zinc-200 truncate">
                          {member.user.name}
                        </div>
                        {getRoleIcon(member.role)}
                      </div>
                      <div className="text-xs text-zinc-500 truncate mb-2">
                        {member.user.email}
                      </div>
                      <div className="flex items-center gap-2">
                        {canManageMembers && member.role !== "OWNER" ? (
                          <>
                            <Select
                              value={member.role}
                              onValueChange={(value) =>
                                handleUpdateRole(member.user.id, value)
                              }
                            >
                              <SelectTrigger className="h-7 text-xs bg-zinc-900 border-zinc-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-zinc-800">
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="MEMBER">Member</SelectItem>
                                <SelectItem value="VIEWER">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member.user.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-zinc-700 text-zinc-400 text-xs"
                          >
                            {member.role}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Pending Invitations */}
          {canManageMembers && invitations.length > 0 && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-zinc-100 mb-4 flex items-center gap-2">
                <Mail className="h-6 w-6 text-purple-400" />
                Pending Invitations
                <Badge variant="outline" className="border-zinc-700 text-zinc-400 ml-2">
                  {invitations.length}
                </Badge>
              </h2>

              <Card className="bg-zinc-900/50 border-zinc-800/50 p-6">
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-zinc-200 mb-1">
                          {invitation.email}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Invited by {invitation.inviter.name} · Role: {invitation.role}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyInviteLink(invitation.token)}
                          className="border-zinc-700 hover:bg-zinc-800"
                        >
                          {copiedToken === invitation.token ? (
                            <>
                              <Check className="h-4 w-4 mr-2 text-emerald-500" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Link
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveInvitation(invitation.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Send an invitation to join {team.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-zinc-300">Email Address</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="mt-1.5 bg-zinc-950 border-zinc-800"
              />
            </div>

            <div>
              <Label className="text-zinc-300">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="mt-1.5 bg-zinc-950 border-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="ADMIN">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-500" />
                      Admin - Can manage members and resources
                    </div>
                  </SelectItem>
                  <SelectItem value="MEMBER">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-500" />
                      Member - Can create and edit resources
                    </div>
                  </SelectItem>
                  <SelectItem value="VIEWER">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-zinc-500" />
                      Viewer - Read-only access
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
              className="border-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInviteMember}
              disabled={!inviteEmail.trim() || inviting}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
            >
              {inviting ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

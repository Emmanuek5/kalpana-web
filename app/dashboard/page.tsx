"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Play,
  Square,
  Trash2,
  Settings,
  Github,
  Clock,
  Cpu,
  Terminal,
  Plus,
  Loader2,
  AlertCircle,
  Sparkles,
  Zap,
  Code2,
  Rocket,
  Coins,
  TrendingUp,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { NotificationBell } from "@/components/workspace/notification-bell";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeam } from "@/lib/team-context";
import { toast } from "sonner";

interface Workspace {
  id: string;
  name: string;
  description?: string;
  status: "STOPPED" | "STARTING" | "RUNNING" | "STOPPING" | "ERROR";
  githubRepo?: string;
  template?: string;
  lastAccessedAt: string;
  vscodePort?: number;
  agentPort?: number;
  teamId?: string;
}

interface Deployment {
  id: string;
  name: string;
  status: "STOPPED" | "BUILDING" | "DEPLOYING" | "RUNNING" | "STOPPING" | "ERROR";
}

export default function DashboardPage() {
  const router = useRouter();
  const { currentTeam } = useTeam();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDeployments, setLoadingDeployments] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null
  );
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteVolume, setDeleteVolume] = useState(false);
  const [credits, setCredits] = useState<{
    remaining: number;
    totalUsage: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchSession();
    fetchWorkspaces();
    fetchDeployments();
    fetchCredits();
  }, [currentTeam]);

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/get-session");
      if (res.ok) {
        const data = await res.json();
        setSession(data);
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const url = currentTeam
        ? `/api/workspaces?teamId=${currentTeam.id}`
        : "/api/workspaces";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeployments = async () => {
    try {
      const url = currentTeam
        ? `/api/deployments?teamId=${currentTeam.id}`
        : "/api/deployments";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDeployments(data.deployments);
      }
    } catch (error) {
      console.error("Failed to fetch deployments:", error);
    } finally {
      setLoadingDeployments(false);
    }
  };

  const fetchCredits = async () => {
    try {
      const res = await fetch("/api/openrouter/credits");
      if (res.ok) {
        const data = await res.json();
        setCredits(data);
      }
    } catch (error) {
      console.error("Failed to fetch credits:", error);
    } finally {
      setLoadingCredits(false);
    }
  };

  const handleOpenSettings = (workspace: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWorkspace(workspace);
    setEditedName(workspace.name);
    setEditedDescription(workspace.description || "");
    setSettingsModalOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!selectedWorkspace) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${selectedWorkspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedName,
          description: editedDescription,
        }),
      });

      if (res.ok) {
        await fetchWorkspaces();
        setSettingsModalOpen(false);
        toast.success("Workspace updated successfully!");
      } else {
        toast.error("Failed to update workspace");
      }
    } catch (error) {
      console.error("Error updating workspace:", error);
      toast.error("Failed to update workspace");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (workspace: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWorkspace(workspace);
    setDeleteVolume(false); // Reset checkbox
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedWorkspace) return;

    setDeleting(true);
    try {
      const url = `/api/workspaces/${selectedWorkspace.id}${
        deleteVolume ? "?deleteVolume=true" : ""
      }`;
      const res = await fetch(url, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchWorkspaces();
        setDeleteModalOpen(false);
        toast.success("Workspace deleted");
      } else {
        toast.error("Failed to delete workspace");
      }
    } catch (error) {
      console.error("Error deleting workspace:", error);
      toast.error("Failed to delete workspace");
    } finally {
      setDeleting(false);
    }
  };

  const refreshWorkspace = async (id: string) => {
    try {
      const res = await fetch(`/api/workspaces/${id}`);
      if (res.ok) {
        const data = await res.json();
        setWorkspaces((prev) => prev.map((w) => (w.id === id ? data : w)));
      }
    } catch (_e) {}
  };

  const handleStartStop = async (workspace: Workspace) => {
    const id = workspace.id;

    if (workspace.status === "RUNNING") {
      // Optimistic STOPPING state
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === id ? { ...w, status: "STOPPING" } : w))
      );

      try {
        const res = await fetch(`/api/workspaces/${id}/stop`, {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json();
          const updated = data?.workspace;
          if (updated) {
            setWorkspaces((prev) =>
              prev.map((w) => (w.id === id ? updated : w))
            );
          } else {
            await refreshWorkspace(id);
          }
        } else {
          // Revert on failure
          await refreshWorkspace(id);
          toast.error("Failed to stop workspace");
        }
      } catch (e) {
        await refreshWorkspace(id);
        toast.error("Failed to stop workspace");
      }
      return;
    }

    // Start workspace
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: "STARTING" } : w))
    );

    try {
      const res = await fetch(`/api/workspaces/${id}/start`, {
        method: "POST",
      });

      // The start endpoint streams SSE via text/event-stream
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;

        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || ""; // keep partial
            for (const chunk of lines) {
              const line = chunk.split("\n").find((l) => l.startsWith("data:"));
              if (!line) continue;
              const json = line.replace(/^data:\s*/, "");
              try {
                const evt = JSON.parse(json);
                if (evt?.type === "complete") {
                  setWorkspaces((prev) =>
                    prev.map((w) =>
                      w.id === id ? { ...w, status: "RUNNING" } : w
                    )
                  );
                } else if (evt?.type === "error") {
                  setWorkspaces((prev) =>
                    prev.map((w) =>
                      w.id === id ? { ...w, status: "ERROR" } : w
                    )
                  );
                }
              } catch (_e) {}
            }
          }
        }
        // Final refresh to sync ports/status
        await refreshWorkspace(id);
        toast.success("Workspace started!");
      } else {
        await refreshWorkspace(id);
        if (!res.ok) toast.error("Failed to start workspace");
      }
    } catch (e) {
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === id ? { ...w, status: "ERROR" } : w))
      );
      toast.error("Failed to start workspace");
    }
  };



  const statusConfig = {
    STOPPED: {
      color: "bg-zinc-800/80 text-zinc-400 border-zinc-700/50",
      icon: null,
      glow: "",
    },
    STARTING: {
      color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      glow: "shadow-lg shadow-amber-500/20",
    },
    RUNNING: {
      color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      icon: (
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
      ),
      glow: "shadow-lg shadow-emerald-500/30",
    },
    STOPPING: {
      color: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      glow: "shadow-lg shadow-orange-500/20",
    },
    ERROR: {
      color: "bg-red-500/20 text-red-300 border-red-500/30",
      icon: <AlertCircle className="h-3 w-3" />,
      glow: "shadow-lg shadow-red-500/20",
    },
  };

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden relative">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none" />

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Minimal Top Bar */}
        <div className="border-b border-zinc-800/50 flex items-center justify-between px-6 py-4 bg-zinc-950/50 backdrop-blur-sm relative z-50">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-medium text-zinc-100">Workspaces</h1>
            <Badge
              variant="outline"
              className="bg-zinc-900/50 border-zinc-800 text-zinc-400 text-xs"
            >
              {workspaces.length}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
              onClick={() => router.push("/dashboard/new")}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Workspace
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8 space-y-6">
                {/* Welcome Card */}
                <Card className="p-8 bg-gradient-to-br from-emerald-900/20 via-zinc-900/40 to-zinc-900/40 border-emerald-800/30 backdrop-blur-xl relative overflow-hidden group">
                  {/* Animated gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/5 opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(16,185,129,0.1),transparent_50%)]" />
                  
                  <div className="relative z-10 flex items-start justify-between gap-8">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-zinc-100 via-emerald-100 to-zinc-100 bg-clip-text text-transparent">
                          Welcome back, <Suspense fallback={<Skeleton className="h-4 w-20" />}>
                            {session?.user?.name || session?.user?.email?.split('@')[0]}
                          </Suspense>!
                        </h2>
                        <Sparkles className="h-6 w-6 text-emerald-400 animate-pulse" />
                      </div>
                      <p className="text-zinc-400 text-base mb-4">
                        Your AI-powered development environment is ready
                      </p>
                      
                      {/* Credits Display */}
                      <div className="flex items-center gap-6 text-sm mt-18">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                          <Coins className="h-4 w-4 text-emerald-400" />
                          <span className="text-zinc-500">Credits:</span>
                          {loadingCredits ? (
                            <Skeleton className="h-4 w-16 bg-zinc-800" />
                          ) : credits ? (
                            <span className="font-bold text-emerald-400">${credits.remaining.toFixed(2)}</span>
                          ) : (
                            <span className="text-zinc-600">Not set</span>
                          )}
                        </div>
                        {credits && !loadingCredits && (
                          <>
                            <div className="text-zinc-600">
                              Used: <span className="text-zinc-500">${credits.totalUsage.toFixed(2)}</span>
                            </div>
                            <div className="text-zinc-600">
                              Total: <span className="text-zinc-400">${credits.totalUsage.toFixed(2)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Mini Stats Table */}
                    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-4 min-w-[320px]">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                              <Code2 className="h-4 w-4 text-emerald-400" />
                            </div>
                            <span className="text-sm text-zinc-400">Workspaces</span>
                          </div>
                          {loading ? (
                            <Skeleton className="h-6 w-12 bg-zinc-800" />
                          ) : (
                            <span className="text-xl font-bold text-zinc-100">{workspaces.length}</span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                              <Zap className="h-4 w-4 text-emerald-400" />
                            </div>
                            <span className="text-sm text-zinc-400">Running</span>
                          </div>
                          {loading ? (
                            <Skeleton className="h-6 w-12 bg-zinc-800" />
                          ) : (
                            <span className="text-xl font-bold text-emerald-400">
                              {workspaces.filter(w => w.status === 'RUNNING').length}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                              <Rocket className="h-4 w-4 text-blue-400" />
                            </div>
                            <span className="text-sm text-zinc-400">Deployments</span>
                          </div>
                          {loadingDeployments ? (
                            <Skeleton className="h-6 w-12 bg-zinc-800" />
                          ) : (
                            <span className="text-xl font-bold text-blue-400">
                              {deployments.filter(d => d.status === 'RUNNING').length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Workspaces Section */}
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">Your Workspaces</h3>
                  {loading ? (
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {[1, 2, 3].map((i) => (
                        <Card key={i} className="p-5 bg-zinc-900/50 border-zinc-800/60">
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2.5">
                                <Skeleton className="h-8 w-8 rounded-lg bg-zinc-800" />
                                <Skeleton className="h-5 w-32 bg-zinc-800" />
                              </div>
                              <Skeleton className="h-6 w-16 bg-zinc-800" />
                            </div>
                            <Skeleton className="h-4 w-full bg-zinc-800" />
                            <Skeleton className="h-4 w-3/4 bg-zinc-800" />
                            <div className="flex gap-2 pt-2">
                              <Skeleton className="h-9 flex-1 bg-zinc-800" />
                              <Skeleton className="h-9 w-9 bg-zinc-800" />
                              <Skeleton className="h-9 w-9 bg-zinc-800" />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : workspaces.length === 0 ? (
                    <Card className="p-20 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 text-center backdrop-blur-xl relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      <div className="max-w-md mx-auto relative z-10">
                        <div className="relative mb-8 inline-block">
                          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 blur-2xl animate-pulse" />
                          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 border-zinc-700/50 flex items-center justify-center relative overflow-hidden group-hover:scale-110 transition-transform duration-500">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Terminal className="h-12 w-12 text-zinc-600 group-hover:text-emerald-400 transition-colors relative z-10" />
                          </div>
                        </div>
                        <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                          No workspaces yet
                        </h3>
                        <p className="text-zinc-500 mb-10 leading-relaxed text-base">
                          Create your first workspace to get started with cloud
                          development. Each workspace gives you a full VSCode
                          environment with AI assistance.
                        </p>
                        <Button
                          className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-2xl shadow-emerald-600/40 hover:shadow-emerald-600/60 hover:scale-105 px-8 py-6 text-base"
                          onClick={() => router.push("/dashboard/new")}
                        >
                          <Plus className="h-5 w-5 mr-2" />
                          Create Your First Workspace
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {workspaces.map((workspace) => (
                      <Card
                        key={workspace.id}
                        className="group p-5 bg-zinc-900/50 border-zinc-800/60 hover:border-emerald-500/40 transition-all cursor-pointer backdrop-blur-xl relative overflow-hidden hover:shadow-xl hover:shadow-emerald-500/10"
                        onClick={() => router.push(`/workspace/${workspace.id}`)}
                        onMouseEnter={() => setHoveredCard(workspace.id)}
                        onMouseLeave={() => setHoveredCard(null)}
                      >
                        {/* Hover glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
                        <div className="relative z-10">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1 min-w-0 mr-3">
                              <div className="flex items-center gap-2.5 mb-1.5">
                                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                  <Code2 className="h-4 w-4 text-emerald-400" />
                                </div>
                                <h3 className="text-base font-semibold text-zinc-100 group-hover:text-emerald-300 transition-colors truncate">
                                  {workspace.name}
                                </h3>
                                {workspace.teamId && (
                                  <Badge
                                    variant="outline"
                                    className="border-blue-500/30 bg-blue-500/10 text-blue-400 text-[10px] px-1.5 py-0.5"
                                  >
                                    <Users className="h-2.5 w-2.5 mr-1" />
                                    Team
                                  </Badge>
                                )}
                              </div>
                              {workspace.description && (
                                <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed ml-10">
                                  {workspace.description}
                                </p>
                              )}
                            </div>
                            <Badge
                              className={`${statusConfig[workspace.status].color} ${
                                statusConfig[workspace.status].glow
                              } text-[10px] font-semibold flex items-center gap-1 shrink-0 px-2 py-1`}
                            >
                              {statusConfig[workspace.status].icon}
                              {workspace.status.charAt(0) +
                                workspace.status.slice(1).toLowerCase()}
                            </Badge>
                          </div>

                          {/* GitHub Repo */}
                          {workspace.githubRepo && (
                            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-4 px-2.5 py-2 rounded-md bg-zinc-900/60 border border-zinc-800/60">
                              <Github className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                              <span className="truncate font-mono">
                                {workspace.githubRepo}
                              </span>
                            </div>
                          )}

                          {/* Metadata */}
                          <div className="flex items-center gap-4 text-[11px] text-zinc-600 mb-4 pb-4 border-b border-zinc-800/40">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-zinc-500" />
                              <span>
                                {new Date(
                                  workspace.lastAccessedAt
                                ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            {workspace.template && (
                              <div className="flex items-center gap-1.5">
                                <Cpu className="h-3.5 w-3.5 text-zinc-500" />
                                <span className="font-medium capitalize">
                                  {workspace.template}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className={
                                workspace.status === "RUNNING"
                                  ? "bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 flex-1 h-9 text-xs font-medium transition-all"
                                  : "bg-emerald-600/90 text-white hover:bg-emerald-600 flex-1 h-9 text-xs shadow-md shadow-emerald-600/20 font-medium transition-all"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartStop(workspace);
                              }}
                            >
                              {workspace.status === "RUNNING" ? (
                                <>
                                  <Square className="h-3.5 w-3.5 mr-1.5" />
                                  Stop
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5 mr-1.5" />
                                  Start
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-300 h-9 px-3 transition-all"
                              onClick={(e) => handleOpenSettings(workspace, e)}
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-zinc-800/80 bg-zinc-900/60 hover:bg-red-500/20 hover:border-red-500/40 text-zinc-500 hover:text-red-400 h-9 px-3 transition-all"
                              onClick={(e) => handleOpenDelete(workspace, e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                    </div>
                  )}
                </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-zinc-100">
              Workspace Settings
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Update your workspace name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Workspace Name
              </label>
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="my-awesome-project"
                className="bg-zinc-800/50 border-zinc-700/50 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Description
              </label>
              <Input
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="A brief description of your project"
                className="bg-zinc-800/50 border-zinc-700/50 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSettingsModalOpen(false)}
              className="border-zinc-700/50 hover:bg-zinc-800/50 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSettings}
              disabled={saving || !editedName.trim()}
              className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-zinc-100">
              Delete Workspace
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Are you sure you want to delete "{selectedWorkspace?.name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-400 mb-1">
                    Container Removal
                  </p>
                  <p className="text-sm text-zinc-400">
                    The Docker container will be stopped and removed. Your workspace files will be preserved in a volume.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 rounded-lg border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={deleteVolume}
                  onChange={(e) => setDeleteVolume(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-red-600 focus:ring-red-500 focus:ring-offset-0 cursor-pointer"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-300 mb-1">
                    Also delete workspace volume (permanent)
                  </p>
                  <p className="text-xs text-zinc-500">
                    This will permanently delete all files, code, and data. This action cannot be undone.
                  </p>
                </div>
              </label>

              {deleteVolume && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-400 mb-1">
                        ⚠️ Permanent Data Loss
                      </p>
                      <p className="text-sm text-zinc-400">
                        All workspace files will be permanently deleted. You will not be able to recover them.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              className="border-zinc-700/50 hover:bg-zinc-800/50 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/20"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Workspace
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

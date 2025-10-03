"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewAgentDialog } from "@/components/agents/new-agent-dialog";
import {
  Bot,
  Plus,
  Loader2,
  Clock,
  Play,
  Trash2,
  CheckCircle2,
  XCircle,
  Upload,
  Github,
  GitBranch,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NotificationBell } from "@/components/workspace/notification-bell";
import { useTeam } from "@/lib/team-context";

interface Agent {
  id: string;
  name: string;
  task: string;
  githubRepo: string;
  sourceBranch: string;
  targetBranch: string;
  status: "IDLE" | "CLONING" | "RUNNING" | "COMPLETED" | "ERROR" | "PUSHING";
  containerId?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  pushedAt?: string;
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const { currentTeam} = useTeam();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, [currentTeam]);

  const fetchAgents = async () => {
    try {
      const url = currentTeam 
        ? `/api/agents?teamId=${currentTeam.id}`
        : "/api/agents";
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setCreateModalOpen(true);
  };

  const handleStartAgent = async (agent: Agent) => {
    try {
      const res = await fetch(`/api/agents/${agent.id}/start`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchAgents();
        toast.success("Agent started!", {
          description: `${agent.name} is now running`,
        });
        router.push(`/dashboard/agents/${agent.id}`);
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to start agent");
      }
    } catch (error) {
      console.error("Error starting agent:", error);
      toast.error("Failed to start agent");
    }
  };

  const handleOpenDelete = (agent: Agent) => {
    setSelectedAgent(agent);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedAgent) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${selectedAgent.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchAgents();
        setDeleteModalOpen(false);
        toast.success("Agent deleted");
      } else {
        toast.error("Failed to delete agent");
      }
    } catch (error) {
      console.error("Error deleting agent:", error);
      toast.error("Failed to delete agent");
    } finally {
      setDeleting(false);
    }
  };

  const statusConfig = {
    IDLE: {
      color: "bg-zinc-800/80 text-zinc-400 border-zinc-700/50",
      icon: null,
    },
    CLONING: {
      color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    RUNNING: {
      color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    COMPLETED: {
      color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    ERROR: {
      color: "bg-red-500/20 text-red-300 border-red-500/30",
      icon: <XCircle className="h-3 w-3" />,
    },
    PUSHING: {
      color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      icon: <Upload className="h-3 w-3 animate-pulse" />,
    },
  };

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden relative">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none -z-10" />

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <div className="border-b border-zinc-800/50 flex items-center justify-between px-6 py-4 bg-zinc-950/50 backdrop-blur-sm relative z-50">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-emerald-400" />
            <h1 className="text-lg font-medium text-zinc-100">Agents</h1>
            <Badge
              variant="outline"
              className="bg-zinc-900/50 border-zinc-800 text-zinc-400 text-xs"
            >
              {agents.length}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
              onClick={handleOpenCreate}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Agent
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8">
            {agents.length === 0 && !loading ? (
              <Card className="p-20 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 text-center backdrop-blur-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="max-w-md mx-auto relative z-10">
                  <div className="relative mb-8 inline-block">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 blur-2xl animate-pulse" />
                    <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 border-zinc-700/50 flex items-center justify-center relative overflow-hidden group-hover:scale-110 transition-transform duration-500">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Bot className="h-12 w-12 text-zinc-600 group-hover:text-emerald-400 transition-colors relative z-10" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                    No agents yet
                  </h3>
                  <p className="text-zinc-500 mb-10 leading-relaxed text-base">
                    Create your first agent to automate code editing tasks on
                    your GitHub repositories with AI assistance.
                  </p>
                  <Button
                    className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-2xl shadow-emerald-600/40 hover:shadow-emerald-600/60 hover:scale-105 px-8 py-6 text-base"
                    onClick={handleOpenCreate}
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Create Your First Agent
                  </Button>
                </div>
              </Card>
            ) : loading ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-6 bg-zinc-900/50 border-zinc-800/60">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Skeleton className="h-4 w-4 bg-zinc-800" />
                            <Skeleton className="h-5 w-32 bg-zinc-800" />
                          </div>
                          <Skeleton className="h-4 w-full bg-zinc-800" />
                          <Skeleton className="h-4 w-3/4 bg-zinc-800 mt-1" />
                        </div>
                        <Skeleton className="h-6 w-20 bg-zinc-800" />
                      </div>
                      <div className="space-y-3">
                        <Skeleton className="h-10 w-full bg-zinc-800" />
                        <Skeleton className="h-4 w-full bg-zinc-800" />
                        <Skeleton className="h-4 w-24 bg-zinc-800" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-9 flex-1 bg-zinc-800" />
                        <Skeleton className="h-9 w-9 bg-zinc-800" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {agents.map((agent) => (
                  <Card
                    key={agent.id}
                    className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 hover:border-zinc-700/80 transition-all backdrop-blur-xl relative overflow-hidden hover:scale-[1.02]"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="h-4 w-4 text-emerald-400" />
                          <h3 className="text-lg font-semibold text-zinc-100 truncate">
                            {agent.name}
                          </h3>
                        </div>
                        <p className="text-sm text-zinc-400 line-clamp-2">
                          {agent.task}
                        </p>
                      </div>
                      <Badge
                        className={`${
                          statusConfig[agent.status].color
                        } text-xs font-semibold flex items-center gap-1.5 shrink-0 px-3 py-1.5`}
                      >
                        {statusConfig[agent.status].icon}
                        {agent.status.charAt(0) +
                          agent.status.slice(1).toLowerCase()}
                      </Badge>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-2 text-sm text-zinc-400 px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
                        <Github className="h-4 w-4 shrink-0" />
                        <span className="truncate font-mono text-xs">
                          {agent.githubRepo}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <GitBranch className="h-4 w-4" />
                        <span className="text-xs">
                          {agent.sourceBranch} → {agent.targetBranch}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-600">
                        <Clock className="h-4 w-4" />
                        <span>
                          {new Date(agent.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {agent.errorMessage && (
                      <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-xs text-red-400">
                          {agent.errorMessage}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {agent.status === "IDLE" && (
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500"
                          onClick={() => handleStartAgent(agent)}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </Button>
                      )}
                      {(agent.status === "RUNNING" ||
                        agent.status === "COMPLETED") && (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            router.push(`/dashboard/agents/${agent.id}`)
                          }
                        >
                          View Details
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-zinc-800/80 bg-zinc-900/80 hover:bg-red-500/20 hover:border-red-500/40 text-zinc-500 hover:text-red-400"
                        onClick={() => handleOpenDelete(agent)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Agent Dialog */}
      <NewAgentDialog
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={fetchAgents}
      />

      {/* Delete Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-zinc-100">
              Delete Agent
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Are you sure you want to delete "{selectedAgent?.name}"?
            </DialogDescription>
          </DialogHeader>
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
              className="bg-red-600 text-white hover:bg-red-500"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

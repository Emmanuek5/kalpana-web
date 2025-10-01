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
  Bot,
  Plus,
  Loader2,
  AlertCircle,
  Github,
  GitBranch,
  Clock,
  Play,
  Trash2,
  CheckCircle2,
  XCircle,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [sourceBranch, setSourceBranch] = useState("main");
  const [targetBranch, setTargetBranch] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
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

  const fetchGitHubRepos = async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch("/api/user/github/repos");
      if (res.ok) {
        const data = await res.json();
        setGithubRepos(data.repos || []);
      } else {
        alert("Please connect your GitHub account in settings");
      }
    } catch (error) {
      console.error("Failed to fetch GitHub repos:", error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleOpenCreate = () => {
    setName("");
    setTask("");
    setSelectedRepo("");
    setSourceBranch("main");
    setTargetBranch("");
    setCreateModalOpen(true);
    fetchGitHubRepos();
  };

  const handleCreate = async () => {
    if (!name || !task || !selectedRepo || !targetBranch) {
      alert("Please fill in all fields");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          task,
          githubRepo: selectedRepo,
          sourceBranch,
          targetBranch,
        }),
      });

      if (res.ok) {
        await fetchAgents();
        setCreateModalOpen(false);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create agent");
      }
    } catch (error) {
      console.error("Error creating agent:", error);
      alert("Failed to create agent");
    } finally {
      setCreating(false);
    }
  };

  const handleStartAgent = async (agent: Agent) => {
    try {
      const res = await fetch(`/api/agents/${agent.id}/start`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchAgents();
        router.push(`/dashboard/agents/${agent.id}`);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to start agent");
      }
    } catch (error) {
      console.error("Error starting agent:", error);
      alert("Failed to start agent");
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
      } else {
        alert("Failed to delete agent");
      }
    } catch (error) {
      console.error("Error deleting agent:", error);
      alert("Failed to delete agent");
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
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none" />

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <div className="border-b border-zinc-800/50 flex items-center justify-between px-6 py-4 bg-zinc-950/50 backdrop-blur-sm">
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
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
            onClick={handleOpenCreate}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Agent
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8">
            {loading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="h-12 w-12 text-emerald-400 animate-spin" />
              </div>
            ) : agents.length === 0 ? (
              <Card className="p-20 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 text-center backdrop-blur-xl">
                <div className="max-w-md mx-auto">
                  <Bot className="h-16 w-16 text-zinc-600 mx-auto mb-6" />
                  <h3 className="text-2xl font-bold mb-3 text-zinc-100">
                    No agents yet
                  </h3>
                  <p className="text-zinc-500 mb-10">
                    Create your first agent to automate code editing tasks on
                    your GitHub repositories.
                  </p>
                  <Button
                    className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white"
                    onClick={handleOpenCreate}
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Create Your First Agent
                  </Button>
                </div>
              </Card>
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

      {/* Create Agent Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-zinc-100">
              Create New Agent
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Configure an autonomous coding agent to work on your GitHub
              repository.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Agent Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Refactor Components"
                className="bg-zinc-800/50 border-zinc-700/50 focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Task Description
              </label>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Describe what the agent should do..."
                className="w-full min-h-[100px] px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-100 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                GitHub Repository
              </label>
              {loadingRepos ? (
                <div className="flex items-center gap-2 text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading repositories...
                </div>
              ) : (
                <select
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-100"
                >
                  <option value="">Select a repository</option>
                  {githubRepos.map((repo) => (
                    <option key={repo.id} value={repo.fullName}>
                      {repo.fullName}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Source Branch
                </label>
                <Input
                  value={sourceBranch}
                  onChange={(e) => setSourceBranch(e.target.value)}
                  placeholder="main"
                  className="bg-zinc-800/50 border-zinc-700/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Target Branch
                </label>
                <Input
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                  placeholder="agent-changes"
                  className="bg-zinc-800/50 border-zinc-700/50"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              className="border-zinc-700/50 hover:bg-zinc-800/50 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Agent"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
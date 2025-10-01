"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  GitBranch,
  Github,
  ArrowRight,
  ArrowLeft,
  Check,
  Bot,
} from "lucide-react";

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
}

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
}

interface NewAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewAgentDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewAgentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [step, setStep] = useState(1);

  // Form state
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [model, setModel] = useState("select-model");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [sourceBranch, setSourceBranch] = useState("main");
  const [targetBranch, setTargetBranch] = useState("");
  const [targetBranchTouched, setTargetBranchTouched] = useState(false);

  useEffect(() => {
    if (open) {
      fetchRepos();
      fetchModels();
      setStep(1); // Reset to first step when opening
    }
  }, [open]);

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      // Fetch user's favorite models from settings
      const [settingsRes, modelsRes] = await Promise.all([
        fetch("/api/user/settings"),
        fetch("/api/models"),
      ]);

      if (settingsRes.ok && modelsRes.ok) {
        const settings = await settingsRes.json();
        const modelsData = await modelsRes.json();

        const favoriteModelIds = settings.favoriteModels || [];

        if (favoriteModelIds.length > 0) {
          // Show only user's favorite models
          const favoriteModels = modelsData.data?.filter((m: any) =>
            favoriteModelIds.includes(m.id)
          );
          setModels(favoriteModels || []);
        } else {
          // No favorites set, show popular defaults
          setModels([
            { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
            { id: "anthropic/claude-3-opus", name: "Claude 3 Opus" },
            { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo" },
          ]);
        }
      }
    } catch (error) {
      console.error("Error fetching models:", error);
      // Fallback to default models
      setModels([
        { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
        { id: "anthropic/claude-3-opus", name: "Claude 3 Opus" },
        { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo" },
      ]);
    } finally {
      setLoadingModels(false);
    }
  };

  // Auto-generate target branch from name/task if user hasn't edited it
  useEffect(() => {
    if (!targetBranchTouched) {
      const source = name.trim() || task.trim();
      if (source) {
        setTargetBranch(generateBranchName(source));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, task]);

  const generateBranchName = (title: string) => {
    const base = (title || "agent-update")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40);
    return `agent/${base || "update"}`;
  };

  const fetchRepos = async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch("/api/user/github/repos");
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repos || []);
      } else {
        console.error("Failed to fetch repos:", res.status);
      }
    } catch (error) {
      console.error("Error fetching repos:", error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const fetchBranches = async (repoFullName: string) => {
    if (!repoFullName) return;

    setLoadingBranches(true);
    setBranches([]);
    try {
      const [owner, repo] = repoFullName.split("/");
      const res = await fetch(
        `/api/user/github/repos?owner=${owner}&repo=${repo}&branches=true`
      );

      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);

        // Set default branch if available
        const selectedRepoData = repos.find((r) => r.fullName === repoFullName);
        if (selectedRepoData && data.branches?.length > 0) {
          const defaultBranch = data.branches.find(
            (b: GitHubBranch) => b.name === selectedRepoData.defaultBranch
          );
          if (defaultBranch) {
            setSourceBranch(defaultBranch.name);
          } else if (data.branches[0]) {
            setSourceBranch(data.branches[0].name);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!name || !task) {
        alert("Please fill in agent name and task description");
        return;
      }
    }
    if (step === 2) {
      if (!selectedRepo) {
        alert("Please select a GitHub repository");
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleCreate = async () => {
    if (!name || !task || !selectedRepo || !targetBranch) {
      alert("Please fill in all required fields");
      return;
    }

    if (model === "select-model") {
      alert("Please select a model");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          task,
          model,
          githubRepo: selectedRepo,
          sourceBranch,
          targetBranch,
        }),
      });

      if (res.ok) {
        onSuccess();
        onOpenChange(false);
        // Reset form
        setName("");
        setTask("");
        setModel("anthropic/claude-3.5-sonnet");
        setSelectedRepo("");
        setSourceBranch("main");
        setTargetBranch("");
        setTargetBranchTouched(false);
        setStep(1);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create agent");
      }
    } catch (error) {
      console.error("Error creating agent:", error);
      alert("Failed to create agent");
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return "Agent Configuration";
      case 2:
        return "Repository Selection";
      case 3:
        return "Branch Configuration";
      default:
        return "New Agent";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 1:
        return "Name your agent and describe what it should do";
      case 2:
        return "Choose which repository the agent will work on";
      case 3:
        return "Configure source and target branches";
      default:
        return "Create an autonomous coding agent";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-2xl">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {getStepDescription()}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`h-2 rounded-full flex-1 ${
                  s <= step ? "bg-emerald-500" : "bg-zinc-800"
                }`}
              />
              {s < 3 && <div className="w-2" />}
            </div>
          ))}
        </div>

        <div className="space-y-4 py-4 min-h-[300px]">
          {/* Step 1: Agent Configuration */}
          {step === 1 && (
            <>
              {/* Name */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Agent Name *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Refactor Components"
                  className="bg-zinc-900 border-zinc-800"
                  autoFocus
                />
              </div>

              {/* Task Description */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Task Description *
                </label>
                <textarea
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  placeholder="Describe what the agent should do... Be specific about the changes you want."
                  className="w-full min-h-[120px] px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 resize-none"
                />
                <p className="text-xs text-zinc-500 mt-1.5">
                  Be specific about what changes you want the agent to make to
                  your code
                </p>
              </div>

              {/* Model Selection */}
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  AI Model
                </label>
                {loadingModels ? (
                  <div className="flex items-center gap-2 p-3 bg-zinc-900 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-zinc-500">
                      Loading models...
                    </span>
                  </div>
                ) : (
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 max-h-[300px]">
                      <SelectItem value="select-model">Select Model</SelectItem>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                          {m.id === "anthropic/claude-3.5-sonnet" && " ⭐"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-zinc-500 mt-1.5">
                  Choose the AI model for your agent
                </p>
              </div>
            </>
          )}

          {/* Step 2: Repository Selection */}
          {step === 2 && (
            <>
              {/* GitHub Repository */}
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  GitHub Repository *
                </label>
                {loadingRepos ? (
                  <div className="flex items-center gap-2 p-3 bg-zinc-900 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-zinc-500">
                      Loading repos...
                    </span>
                  </div>
                ) : repos.length === 0 ? (
                  <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 text-sm text-zinc-500">
                    No repositories found. Make sure your GitHub account is
                    connected.
                  </div>
                ) : (
                  <Select
                    value={selectedRepo}
                    onValueChange={(value) => {
                      setSelectedRepo(value);
                      fetchBranches(value);
                      const repo = repos.find((r) => r.fullName === value);
                      if (repo && !targetBranchTouched) {
                        const source = name.trim() || task.trim() || repo.name;
                        setTargetBranch(generateBranchName(source));
                      }
                    }}
                  >
                    <SelectTrigger className="bg-zinc-900 border-zinc-800">
                      <SelectValue placeholder="Select repository" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 max-h-[300px]">
                      {repos.map((repo) => (
                        <SelectItem key={repo.id} value={repo.fullName}>
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-3.5 w-3.5" />
                            <div className="flex flex-col items-start">
                              <span>{repo.fullName}</span>
                              {repo.description && (
                                <span className="text-xs text-zinc-500">
                                  {repo.description.substring(0, 60)}
                                  {repo.description.length > 60 && "..."}
                                </span>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Source Branch */}
              {selectedRepo && (
                <div>
                  <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Source Branch
                  </label>
                  {loadingBranches ? (
                    <div className="flex items-center gap-2 p-3 bg-zinc-900 rounded-lg">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-zinc-500">
                        Loading branches...
                      </span>
                    </div>
                  ) : branches.length > 0 ? (
                    <Select
                      value={sourceBranch}
                      onValueChange={setSourceBranch}
                    >
                      <SelectTrigger className="bg-zinc-900 border-zinc-800">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 max-h-[200px]">
                        {branches.map((b) => (
                          <SelectItem key={b.name} value={b.name}>
                            <div className="flex items-center gap-2">
                              <GitBranch className="h-3.5 w-3.5" />
                              <span>{b.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={sourceBranch}
                      onChange={(e) => setSourceBranch(e.target.value)}
                      placeholder="main"
                      className="bg-zinc-900 border-zinc-800"
                    />
                  )}
                  <p className="text-xs text-zinc-500 mt-1.5">
                    The agent will clone and work from this branch
                  </p>
                </div>
              )}
            </>
          )}

          {/* Step 3: Review & Target Branch */}
          {step === 3 && (
            <>
              {/* Summary */}
              <div className="bg-zinc-900/50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Agent Summary
                </h4>
                <div className="text-xs text-zinc-500 space-y-1">
                  <p>
                    <span className="text-zinc-400">Name:</span> {name}
                  </p>
                  <p>
                    <span className="text-zinc-400">Repository:</span>{" "}
                    {selectedRepo}
                  </p>
                  <p>
                    <span className="text-zinc-400">Source Branch:</span>{" "}
                    {sourceBranch}
                  </p>
                  <p className="text-zinc-400 pt-2">Task:</p>
                  <p className="text-zinc-500 italic">{task}</p>
                </div>
              </div>

              {/* Target Branch */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <GitBranch className="h-4 w-4 text-sm font-medium" />
                  <label className="text-sm font-medium">Target Branch *</label>
                </div>
                <Input
                  value={targetBranch}
                  onChange={(e) => {
                    setTargetBranchTouched(true);
                    setTargetBranch(e.target.value);
                  }}
                  placeholder="agent/update"
                  className="bg-zinc-900 border-zinc-800"
                />
                <p className="text-xs text-zinc-500 mt-1.5">
                  Agent will push changes to this new branch. Auto-generated
                  from your agent name.
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-xs text-blue-400">
                  💡 After the agent completes its task, you can review the
                  changes and create a Pull Request to merge them into your main
                  branch.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-800"
            >
              Cancel
            </Button>
            {step > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="border-zinc-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 3 ? (
              <Button
                onClick={handleNext}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={
                  !name || !task || !selectedRepo || !targetBranch || loading
                }
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Create Agent
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

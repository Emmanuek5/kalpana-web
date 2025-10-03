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
  Globe,
  ArrowRight,
  ArrowLeft,
  Check,
  User,
  Users as UsersIcon,
} from "lucide-react";
import { useTeam } from "@/lib/team-context";
import { toast } from "sonner";

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
}

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
}

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
}

interface NewDeploymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const FRAMEWORK_PRESETS = {
  nextjs: {
    label: "Next.js",
    buildCommand: "bun run build",
    startCommand: "bun start",
    installCommand: "bun install",
    port: "3000",
  },
  vite: {
    label: "Vite",
    buildCommand: "bun run build",
    startCommand: "bun run preview",
    installCommand: "bun install",
    port: "4173",
  },
  react: {
    label: "Create React App",
    buildCommand: "bun run build",
    startCommand: "bunx serve -s build -l 3000",
    installCommand: "bun install",
    port: "3000",
  },
  node: {
    label: "Node.js / Bun",
    buildCommand: "",
    startCommand: "bun start",
    installCommand: "bun install",
    port: "3000",
  },
  custom: {
    label: "Custom",
    buildCommand: "",
    startCommand: "",
    installCommand: "bun install",
    port: "3000",
  },
};

export function NewDeploymentDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewDeploymentDialogProps) {
  const { currentTeam } = useTeam();
  const [loading, setLoading] = useState(false);
  const [hasTeamGithub, setHasTeamGithub] = useState(false);
  const [githubSource, setGithubSource] = useState<"personal" | "team">("personal");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [step, setStep] = useState(1);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [framework, setFramework] =
    useState<keyof typeof FRAMEWORK_PRESETS>("nextjs");
  const [buildCommand, setBuildCommand] = useState(
    FRAMEWORK_PRESETS.nextjs.buildCommand
  );
  const [startCommand, setStartCommand] = useState(
    FRAMEWORK_PRESETS.nextjs.startCommand
  );
  const [installCommand, setInstallCommand] = useState(
    FRAMEWORK_PRESETS.nextjs.installCommand
  );
  const [port, setPort] = useState(FRAMEWORK_PRESETS.nextjs.port);
  const [subdomain, setSubdomain] = useState("");
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [autoRebuild, setAutoRebuild] = useState(true);

  useEffect(() => {
    if (open) {
      checkTeamGithub();
      fetchRepos();
      fetchDomains();
      setStep(1); // Reset to first step when opening
    }
  }, [open, currentTeam]);

  const checkTeamGithub = async () => {
    if (currentTeam) {
      try {
        const res = await fetch(`/api/teams/${currentTeam.id}/integrations`);
        if (res.ok) {
          const data = await res.json();
          setHasTeamGithub(data.githubConnected);
          if (data.githubConnected) {
            setGithubSource("team");
          }
        }
      } catch (error) {
        console.error("Error checking team GitHub:", error);
      }
    }
  };

  useEffect(() => {
    const preset = FRAMEWORK_PRESETS[framework];
    setBuildCommand(preset.buildCommand);
    setStartCommand(preset.startCommand);
    setInstallCommand(preset.installCommand);
    setPort(preset.port);
  }, [framework]);

  const fetchRepos = async (source?: "personal" | "team") => {
    const sourceToUse = source || githubSource;
    setLoadingRepos(true);
    setRepos([]);
    
    try {
      let url = "/api/user/github/repos";
      
      if (sourceToUse === "team" && currentTeam && hasTeamGithub) {
        url = `/api/teams/${currentTeam.id}/github/repos`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        console.log("Fetched repos:", data.repos); // Debug log
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
      // Extract owner and repo from full_name (e.g., "owner/repo")
      const [owner, repo] = repoFullName.split("/");
      
      let url = `/api/user/github/repos?owner=${owner}&repo=${repo}&branches=true`;
      if (githubSource === "team" && currentTeam && hasTeamGithub) {
        url = `/api/teams/${currentTeam.id}/github/repos?owner=${owner}&repo=${repo}&branches=true`;
      }
      
      const res = await fetch(url);

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
            setBranch(defaultBranch.name);
          } else if (data.branches[0]) {
            setBranch(data.branches[0].name);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    } finally {
      setLoadingBranches(false);
    }
  };

  const fetchDomains = async () => {
    try {
      const res = await fetch("/api/domains");
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains?.filter((d: Domain) => d.verified) || []);
      }
    } catch (error) {
      console.error("Error fetching domains:", error);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!name || !selectedRepo) {
        toast.error("Please fill in project name and select a repository");
        return;
      }
    }
    if (step === 2) {
      if (!startCommand || !port) {
        toast.error("Please fill in start command and port");
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleCreate = async () => {
    if (!name || !selectedRepo || !startCommand || !port) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          githubRepo: selectedRepo,
          githubBranch: branch,
          githubSource: githubSource,
          buildCommand,
          startCommand,
          installCommand,
          port: parseInt(port),
          subdomain,
          domainId: selectedDomainId || null,
          autoRebuild,
          framework: framework !== "custom" ? framework : null,
          teamId: currentTeam?.id || undefined,
        }),
      });

      if (res.ok) {
        toast.success("Deployment created successfully!", {
          description: `${name} is being deployed`,
        });
        onSuccess();
        onOpenChange(false);
        // Reset form
        setName("");
        setDescription("");
        setSelectedRepo("");
        setBranch("main");
        setFramework("nextjs");
        setSubdomain("");
        setSelectedDomainId("");
        setStep(1);
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create deployment");
      }
    } catch (error) {
      console.error("Error creating deployment:", error);
      toast.error("Failed to create deployment");
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return "Project Setup";
      case 2:
        return "Build Configuration";
      case 3:
        return "Deployment Settings";
      default:
        return "New Deployment";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 1:
        return "Choose your repository and name your project";
      case 2:
        return "Configure how your app will be built and started";
      case 3:
        return "Set up domain and deployment options";
      default:
        return "Deploy your application from GitHub";
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
          {/* Step 1: Project Setup */}
          {step === 1 && (
            <>
              {/* Name */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Project Name *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-awesome-app"
                  className="bg-zinc-900 border-zinc-800"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Description
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>

              {/* GitHub Source Selector */}
              {currentTeam && hasTeamGithub && (
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">
                    GitHub Source
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={githubSource === "personal" ? "default" : "outline"}
                      onClick={() => {
                        setGithubSource("personal");
                        setSelectedRepo("");
                        fetchRepos("personal");
                      }}
                      className={`flex-1 ${
                        githubSource === "personal"
                          ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
                          : "border-zinc-700 hover:bg-zinc-800"
                      }`}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Personal
                    </Button>
                    <Button
                      type="button"
                      variant={githubSource === "team" ? "default" : "outline"}
                      onClick={() => {
                        setGithubSource("team");
                        setSelectedRepo("");
                        fetchRepos("team");
                      }}
                      className={`flex-1 ${
                        githubSource === "team"
                          ? "bg-blue-500 hover:bg-blue-400 text-white"
                          : "border-zinc-700 hover:bg-zinc-800"
                      }`}
                    >
                      <UsersIcon className="h-4 w-4 mr-2" />
                      Team ({currentTeam.name})
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    {githubSource === "personal"
                      ? "Using your personal GitHub repositories"
                      : `Using ${currentTeam.name}'s GitHub repositories`}
                  </p>
                </div>
              )}

              {/* GitHub Repository */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
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
                            <span>{repo.fullName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Branch */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Branch
                </label>
                {loadingBranches ? (
                  <div className="flex items-center gap-2 p-3 bg-zinc-900 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-zinc-500">
                      Loading branches...
                    </span>
                  </div>
                ) : branches.length > 0 ? (
                  <Select value={branch} onValueChange={setBranch}>
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
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="bg-zinc-900 border-zinc-800"
                    disabled={!selectedRepo}
                  />
                )}
                {selectedRepo && branches.length > 0 && (
                  <p className="text-xs text-zinc-500 mt-1">
                    {branches.length} branch{branches.length !== 1 ? "es" : ""}{" "}
                    available
                  </p>
                )}
              </div>
            </>
          )}

          {/* Step 2: Build Configuration */}
          {step === 2 && (
            <>
              {/* Framework */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Framework Preset
                </label>
                <Select
                  value={framework}
                  onValueChange={(value) =>
                    setFramework(value as keyof typeof FRAMEWORK_PRESETS)
                  }
                >
                  <SelectTrigger className="bg-zinc-900 border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {Object.entries(FRAMEWORK_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-500 mt-1.5">
                  Automatically configures build settings for your framework
                </p>
              </div>

              {/* Build Commands */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Install Command
                  </label>
                  <Input
                    value={installCommand}
                    onChange={(e) => setInstallCommand(e.target.value)}
                    placeholder="npm install"
                    className="bg-zinc-900 border-zinc-800"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Build Command
                  </label>
                  <Input
                    value={buildCommand}
                    onChange={(e) => setBuildCommand(e.target.value)}
                    placeholder="npm run build"
                    className="bg-zinc-900 border-zinc-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Start Command *
                  </label>
                  <Input
                    value={startCommand}
                    onChange={(e) => setStartCommand(e.target.value)}
                    placeholder="npm start"
                    className="bg-zinc-900 border-zinc-800"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Port *
                  </label>
                  <Input
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="3000"
                    type="number"
                    className="bg-zinc-900 border-zinc-800"
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 3: Deployment Settings */}
          {step === 3 && (
            <>
              {/* Summary */}
              <div className="bg-zinc-900/50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium text-zinc-300">Summary</h4>
                <div className="text-xs text-zinc-500 space-y-1">
                  <p>
                    <span className="text-zinc-400">Project:</span> {name}
                  </p>
                  <p>
                    <span className="text-zinc-400">Repository:</span>{" "}
                    {selectedRepo}
                  </p>
                  <p>
                    <span className="text-zinc-400">Framework:</span>{" "}
                    {FRAMEWORK_PRESETS[framework].label}
                  </p>
                </div>
              </div>

              {/* Domain Configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Subdomain
                  </label>
                  <Input
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    placeholder="my-app"
                    className="bg-zinc-900 border-zinc-800"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Your app will be available at subdomain.domain.com
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Domain
                  </label>
                  <Select
                    value={selectedDomainId}
                    onValueChange={setSelectedDomainId}
                  >
                    <SelectTrigger className="bg-zinc-900 border-zinc-800">
                      <SelectValue placeholder="Select domain" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {domains.map((domain) => (
                        <SelectItem key={domain.id} value={domain.id}>
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5" />
                            {domain.domain}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Auto-rebuild */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={autoRebuild}
                    onChange={(e) => setAutoRebuild(e.target.checked)}
                    className="rounded border-zinc-700 mt-0.5"
                    id="auto-rebuild"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="auto-rebuild"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Enable auto-rebuild on Git push
                    </label>
                    <p className="text-xs text-zinc-500 mt-1">
                      Automatically redeploy when you push to your repository
                    </p>
                  </div>
                </div>
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
                  !name || !selectedRepo || !startCommand || !port || loading
                }
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Create Deployment
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

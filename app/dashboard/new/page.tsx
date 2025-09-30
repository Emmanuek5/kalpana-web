"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/sidebar";
import {
  Github,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  FileCode,
  Boxes,
  Settings as SettingsIcon,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

const templates = [
  { id: "node", name: "Node.js", desc: "Node.js 20 + npm/bun" },
  { id: "python", name: "Python", desc: "Python 3.11 + pip" },
  { id: "rust", name: "Rust", desc: "Rust + Cargo" },
  { id: "go", name: "Go", desc: "Go 1.21" },
  { id: "fullstack", name: "Full Stack", desc: "Node + Python + PostgreSQL" },
  { id: "custom", name: "Custom", desc: "Bring your own Nix config" },
];

const presets = [
  {
    id: "default",
    name: "Default",
    desc: "One Dark Pro theme with essential extensions",
  },
  {
    id: "minimal",
    name: "Minimal",
    desc: "Lightweight setup with only core tools",
  },
  {
    id: "fullstack",
    name: "Full Stack",
    desc: "Complete setup for full-stack development",
  },
];

const steps = [
  { id: 1, name: "Basic Info", icon: FileCode },
  { id: 2, name: "Template", icon: Boxes },
  { id: 3, name: "GitHub", icon: Github },
  { id: 4, name: "Review", icon: SettingsIcon },
];

export default function NewWorkspacePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUser, setGithubUser] = useState<{
    username: string;
    avatarUrl?: string;
  } | null>(null);
  const [loadingGithub, setLoadingGithub] = useState(true);
  const [repos, setRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [userPresets, setUserPresets] = useState<any[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    githubRepo: "",
    template: "node",
    nixConfig: "",
    preset: "default",
    customPresetId: "",
  });

  useEffect(() => {
    fetchGithubStatus();
    fetchUserPresets();
  }, []);

  const fetchUserPresets = async () => {
    try {
      const res = await fetch("/api/presets");
      if (res.ok) {
        const data = await res.json();
        setUserPresets(data);
      }
    } catch (error) {
      console.error("Error fetching user presets:", error);
    } finally {
      setLoadingPresets(false);
    }
  };

  const fetchGithubStatus = async () => {
    setLoadingGithub(true);
    try {
      const res = await fetch("/api/user/github");
      if (res.ok) {
        const data = await res.json();
        setGithubConnected(data.connected);
        if (data.connected) {
          setGithubUser({
            username: data.username,
            avatarUrl: data.avatarUrl,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching GitHub status:", error);
    } finally {
      setLoadingGithub(false);
    }
  };

  const fetchRepos = async () => {
    if (!githubConnected) return;
    setLoadingRepos(true);
    try {
      const res = await fetch(
        "/api/user/github/repos?per_page=50&sort=updated"
      );
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repos || []);
      }
    } catch (error) {
      console.error("Error fetching repos:", error);
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffect(() => {
    if (githubConnected && currentStep === 3) {
      fetchRepos();
    }
  }, [githubConnected, currentStep]);

  const filteredRepos = useMemo(() => {
    const query = repoSearch.trim().toLowerCase();
    if (!query) return repos;
    return repos.filter((repo: any) => {
      const name = (repo.name || "").toLowerCase();
      const fullName = (repo.fullName || "").toLowerCase();
      const description = (repo.description || "").toLowerCase();
      return (
        name.includes(query) ||
        fullName.includes(query) ||
        description.includes(query)
      );
    });
  }, [repos, repoSearch]);

  const handleNext = () => {
    // Skip custom nix config step if not using custom template
    if (currentStep === 2 && formData.template !== "custom") {
      setCurrentStep(4);
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length));
    }
  };

  const handleBack = () => {
    // Skip custom nix config step when going back if not using custom template
    if (currentStep === 4 && formData.template !== "custom") {
      setCurrentStep(2);
    } else {
      setCurrentStep((prev) => Math.max(prev - 1, 1));
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name.trim().length > 0;
      case 2:
        return formData.template !== "";
      case 3:
        return true; // GitHub is optional
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      // Prepare the data to send
      const submitData = {
        ...formData,
        preset: formData.customPresetId
          ? formData.customPresetId
          : formData.preset,
      };

      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      if (res.ok) {
        const workspace = await res.json();
        router.push(`/workspace/${workspace.id}`);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create workspace");
      }
    } catch (error) {
      console.error("Error creating workspace:", error);
      alert("Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-zinc-100 mb-2">
                Let's start with the basics
              </h2>
              <p className="text-zinc-500">
                Give your workspace a name and description
              </p>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Workspace Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="my-awesome-project"
                  className="bg-zinc-900 border-zinc-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 h-12 text-base"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Description (optional)
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="A brief description of your project"
                  className="bg-zinc-900 border-zinc-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 h-12 text-base"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-zinc-100 mb-2">
                Choose your development environment
              </h2>
              <p className="text-zinc-500">
                Select a pre-configured template or bring your own
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() =>
                    setFormData({ ...formData, template: template.id })
                  }
                  className={`p-5 rounded-lg border cursor-pointer transition-all ${
                    formData.template === template.id
                      ? "border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10"
                      : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-zinc-200">
                      {template.name}
                    </h3>
                    {formData.template === template.id && (
                      <Check className="h-5 w-5 text-emerald-500" />
                    )}
                  </div>
                  <p className="text-sm text-zinc-500">{template.desc}</p>
                </div>
              ))}
            </div>
            {formData.template === "custom" && (
              <Card className="p-5 bg-zinc-900/50 border-zinc-800">
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Custom Nix Configuration
                </label>
                <textarea
                  value={formData.nixConfig}
                  onChange={(e) =>
                    setFormData({ ...formData, nixConfig: e.target.value })
                  }
                  placeholder={`{ pkgs ? import <nixpkgs> {} }:\n\npkgs.mkShell {\n  buildInputs = with pkgs; [\n    nodejs\n    python3\n  ];\n}`}
                  className="w-full h-48 p-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none font-mono text-sm text-zinc-300"
                />
              </Card>
            )}

            <div className="pt-6 border-t border-zinc-800">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                  Choose VS Code Preset
                </h3>
                <p className="text-sm text-zinc-500">
                  Select a preset configuration for theme and extensions
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-3">
                    Built-in Presets
                  </h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    {presets.map((preset) => (
                      <div
                        key={preset.id}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            preset: preset.id,
                            customPresetId: "",
                          })
                        }
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          formData.preset === preset.id &&
                          !formData.customPresetId
                            ? "border-blue-500 bg-blue-500/5 shadow-lg shadow-blue-500/10"
                            : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium text-zinc-200">
                            {preset.name}
                          </h3>
                          {formData.preset === preset.id &&
                            !formData.customPresetId && (
                              <Check className="h-4 w-4 text-blue-500" />
                            )}
                        </div>
                        <p className="text-xs text-zinc-500">{preset.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {userPresets.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-400 mb-3">
                      Your Custom Presets
                    </h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      {userPresets.map((preset) => (
                        <div
                          key={preset.id}
                          onClick={() =>
                            setFormData({
                              ...formData,
                              preset: "custom",
                              customPresetId: preset.id,
                            })
                          }
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            formData.customPresetId === preset.id
                              ? "border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10"
                              : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-medium text-zinc-200">
                              {preset.name}
                            </h3>
                            {formData.customPresetId === preset.id && (
                              <Check className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">
                            {preset.description || "Custom preset"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <SettingsIcon className="h-4 w-4" />
                  <span>
                    Want to create your own preset?{" "}
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/presets")}
                      className="text-emerald-400 hover:text-emerald-300 underline"
                    >
                      Manage Presets
                    </button>
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-zinc-100 mb-2">
                Connect to a GitHub repository
              </h2>
              <p className="text-zinc-500">
                Clone an existing repo or start from scratch
              </p>
            </div>

            {loadingGithub ? (
              <Card className="p-6 bg-zinc-900/30 border-zinc-800">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 text-zinc-600 animate-spin" />
                  <span className="text-sm text-zinc-500">
                    Checking GitHub connection...
                  </span>
                </div>
              </Card>
            ) : !githubConnected ? (
              <Card className="p-6 bg-zinc-900/30 border-zinc-800">
                <div className="flex items-start gap-4">
                  <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-zinc-200 mb-2">
                      GitHub Not Connected
                    </h3>
                    <p className="text-sm text-zinc-500 mb-4">
                      To clone private repositories and enable Git push/pull,
                      connect your GitHub account in settings.
                    </p>
                    <Button
                      type="button"
                      onClick={() => router.push("/dashboard/settings")}
                      variant="outline"
                      className="border-zinc-700 hover:bg-zinc-800"
                      size="sm"
                    >
                      <SettingsIcon className="h-4 w-4 mr-2" />
                      Go to Settings
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-5 bg-emerald-500/5 border-emerald-500/30">
                <div className="flex items-center gap-3 mb-4">
                  <Check className="h-5 w-5 text-emerald-500" />
                  <div className="flex items-center gap-2">
                    {githubUser?.avatarUrl && (
                      <img
                        src={githubUser.avatarUrl}
                        alt={githubUser.username}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <span className="text-sm text-emerald-400 font-medium">
                      Connected as @{githubUser?.username}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500">
                  You can now clone private repositories and push changes
                </p>
              </Card>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Repository URL or owner/repo (optional)
                </label>
                <Input
                  value={formData.githubRepo}
                  onChange={(e) =>
                    setFormData({ ...formData, githubRepo: e.target.value })
                  }
                  placeholder="username/repository"
                  className="bg-zinc-900 border-zinc-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 h-12 text-base"
                />
                <p className="text-xs text-zinc-500 mt-2">
                  Leave empty to start with a blank workspace
                </p>
              </div>

              {githubConnected && (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowRepoSelector(!showRepoSelector);
                      if (!showRepoSelector && repos.length === 0) {
                        fetchRepos();
                      }
                    }}
                    className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                  >
                    {showRepoSelector ? "Hide" : "Browse"} My Repositories
                  </Button>

                  {showRepoSelector && (
                    <Card className="mt-3 p-4 bg-zinc-950/50 border-zinc-800 max-h-64 overflow-y-auto">
                      <div className="mb-3">
                        <Input
                          value={repoSearch}
                          onChange={(e) => setRepoSearch(e.target.value)}
                          placeholder="Search repositories..."
                          className="bg-zinc-900 border-zinc-800 h-9 text-sm"
                        />
                      </div>
                      {loadingRepos ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 text-zinc-600 animate-spin" />
                        </div>
                      ) : repos.length === 0 ? (
                        <p className="text-sm text-zinc-500 text-center py-8">
                          No repositories found
                        </p>
                      ) : filteredRepos.length === 0 ? (
                        <p className="text-sm text-zinc-500 text-center py-8">
                          No repositories match your search
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {filteredRepos.map((repo) => (
                            <div
                              key={repo.id}
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  githubRepo: repo.fullName,
                                });
                                setShowRepoSelector(false);
                              }}
                              className="p-3 rounded-lg border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900/50 cursor-pointer transition-all"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium text-zinc-200 truncate">
                                      {repo.name}
                                    </p>
                                    {repo.private && (
                                      <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-xs">
                                        Private
                                      </Badge>
                                    )}
                                  </div>
                                  {repo.description && (
                                    <p className="text-xs text-zinc-500 line-clamp-1">
                                      {repo.description}
                                    </p>
                                  )}
                                  <p className="text-xs text-zinc-600 mt-1">
                                    {repo.fullName}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-zinc-100 mb-2">
                Review and create
              </h2>
              <p className="text-zinc-500">
                Double-check your configuration before creating the workspace
              </p>
            </div>

            <div className="space-y-5">
              <Card className="p-5 bg-zinc-900/30 border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-zinc-400">
                    Basic Information
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(1)}
                    className="h-7 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Edit
                  </Button>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-zinc-500">Name</p>
                    <p className="text-sm text-zinc-200 font-medium">
                      {formData.name}
                    </p>
                  </div>
                  {formData.description && (
                    <div>
                      <p className="text-xs text-zinc-500">Description</p>
                      <p className="text-sm text-zinc-300">
                        {formData.description}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-5 bg-zinc-900/30 border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-zinc-400">
                    Template
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(2)}
                    className="h-7 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Edit
                  </Button>
                </div>
                <div>
                  <p className="text-sm text-zinc-200 font-medium">
                    {templates.find((t) => t.id === formData.template)?.name}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {templates.find((t) => t.id === formData.template)?.desc}
                  </p>
                </div>
              </Card>

              <Card className="p-5 bg-zinc-900/30 border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-zinc-400">
                    GitHub Repository
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(3)}
                    className="h-7 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Edit
                  </Button>
                </div>
                <div>
                  {formData.githubRepo ? (
                    <div className="flex items-center gap-2">
                      <Github className="h-4 w-4 text-zinc-500" />
                      <p className="text-sm text-zinc-200 font-medium">
                        {formData.githubRepo}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      No repository selected
                    </p>
                  )}
                </div>
              </Card>

              <Card className="p-5 bg-zinc-900/30 border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-zinc-400">
                    VS Code Preset
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(2)}
                    className="h-7 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Edit
                  </Button>
                </div>
                <div>
                  {formData.customPresetId ? (
                    <>
                      <p className="text-sm text-zinc-200 font-medium">
                        {
                          userPresets.find(
                            (p) => p.id === formData.customPresetId
                          )?.name
                        }
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {userPresets.find(
                          (p) => p.id === formData.customPresetId
                        )?.description || "Custom preset"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-zinc-200 font-medium">
                        {presets.find((p) => p.id === formData.preset)?.name}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {presets.find((p) => p.id === formData.preset)?.desc}
                      </p>
                    </>
                  )}
                </div>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none" />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar with Progress */}
        <div className="border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-sm">
          <div className="px-6 py-4">
            <h1 className="text-lg font-medium text-zinc-100 mb-4">
              Create New Workspace
            </h1>
            {/* Progress Steps */}
            <div className="flex items-center gap-2">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg flex-1 transition-all ${
                        isActive
                          ? "bg-emerald-500/10 border border-emerald-500/30"
                          : isCompleted
                          ? "bg-zinc-800/30"
                          : "bg-zinc-900/30"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-6 h-6 rounded-full ${
                          isActive
                            ? "bg-emerald-500 text-white"
                            : isCompleted
                            ? "bg-emerald-600/20 text-emerald-400"
                            : "bg-zinc-800 text-zinc-600"
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <StepIcon className="h-3 w-3" />
                        )}
                      </div>
                      <span
                        className={`text-sm font-medium hidden sm:block ${
                          isActive
                            ? "text-emerald-400"
                            : isCompleted
                            ? "text-zinc-400"
                            : "text-zinc-600"
                        }`}
                      >
                        {step.name}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <ChevronRight className="h-4 w-4 text-zinc-700 mx-1 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            <Card className="p-10 bg-zinc-900/40 border-zinc-800/50 backdrop-blur-sm">
              {/* Step Content */}
              {renderStepContent()}

              {/* Navigation Buttons */}
              <div className="flex gap-3 mt-10 pt-8 border-t border-zinc-800/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 1 || loading}
                  className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>

                {currentStep < steps.length ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceed() || loading}
                    className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Workspace...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Create Workspace
                      </>
                    )}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push("/dashboard")}
                  disabled={loading}
                  className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                >
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

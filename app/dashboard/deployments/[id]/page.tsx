"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sidebar } from "@/components/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Rocket,
  ArrowLeft,
  Play,
  StopCircle,
  Trash2,
  Loader2,
  Settings,
  Globe,
  GitBranch,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Github,
  Code,
  Terminal,
  FolderOpen,
} from "lucide-react";
import { DeploymentTerminalInline } from "@/components/deployments/deployment-terminal-inline";
import { DeploymentFileManagerInline } from "@/components/deployments/deployment-file-manager-inline";

interface Deployment {
  id: string;
  name: string;
  description?: string;
  githubRepo?: string;
  githubBranch?: string;
  rootDirectory?: string;
  buildCommand?: string;
  startCommand: string;
  installCommand?: string;
  workingDir?: string;
  port: number;
  envVars?: string;
  status: string;
  subdomain?: string;
  customDomain?: string;
  exposedPort?: number;
  autoRebuild: boolean;
  framework?: string;
  containerId?: string;
  lastDeployedAt?: string;
  createdAt: string;
  domain?: {
    id: string;
    domain: string;
    verified: boolean;
  };
  workspace?: {
    id: string;
    name: string;
    status: string;
  };
  builds: Build[];
}

interface Build {
  id: string;
  status: string;
  trigger: string;
  startedAt: string;
  completedAt?: string;
  logs?: string;
}

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
}

export default function DeploymentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deploymentId = params.id as string;

  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "builds" | "settings" | "domains" | "terminal" | "files"
  >("overview");
  const [deploying, setDeploying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stoppingBuild, setStoppingBuild] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [buildLogs, setBuildLogs] = useState<
    Array<{ message: string; timestamp: Date }>
  >([]);
  const [showBuildLogs, setShowBuildLogs] = useState(false);
  const [currentBuildId, setCurrentBuildId] = useState<string | null>(null);
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);
  const [selectedBuildLogs, setSelectedBuildLogs] = useState<string>("");
  const [selectedBuildStatus, setSelectedBuildStatus] = useState<string>("");
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const selectedLogsContainerRef = useRef<HTMLDivElement>(null);

  // Settings form state
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedBuildCommand, setEditedBuildCommand] = useState("");
  const [editedStartCommand, setEditedStartCommand] = useState("");
  const [editedInstallCommand, setEditedInstallCommand] = useState("");
  const [editedPort, setEditedPort] = useState("");
  const [editedEnvVars, setEditedEnvVars] = useState("");
  const [editedSubdomain, setEditedSubdomain] = useState("");
  const [editedDomainId, setEditedDomainId] = useState("");
  const [editedAutoRebuild, setEditedAutoRebuild] = useState(false);
  const [saving, setSaving] = useState(false);

  // Define fetchBuilds early so it can be used in useEffects
  const fetchBuilds = useCallback(async () => {
    try {
      const res = await fetch(`/api/deployments/${deploymentId}/builds`);
      if (res.ok) {
        const data = await res.json();
        setBuilds(data.builds || []);
      }
    } catch (error) {
      console.error("Error fetching builds:", error);
    }
  }, [deploymentId]);

  useEffect(() => {
    fetchDeployment();
    fetchDomains();
  }, [deploymentId]);

  // Check for in-progress builds and show their logs
  useEffect(() => {
    const checkForActiveBuild = async () => {
      try {
        const res = await fetch(`/api/deployments/${deploymentId}/builds`);
        if (res.ok) {
          const data = await res.json();
          const activeBuild = data.builds.find(
            (b: any) => b.status === "BUILDING"
          );

          if (activeBuild && activeBuild.logs) {
            // Parse logs and show them
            const logLines = activeBuild.logs
              .split("\n")
              .filter((line: string) => line.trim());
            const parsedLogs = logLines.map((line: string) => ({
              message: line,
              timestamp: new Date(), // Use current time since we don't have exact timestamps
            }));

            setBuildLogs(parsedLogs);
            setShowBuildLogs(true);
            setActiveTab("builds");
            setDeploying(true);
            setCurrentBuildId(activeBuild.id); // Set the current build ID for stop functionality

            console.log("🔄 Restored in-progress build logs");
          }
        }
      } catch (error) {
        console.error("Error checking for active build:", error);
      }
    };

    checkForActiveBuild();
  }, [deploymentId]);

  // Poll for live build logs if deploying
  useEffect(() => {
    if (!deploying) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/deployments/${deploymentId}/builds`);
        if (res.ok) {
          const data = await res.json();
          const activeBuild = data.builds.find(
            (b: any) => b.status === "BUILDING"
          );

          if (activeBuild && activeBuild.logs) {
            // Parse logs and update
            const logLines = activeBuild.logs
              .split("\n")
              .filter((line: string) => line.trim());
            const parsedLogs = logLines.map((line: string) => ({
              message: line,
              timestamp: new Date(),
            }));

            setBuildLogs(parsedLogs);
          } else {
            // Build finished, stop polling
            setDeploying(false);
            await fetchDeployment();
            await fetchBuilds();
          }
        }
      } catch (error) {
        console.error("Error polling live build logs:", error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [deploying, deploymentId, fetchBuilds]);

  // Auto-scroll to bottom when new logs arrive (live logs)
  useEffect(() => {
    if (showBuildLogs && logsContainerRef.current) {
      logsContainerRef.current.scrollTop =
        logsContainerRef.current.scrollHeight;
    }
  }, [buildLogs, showBuildLogs]);

  // Auto-scroll for selected build logs
  useEffect(() => {
    if (selectedBuildId && selectedLogsContainerRef.current) {
      selectedLogsContainerRef.current.scrollTop =
        selectedLogsContainerRef.current.scrollHeight;
    }
  }, [selectedBuildLogs, selectedBuildId]);

  // Poll for logs if selected build is in BUILDING status
  useEffect(() => {
    if (!selectedBuildId || selectedBuildStatus !== "BUILDING") {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/deployments/${deploymentId}/builds`);
        if (response.ok) {
          const data = await response.json();
          const selectedBuild = data.builds.find(
            (b: any) => b.id === selectedBuildId
          );

          if (selectedBuild) {
            setSelectedBuildLogs(
              selectedBuild.logs || "Building... logs will appear shortly."
            );
            setSelectedBuildStatus(selectedBuild.status);

            // If build finished, refresh the builds list
            if (selectedBuild.status !== "BUILDING") {
              fetchBuilds();
            }
          }
        }
      } catch (error) {
        console.error("Error polling build logs:", error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [selectedBuildId, selectedBuildStatus, deploymentId, fetchBuilds]);

  useEffect(() => {
    if (deployment) {
      setEditedName(deployment.name);
      setEditedDescription(deployment.description || "");
      setEditedBuildCommand(deployment.buildCommand || "");
      setEditedStartCommand(deployment.startCommand);
      setEditedInstallCommand(deployment.installCommand || "");
      setEditedPort(deployment.port.toString());
      setEditedEnvVars(deployment.envVars || "");
      setEditedSubdomain(deployment.subdomain || "");
      setEditedDomainId(deployment.domain?.id || "");
      setEditedAutoRebuild(deployment.autoRebuild);
    }
  }, [deployment]);

  const fetchDeployment = async () => {
    try {
      const res = await fetch(`/api/deployments/${deploymentId}`);
      if (res.ok) {
        const data = await res.json();
        setDeployment(data.deployment);
        setBuilds(data.deployment.builds || []);
      } else {
        router.push("/dashboard/deployments");
      }
    } catch (error) {
      console.error("Error fetching deployment:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDomains = async () => {
    try {
      const res = await fetch("/api/domains");
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains || []);
      }
    } catch (error) {
      console.error("Error fetching domains:", error);
    }
  };

  const handleStopBuild = async () => {
    if (!currentBuildId) return;

    setStoppingBuild(true);
    try {
      const res = await fetch(
        `/api/deployments/${deploymentId}/builds/${currentBuildId}/stop`,
        {
          method: "POST",
        }
      );

      if (res.ok) {
        setDeploying(false);
        setCurrentBuildId(null);
        await fetchDeployment();
        await fetchBuilds();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to stop build");
      }
    } catch (error) {
      console.error("Error stopping build:", error);
      alert("Failed to stop build");
    } finally {
      setStoppingBuild(false);
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setBuildLogs([]);
    setShowBuildLogs(true);
    setActiveTab("builds");

    try {
      const res = await fetch(`/api/deployments/${deploymentId}/deploy`, {
        method: "POST",
      });

      if (!res.ok) {
        setBuildLogs((prev) => [
          ...prev,
          { message: "❌ Failed to start deployment", timestamp: new Date() },
        ]);
        setDeploying(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setBuildLogs((prev) => [
          ...prev,
          { message: "❌ No response stream available", timestamp: new Date() },
        ]);
        setDeploying(false);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              const timestamp = new Date();

              if (data.type === "buildId") {
                setCurrentBuildId(data.buildId);
              } else if (data.type === "log") {
                setBuildLogs((prev) => [
                  ...prev,
                  { message: data.message, timestamp },
                ]);
              } else if (data.type === "status") {
                setBuildLogs((prev) => [
                  ...prev,
                  { message: `📋 ${data.message}`, timestamp },
                ]);
              } else if (data.type === "complete") {
                setBuildLogs((prev) => [
                  ...prev,
                  { message: `✅ ${data.message}`, timestamp },
                ]);
                setCurrentBuildId(null);
                await fetchDeployment();
              } else if (data.type === "error") {
                setBuildLogs((prev) => [
                  ...prev,
                  { message: `❌ Error: ${data.message}`, timestamp },
                ]);
                setCurrentBuildId(null);
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      console.error("Error deploying:", error);
      setBuildLogs((prev) => [
        ...prev,
        {
          message: `❌ Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setDeploying(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      const res = await fetch(`/api/deployments/${deploymentId}/stop`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchDeployment();
      } else {
        alert("Failed to stop deployment");
      }
    } catch (error) {
      console.error("Error stopping:", error);
      alert("Failed to stop deployment");
    } finally {
      setStopping(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this deployment?")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/deployments/${deploymentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/dashboard/deployments");
      } else {
        alert("Failed to delete deployment");
      }
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Failed to delete deployment");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/deployments/${deploymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedName,
          description: editedDescription,
          buildCommand: editedBuildCommand,
          startCommand: editedStartCommand,
          installCommand: editedInstallCommand,
          port: editedPort,
          envVars: editedEnvVars,
          subdomain: editedSubdomain,
          domainId: editedDomainId || null,
          autoRebuild: editedAutoRebuild,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDeployment(data.deployment);
        alert("Settings saved successfully");
      } else {
        alert("Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "RUNNING":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "BUILDING":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "DEPLOYING":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "STOPPED":
        return "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
      case "ERROR":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      case "SUCCESS":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "FAILED":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      case "CANCELLED":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      default:
        return "bg-zinc-800/80 text-zinc-400 border-zinc-700/50";
    }
  };

  const getDeploymentUrl = () => {
    if (!deployment) return null;
    if (deployment.domain && deployment.subdomain) {
      return `https://${deployment.subdomain}.${deployment.domain.domain}`;
    } else if (deployment.exposedPort) {
      return `http://localhost:${deployment.exposedPort}`;
    }
    return null;
  };

  if (loading || !deployment) {
    return (
      <div className="flex h-screen bg-zinc-950 items-center justify-center">
        <Loader2 className="h-12 w-12 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden relative">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none -z-10" />

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Header */}
        <div className="border-b border-zinc-800/50 px-6 py-4 bg-zinc-950/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/deployments")}
                className="border-zinc-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Rocket className="h-5 w-5 text-emerald-400" />
              <h1 className="text-lg font-medium text-zinc-100">
                {deployment.name}
              </h1>
              <Badge className={`${getStatusColor(deployment.status)} text-xs`}>
                {deployment.status}
              </Badge>
              {deployment.workspace && (
                <Badge
                  variant="outline"
                  className="bg-zinc-900/50 border-zinc-800 text-zinc-400 text-xs"
                >
                  Workspace: {deployment.workspace.name}
                </Badge>
              )}
              {deployment.githubRepo && (
                <Badge
                  variant="outline"
                  className="bg-zinc-900/50 border-zinc-800 text-zinc-400 text-xs"
                >
                  Standalone
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeploy}
                disabled={deploying || deployment.status === "RUNNING"}
                className="border-zinc-800"
              >
                {deploying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Deploy
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleStop}
                disabled={stopping || deployment.status === "STOPPED"}
                className="border-zinc-800"
              >
                {stopping ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <StopCircle className="h-4 w-4 mr-2" />
                )}
                Stop
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                disabled={deleting}
                className="border-zinc-800 hover:bg-red-500/20 hover:border-red-500/40 text-zinc-500 hover:text-red-400"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
            </div>
          </div>

          {/* URL */}
          {getDeploymentUrl() && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-zinc-500" />
              <a
                href={getDeploymentUrl()!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                {getDeploymentUrl()}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "overview"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Activity className="h-4 w-4 inline mr-2" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab("builds")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "builds"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <RefreshCw className="h-4 w-4 inline mr-2" />
              Builds ({builds.length})
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "settings"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Settings className="h-4 w-4 inline mr-2" />
              Settings
            </button>
            <button
              onClick={() => setActiveTab("domains")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "domains"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Globe className="h-4 w-4 inline mr-2" />
              Domains
            </button>
            <button
              onClick={() => setActiveTab("terminal")}
              disabled={deployment.status !== "RUNNING"}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                deployment.status !== "RUNNING"
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              } ${
                activeTab === "terminal"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
              title={
                deployment.status !== "RUNNING"
                  ? "Start deployment to use terminal"
                  : ""
              }
            >
              <Terminal className="h-4 w-4 inline mr-2" />
              Terminal
            </button>
            <button
              onClick={() => setActiveTab("files")}
              disabled={deployment.status !== "RUNNING"}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                deployment.status !== "RUNNING"
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              } ${
                activeTab === "files"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
              title={
                deployment.status !== "RUNNING"
                  ? "Start deployment to browse files"
                  : ""
              }
            >
              <FolderOpen className="h-4 w-4 inline mr-2" />
              Files
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Deployment Info */}
                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                    Deployment Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-zinc-500 mb-1">Status</p>
                      <Badge className={getStatusColor(deployment.status)}>
                        {deployment.status}
                      </Badge>
                    </div>
                    {deployment.githubRepo && (
                      <>
                        <div>
                          <p className="text-sm text-zinc-500 mb-1">
                            GitHub Repository
                          </p>
                          <div className="flex items-center gap-2 text-sm text-zinc-300">
                            <Github className="h-4 w-4" />
                            {deployment.githubRepo}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500 mb-1">Branch</p>
                          <div className="flex items-center gap-2 text-sm text-zinc-300">
                            <GitBranch className="h-4 w-4" />
                            {deployment.githubBranch}
                          </div>
                        </div>
                      </>
                    )}
                    <div>
                      <p className="text-sm text-zinc-500 mb-1">Framework</p>
                      <p className="text-sm text-zinc-300">
                        {deployment.framework || "None"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500 mb-1">Port</p>
                      <p className="text-sm text-zinc-300">{deployment.port}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500 mb-1">Created</p>
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <Clock className="h-4 w-4" />
                        {new Date(deployment.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {deployment.lastDeployedAt && (
                      <div>
                        <p className="text-sm text-zinc-500 mb-1">
                          Last Deployed
                        </p>
                        <div className="flex items-center gap-2 text-sm text-zinc-300">
                          <Clock className="h-4 w-4" />
                          {new Date(deployment.lastDeployedAt).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                  {deployment.description && (
                    <div className="mt-4">
                      <p className="text-sm text-zinc-500 mb-1">Description</p>
                      <p className="text-sm text-zinc-300">
                        {deployment.description}
                      </p>
                    </div>
                  )}
                </Card>

                {/* Commands */}
                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Commands
                  </h3>
                  <div className="space-y-3">
                    {deployment.installCommand && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">
                          Install Command
                        </p>
                        <code className="text-sm text-zinc-300 bg-zinc-900/80 px-3 py-2 rounded block">
                          {deployment.installCommand}
                        </code>
                      </div>
                    )}
                    {deployment.buildCommand && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">
                          Build Command
                        </p>
                        <code className="text-sm text-zinc-300 bg-zinc-900/80 px-3 py-2 rounded block">
                          {deployment.buildCommand}
                        </code>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">
                        Start Command
                      </p>
                      <code className="text-sm text-zinc-300 bg-zinc-900/80 px-3 py-2 rounded block">
                        {deployment.startCommand}
                      </code>
                    </div>
                  </div>
                </Card>

                {/* Quick Actions */}
                {deployment.status === "RUNNING" && (
                  <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                      Quick Actions
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab("terminal")}
                        className="border-zinc-800 justify-start"
                      >
                        <Terminal className="h-4 w-4 mr-2 text-emerald-400" />
                        Open Terminal
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab("files")}
                        className="border-zinc-800 justify-start"
                      >
                        <FolderOpen className="h-4 w-4 mr-2 text-blue-400" />
                        Browse Files
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Latest Build */}
                {builds.length > 0 && (
                  <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                      Latest Build
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge className={getStatusColor(builds[0].status)}>
                          {builds[0].status}
                        </Badge>
                        <p className="text-sm text-zinc-400 mt-2">
                          Triggered by {builds[0].trigger}
                        </p>
                        <p className="text-xs text-zinc-600 mt-1">
                          {new Date(builds[0].startedAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveTab("builds")}
                        className="border-zinc-800"
                      >
                        View All Builds
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* Builds Tab */}
            {activeTab === "builds" && (
              <div className="space-y-4">
                {/* Live Build Logs */}
                {showBuildLogs && buildLogs.length > 0 && (
                  <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-5 w-5 text-emerald-400" />
                        <h3 className="text-lg font-semibold text-zinc-100">
                          Live Build Logs
                        </h3>
                        {deploying && (
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                            Building...
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {deploying && currentBuildId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleStopBuild}
                            disabled={stoppingBuild}
                            className="border-red-800 hover:bg-red-500/20 hover:border-red-500/40 text-red-400"
                          >
                            {stoppingBuild ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Stopping...
                              </>
                            ) : (
                              <>
                                <StopCircle className="h-4 w-4 mr-2" />
                                Stop Build
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowBuildLogs(false);
                            setBuildLogs([]);
                            setCurrentBuildId(null);
                          }}
                          className="border-zinc-800"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <div
                      ref={logsContainerRef}
                      className="bg-black/50 rounded-lg p-4 max-h-[500px] overflow-y-auto font-mono text-sm scroll-smooth"
                    >
                      {buildLogs.length === 0 && !deploying && (
                        <div className="text-zinc-600 text-center py-8">
                          No logs yet. Click Deploy to start.
                        </div>
                      )}
                      {buildLogs.map((log, index) => {
                        // Determine log color based on content
                        let logColor = "text-zinc-300";
                        if (log.message.startsWith("❌")) {
                          logColor = "text-red-400";
                        } else if (log.message.startsWith("✅")) {
                          logColor = "text-emerald-400";
                        } else if (log.message.startsWith("📋")) {
                          logColor = "text-blue-400";
                        } else if (log.message.startsWith("⚠️")) {
                          logColor = "text-amber-400";
                        } else if (
                          log.message.includes("ERROR") ||
                          log.message.includes("error")
                        ) {
                          logColor = "text-red-400";
                        } else if (
                          log.message.includes("SUCCESS") ||
                          log.message.includes("success")
                        ) {
                          logColor = "text-emerald-400";
                        } else if (
                          log.message.includes("WARNING") ||
                          log.message.includes("warning")
                        ) {
                          logColor = "text-amber-400";
                        }

                        return (
                          <div
                            key={index}
                            className={`${logColor} py-0.5 whitespace-pre-wrap break-all leading-relaxed`}
                          >
                            <span className="text-zinc-600 mr-2 select-none">
                              [{log.timestamp.toLocaleTimeString()}]
                            </span>
                            {log.message}
                          </div>
                        );
                      })}
                      {deploying && (
                        <div className="flex items-center gap-2 text-blue-400 mt-2 animate-pulse">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Streaming logs...</span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Build History */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-zinc-100">
                    Build History
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchDeployment}
                    className="border-zinc-800"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                {builds.length === 0 ? (
                  <Card className="p-12 text-center bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50">
                    <RefreshCw className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-500">No builds yet</p>
                  </Card>
                ) : (
                  builds.map((build) => (
                    <Card
                      key={build.id}
                      className="bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl overflow-hidden"
                    >
                      <div
                        onClick={() => {
                          if (selectedBuildId === build.id) {
                            setSelectedBuildId(null);
                            setSelectedBuildLogs("");
                            setSelectedBuildStatus("");
                          } else {
                            setSelectedBuildId(build.id);
                            setSelectedBuildStatus(build.status);
                            setSelectedBuildLogs(
                              build.logs ||
                                (build.status === "BUILDING"
                                  ? "Building... logs will appear shortly."
                                  : "No logs available")
                            );
                          }
                        }}
                        className="p-6"
                      >
                        <div className="flex items-start justify-between">
                          <div
                            className="flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              if (selectedBuildId === build.id) {
                                setSelectedBuildId(null);
                                setSelectedBuildLogs("");
                                setSelectedBuildStatus("");
                              } else {
                                setSelectedBuildId(build.id);
                                setSelectedBuildStatus(build.status);
                                setSelectedBuildLogs(
                                  build.logs ||
                                    (build.status === "BUILDING"
                                      ? "Building... logs will appear shortly."
                                      : "No logs available")
                                );
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className={getStatusColor(build.status)}>
                                {build.status}
                              </Badge>
                              <span className="text-sm text-zinc-400">
                                Triggered by {build.trigger}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-zinc-600">
                              <span>
                                Started:{" "}
                                {new Date(build.startedAt).toLocaleString()}
                              </span>
                              {build.completedAt && (
                                <span>
                                  Completed:{" "}
                                  {new Date(build.completedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 mt-2">
                              Click to{" "}
                              {selectedBuildId === build.id ? "hide" : "view"}{" "}
                              logs
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {build.status === "BUILDING" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setStoppingBuild(true);
                                    try {
                                      const res = await fetch(
                                        `/api/deployments/${deploymentId}/builds/${build.id}/stop`,
                                        { method: "POST" }
                                      );
                                      if (res.ok) {
                                        await fetchBuilds();
                                        await fetchDeployment();
                                        if (currentBuildId === build.id) {
                                          setDeploying(false);
                                          setCurrentBuildId(null);
                                        }
                                      } else {
                                        const data = await res.json();
                                        alert(
                                          data.error || "Failed to stop build"
                                        );
                                      }
                                    } catch (error) {
                                      console.error(
                                        "Error stopping build:",
                                        error
                                      );
                                      alert("Failed to stop build");
                                    } finally {
                                      setStoppingBuild(false);
                                    }
                                  }}
                                  disabled={stoppingBuild}
                                  className="border-red-800 hover:bg-red-500/20 hover:border-red-500/40 text-red-400"
                                >
                                  {stoppingBuild ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <StopCircle className="h-4 w-4" />
                                  )}
                                </Button>
                                <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                              </>
                            )}
                            {build.status === "SUCCESS" && (
                              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            )}
                            {build.status === "FAILED" && (
                              <XCircle className="h-5 w-5 text-red-400" />
                            )}
                            {build.status === "CANCELLED" && (
                              <StopCircle className="h-5 w-5 text-amber-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Build Logs */}
                      {selectedBuildId === build.id && (
                        <div className="border-t border-zinc-800/50 bg-black/30 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                              <Terminal className="h-4 w-4" />
                              Build Logs
                              {selectedBuildStatus === "BUILDING" && (
                                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 ml-2">
                                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                  Live
                                </Badge>
                              )}
                            </h4>
                          </div>
                          <div
                            ref={selectedLogsContainerRef}
                            className="bg-black/50 rounded-lg p-4 max-h-[400px] overflow-y-auto font-mono text-xs scroll-smooth"
                          >
                            {selectedBuildLogs
                              .split("\n")
                              .map((line, index) => {
                                let logColor = "text-zinc-300";
                                if (
                                  line.includes("❌") ||
                                  line.includes("ERROR") ||
                                  line.includes("Error")
                                ) {
                                  logColor = "text-red-400";
                                } else if (
                                  line.includes("✅") ||
                                  line.includes("SUCCESS")
                                ) {
                                  logColor = "text-emerald-400";
                                } else if (
                                  line.includes("📋") ||
                                  line.includes("Starting")
                                ) {
                                  logColor = "text-blue-400";
                                } else if (
                                  line.includes("⚠️") ||
                                  line.includes("WARNING")
                                ) {
                                  logColor = "text-amber-400";
                                }

                                return (
                                  <div
                                    key={index}
                                    className={`${logColor} py-0.5`}
                                  >
                                    {line || " "}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                    General Settings
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Name
                      </label>
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Description
                      </label>
                      <Input
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                    Build & Start Commands
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Install Command
                      </label>
                      <Input
                        value={editedInstallCommand}
                        onChange={(e) =>
                          setEditedInstallCommand(e.target.value)
                        }
                        placeholder="npm install"
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Build Command
                      </label>
                      <Input
                        value={editedBuildCommand}
                        onChange={(e) => setEditedBuildCommand(e.target.value)}
                        placeholder="npm run build"
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Start Command *
                      </label>
                      <Input
                        value={editedStartCommand}
                        onChange={(e) => setEditedStartCommand(e.target.value)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Port *
                      </label>
                      <Input
                        type="number"
                        value={editedPort}
                        onChange={(e) => setEditedPort(e.target.value)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                    Environment Variables
                  </h3>
                  <textarea
                    value={editedEnvVars}
                    onChange={(e) => setEditedEnvVars(e.target.value)}
                    placeholder="KEY1=value1&#10;KEY2=value2"
                    className="w-full min-h-[150px] px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 resize-none"
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    One variable per line in KEY=value format
                  </p>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                    Auto-Rebuild
                  </h3>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={editedAutoRebuild}
                      onChange={(e) => setEditedAutoRebuild(e.target.checked)}
                      className="rounded border-zinc-700"
                      id="auto-rebuild"
                    />
                    <label
                      htmlFor="auto-rebuild"
                      className="text-sm text-zinc-300 cursor-pointer"
                    >
                      Automatically rebuild on Git push
                    </label>
                  </div>
                </Card>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-500"
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
                </div>
              </div>
            )}

            {/* Terminal Tab */}
            {activeTab === "terminal" && (
              <DeploymentTerminalInline
                deploymentId={deployment.id}
                deploymentName={deployment.name}
              />
            )}

            {/* Files Tab */}
            {activeTab === "files" && (
              <DeploymentFileManagerInline
                deploymentId={deployment.id}
                deploymentName={deployment.name}
              />
            )}

            {/* Domains Tab */}
            {activeTab === "domains" && (
              <div className="space-y-6">
                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                    Domain Configuration
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Domain
                      </label>
                      <Select
                        value={editedDomainId}
                        onValueChange={setEditedDomainId}
                      >
                        <SelectTrigger className="bg-zinc-900 border-zinc-800">
                          <SelectValue placeholder="None (use port mapping)" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          <SelectItem value="no">
                            None (use port mapping)
                          </SelectItem>
                          {domains
                            .filter((d) => d.verified)
                            .map((domain) => (
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
                    {editedDomainId && (
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          Subdomain
                        </label>
                        <Input
                          value={editedSubdomain}
                          onChange={(e) => setEditedSubdomain(e.target.value)}
                          placeholder="my-app"
                          className="bg-zinc-900 border-zinc-800"
                        />
                        <p className="text-xs text-zinc-500 mt-1">
                          Your app will be available at{" "}
                          {editedSubdomain || "subdomain"}.
                          {domains.find((d) => d.id === editedDomainId)
                            ?.domain || "domain.com"}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button
                      onClick={handleSaveSettings}
                      disabled={saving}
                      className="bg-emerald-600 hover:bg-emerald-500"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Domain Settings"
                      )}
                    </Button>
                  </div>
                </Card>

                {/* Current Domain Info */}
                {deployment.domain && deployment.subdomain && (
                  <Card className="p-6 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 backdrop-blur-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <h4 className="text-sm font-semibold text-emerald-300">
                        Domain Connected
                      </h4>
                    </div>
                    <p className="text-sm text-zinc-300">
                      Your deployment is live at:{" "}
                      <a
                        href={`https://${deployment.subdomain}.${deployment.domain.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300"
                      >
                        {deployment.subdomain}.{deployment.domain.domain}
                      </a>
                    </p>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

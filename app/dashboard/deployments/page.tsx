"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/sidebar";
import {
  Rocket,
  ExternalLink,
  Loader2,
  Play,
  Square,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileCode,
  Globe,
  Plus,
  GitBranch,
} from "lucide-react";
import { NewDeploymentDialog } from "@/components/deployments/new-deployment-dialog";
import { NotificationBell } from "@/components/workspace/notification-bell";

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
}

interface Workspace {
  id: string;
  name: string;
  status: string;
}

interface Build {
  id: string;
  status: "PENDING" | "BUILDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  commitHash?: string;
  commitMessage?: string;
  createdAt: string;
}

interface Deployment {
  id: string;
  name: string;
  description?: string;
  githubRepo?: string;
  githubBranch?: string;
  status:
    | "STOPPED"
    | "BUILDING"
    | "DEPLOYING"
    | "RUNNING"
    | "STOPPING"
    | "ERROR";
  subdomain?: string;
  domain?: Domain;
  exposedPort?: number;
  lastDeployedAt?: string;
  createdAt: string;
  workspace?: Workspace;
  builds?: Build[];
}

export default function DeploymentsPage() {
  const router = useRouter();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningDeployment, setActioningDeployment] = useState<string | null>(
    null
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    fetchAllDeployments();
  }, []);

  const fetchAllDeployments = async () => {
    try {
      // Fetch all deployments (standalone + workspace-based)
      const deploymentsRes = await fetch("/api/deployments");
      if (!deploymentsRes.ok) throw new Error("Failed to fetch deployments");

      const data = await deploymentsRes.json();
      setDeployments(data.deployments || []);
    } catch (error) {
      console.error("Error fetching deployments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeploymentAction = async (
    deploymentId: string,
    action: "start" | "stop"
  ) => {
    setActioningDeployment(deploymentId);
    try {
      const endpoint = action === "start" ? "deploy" : "stop";
      const res = await fetch(`/api/deployments/${deploymentId}/${endpoint}`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchAllDeployments();
      } else {
        const error = await res.json();
        alert(error.error || `Failed to ${action} deployment`);
      }
    } catch (error) {
      console.error(`Error ${action}ing deployment:`, error);
      alert(`Failed to ${action} deployment`);
    } finally {
      setActioningDeployment(null);
    }
  };

  const handleDeleteDeployment = async (deploymentId: string) => {
    if (!confirm("Are you sure you want to delete this deployment?")) return;

    try {
      const res = await fetch(`/api/deployments/${deploymentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchAllDeployments();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to delete deployment");
      }
    } catch (error) {
      console.error("Error deleting deployment:", error);
      alert("Failed to delete deployment");
    }
  };

  const getStatusIcon = (status: Deployment["status"]) => {
    switch (status) {
      case "RUNNING":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "BUILDING":
      case "DEPLOYING":
      case "STOPPING":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "ERROR":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "STOPPED":
        return <AlertCircle className="h-4 w-4 text-zinc-500" />;
    }
  };

  const getStatusColor = (status: Deployment["status"]) => {
    switch (status) {
      case "RUNNING":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "BUILDING":
      case "DEPLOYING":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "STOPPING":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "ERROR":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "STOPPED":
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
  };

  const getDeploymentUrl = (deployment: Deployment) => {
    if (deployment.domain && deployment.subdomain) {
      return `https://${deployment.subdomain}.${deployment.domain.domain}`;
    } else if (deployment.exposedPort) {
      return `http://localhost:${deployment.exposedPort}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-zinc-950 overflow-hidden">
        <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none -z-10" />

        <Sidebar />

        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none -z-10" />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="border-b border-zinc-800/50 flex items-center justify-between px-6 py-4 bg-zinc-950/50 backdrop-blur-sm">
          <div>
            <h1 className="text-lg font-medium text-zinc-100">Deployments</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Manage all your deployed applications
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700">
              {deployments.length}{" "}
              {deployments.length === 1 ? "deployment" : "deployments"}
            </Badge>
            <NotificationBell />
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Deployment
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {deployments.length === 0 ? (
              <Card className="bg-zinc-900/50 border-zinc-800 p-12">
                <div className="text-center">
                  <Rocket className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                    No deployments yet
                  </h3>
                  <p className="text-zinc-500 mb-6">
                    Create a deployment from any workspace to get started
                  </p>
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Deployment
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {deployments.map((deployment) => {
                  const url = getDeploymentUrl(deployment);
                  const latestBuild = deployment.builds?.[0];

                  return (
                    <Card
                      key={deployment.id}
                      onClick={() =>
                        router.push(`/dashboard/deployments/${deployment.id}`)
                      }
                      className="bg-zinc-900/50 border-zinc-800 p-6 hover:border-zinc-700 transition-all cursor-pointer hover:scale-[1.01]"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-zinc-100">
                              {deployment.name}
                            </h3>
                            <Badge
                              className={getStatusColor(deployment.status)}
                            >
                              {getStatusIcon(deployment.status)}
                              <span className="ml-1.5">
                                {deployment.status}
                              </span>
                            </Badge>
                            {deployment.workspace?.status === "STOPPED" && (
                              <Badge variant="secondary" className="text-xs">
                                Workspace Stopped
                              </Badge>
                            )}
                            {deployment.githubRepo && !deployment.workspace && (
                              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                                Standalone
                              </Badge>
                            )}
                          </div>

                          {deployment.description && (
                            <p className="text-sm text-zinc-400 mb-3">
                              {deployment.description}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-sm text-zinc-500 mb-3">
                            {deployment.githubRepo && (
                              <div className="flex items-center gap-1.5">
                                <GitBranch className="h-3.5 w-3.5" />
                                <span>
                                  {deployment.githubRepo}
                                  {deployment.githubBranch &&
                                    ` (${deployment.githubBranch})`}
                                </span>
                              </div>
                            )}
                            {deployment.workspace && (
                              <div className="flex items-center gap-1.5">
                                <FileCode className="h-3.5 w-3.5" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(
                                      `/workspace/${deployment.workspace!.id}`
                                    );
                                  }}
                                  className="hover:text-zinc-300 transition-colors"
                                >
                                  {deployment.workspace.name}
                                </button>
                              </div>
                            )}
                            {deployment.lastDeployedAt && (
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                Last deployed{" "}
                                {new Date(
                                  deployment.lastDeployedAt
                                ).toLocaleDateString()}
                              </div>
                            )}
                          </div>

                          {url && deployment.status === "RUNNING" && (
                            <div className="flex items-center gap-2 mb-3">
                              <Globe className="h-4 w-4 text-zinc-500" />
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                              >
                                {url}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}

                          {latestBuild && (
                            <div className="text-xs text-zinc-600">
                              Latest build: {latestBuild.status}
                              {latestBuild.commitMessage && (
                                <span className="ml-2">
                                  - {latestBuild.commitMessage.substring(0, 50)}
                                  {latestBuild.commitMessage.length > 50 &&
                                    "..."}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          {deployment.status === "RUNNING" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleDeploymentAction(deployment.id, "stop")
                              }
                              disabled={actioningDeployment === deployment.id}
                              className="border-zinc-700 hover:bg-zinc-800"
                            >
                              {actioningDeployment === deployment.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </Button>
                          ) : deployment.status === "STOPPED" ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleDeploymentAction(deployment.id, "start")
                              }
                              disabled={
                                actioningDeployment === deployment.id ||
                                deployment.workspace?.status === "STOPPED"
                              }
                              className="bg-emerald-600 hover:bg-emerald-500 text-white"
                              title={
                                deployment.workspace?.status === "STOPPED"
                                  ? "Start workspace first"
                                  : "Start deployment"
                              }
                            >
                              {actioningDeployment === deployment.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          ) : null}

                          {deployment.workspace && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                router.push(
                                  `/workspace/${
                                    deployment.workspace!.id
                                  }?tab=deployments`
                                )
                              }
                              className="text-zinc-400 hover:text-zinc-100"
                            >
                              View Details
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleDeleteDeployment(deployment.id)
                            }
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Deployment Dialog */}
      <NewDeploymentDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={fetchAllDeployments}
      />
    </div>
  );
}

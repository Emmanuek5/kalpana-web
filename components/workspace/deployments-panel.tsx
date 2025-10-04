"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Play,
  Square,
  Trash2,
  ExternalLink,
  Terminal,
  GitBranch,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  FileText,
  Edit,
  Server,
} from "lucide-react";
import { DeploymentTerminal } from "./deployment-terminal";
import { DeploymentLogs } from "./deployment-logs";

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
  isDefault: boolean;
}

interface Deployment {
  id: string;
  name: string;
  description?: string;
  status:
    | "STOPPED"
    | "BUILDING"
    | "DEPLOYING"
    | "RUNNING"
    | "STOPPING"
    | "ERROR";
  buildCommand?: string;
  startCommand: string;
  workingDir?: string;
  port: number;
  exposedPort?: number;
  subdomain?: string;
  domainId?: string;
  domain?: Domain;
  autoRebuild: boolean;
  webhookSecret?: string;
  lastDeployedAt?: string;
  builds?: Build[];
}

interface Build {
  id: string;
  status: "PENDING" | "BUILDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  commitHash?: string;
  commitMessage?: string;
  branch?: string;
  triggeredBy?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface DeploymentsPanelProps {
  workspaceId: string;
}

export function DeploymentsPanel({ workspaceId }: DeploymentsPanelProps) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDeployment, setEditingDeployment] = useState<Deployment | null>(
    null
  );
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(
    null
  );
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [terminalDeployment, setTerminalDeployment] =
    useState<Deployment | null>(null);
  const [logsDeployment, setLogsDeployment] = useState<Deployment | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [buildCommand, setBuildCommand] = useState("");
  const [startCommand, setStartCommand] = useState("");
  const [workingDir, setWorkingDir] = useState("/workspace");
  const [port, setPort] = useState("3000");
  const [subdomain, setSubdomain] = useState("");
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [autoRebuild, setAutoRebuild] = useState(false);

  useEffect(() => {
    fetchDeployments();
    fetchDomains();
    const interval = setInterval(fetchDeployments, 5000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  const fetchDeployments = async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/deployments`);
      if (res.ok) {
        const data = await res.json();
        setDeployments(data.deployments || []);
      }
    } catch (error) {
      console.error("Error fetching deployments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDomains = async () => {
    try {
      const res = await fetch("/api/domains");
      if (res.ok) {
        const data = await res.json();
        const verifiedDomains = (data.domains || []).filter(
          (d: Domain) => d.verified
        );
        setDomains(verifiedDomains);

        // Set default domain as selected if available
        const defaultDomain = verifiedDomains.find((d: Domain) => d.isDefault);
        if (defaultDomain) {
          setSelectedDomainId(defaultDomain.id);
        }
      }
    } catch (error) {
      console.error("Error fetching domains:", error);
    }
  };

  const createDeployment = async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          buildCommand,
          startCommand,
          workingDir,
          port: parseInt(port),
          subdomain: subdomain || undefined,
          domainId: selectedDomainId || undefined,
          autoRebuild,
        }),
      });

      if (res.ok) {
        await fetchDeployments();
        setShowCreateDialog(false);
        resetForm();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create deployment");
      }
    } catch (error) {
      console.error("Error creating deployment:", error);
      alert("Failed to create deployment");
    }
  };

  const openEditDialog = (deployment: Deployment) => {
    setEditingDeployment(deployment);
    setName(deployment.name);
    setDescription(deployment.description || "");
    setBuildCommand(deployment.buildCommand || "");
    setStartCommand(deployment.startCommand);
    setWorkingDir(deployment.workingDir || "/workspace");
    setPort(deployment.port.toString());
    setSubdomain(deployment.subdomain || "");
    setSelectedDomainId(deployment.domainId || "");
    setAutoRebuild(deployment.autoRebuild);
    setShowEditDialog(true);
  };

  const updateDeployment = async () => {
    if (!editingDeployment) return;

    try {
      const res = await fetch(`/api/deployments/${editingDeployment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          buildCommand,
          startCommand,
          workingDir,
          port: parseInt(port),
          subdomain: subdomain || undefined,
          domainId: selectedDomainId || undefined,
          autoRebuild,
        }),
      });

      if (res.ok) {
        await fetchDeployments();
        setShowEditDialog(false);
        setEditingDeployment(null);
        resetForm();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to update deployment");
      }
    } catch (error) {
      console.error("Error updating deployment:", error);
      alert("Failed to update deployment");
    }
  };

  const deployApplication = async (deploymentId: string) => {
    setIsDeploying(true);
    setDeployLogs([]);
    setSelectedDeployment(deploymentId);

    try {
      const res = await fetch(`/api/deployments/${deploymentId}/deploy`, {
        method: "POST",
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "log") {
                setDeployLogs((prev) => [...prev, data.message]);
              } else if (data.type === "complete") {
                setDeployLogs((prev) => [...prev, "✅ " + data.message]);
                await fetchDeployments();
              } else if (data.type === "error") {
                setDeployLogs((prev) => [...prev, "❌ " + data.message]);
              }
            } catch (e) {
              console.error("Error parsing SSE:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error deploying:", error);
      setDeployLogs((prev) => [...prev, "❌ Deployment failed"]);
    } finally {
      setIsDeploying(false);
    }
  };

  const stopDeployment = async (deploymentId: string) => {
    try {
      const res = await fetch(`/api/deployments/${deploymentId}/stop`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchDeployments();
      }
    } catch (error) {
      console.error("Error stopping deployment:", error);
    }
  };

  const deleteDeployment = async (deploymentId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this deployment? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/deployments/${deploymentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchDeployments();
      }
    } catch (error) {
      console.error("Error deleting deployment:", error);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setBuildCommand("");
    setStartCommand("");
    setWorkingDir("/workspace");
    setPort("3000");
    setSubdomain("");
    setAutoRebuild(false);

    // Reset to default domain if available
    const defaultDomain = domains.find((d) => d.isDefault);
    setSelectedDomainId(defaultDomain?.id || "");
  };

  const getStatusBadge = (status: Deployment["status"]) => {
    const variants: Record<typeof status, any> = {
      STOPPED: <Badge variant="secondary">Stopped</Badge>,
      BUILDING: (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Building
        </Badge>
      ),
      DEPLOYING: (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Deploying
        </Badge>
      ),
      RUNNING: (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Running
        </Badge>
      ),
      STOPPING: (
        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
          Stopping
        </Badge>
      ),
      ERROR: (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          <XCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      ),
    };
    return variants[status];
  };

  const getDeploymentUrl = (deployment: Deployment) => {
    if (deployment.domain && deployment.subdomain) {
      const protocol = deployment.domain.verified ? "https" : "http";
      return `${protocol}://${deployment.subdomain}.${deployment.domain.domain}`;
    } else if (deployment.exposedPort) {
      return `http://localhost:${deployment.exposedPort}`;
    }
    return null;
  };

  const copyWebhookUrl = (deploymentId: string) => {
    const url = `${window.location.origin}/api/deployments/${deploymentId}/webhook`;
    navigator.clipboard.writeText(url);
    alert("Webhook URL copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Server className="h-12 w-12 text-zinc-700 animate-pulse mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Loading deployments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-black via-zinc-950 to-black">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Deployments</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Deploy your applications with automated builds
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Deployment
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
              <DialogHeader>
                <DialogTitle>Create Deployment</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Configure your application deployment settings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="my-app"
                    className="bg-zinc-900 border-zinc-800"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Description
                  </label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    className="bg-zinc-900 border-zinc-800"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Build Command (optional)
                  </label>
                  <Input
                    value={buildCommand}
                    onChange={(e) => setBuildCommand(e.target.value)}
                    placeholder="npm run build"
                    className="bg-zinc-900 border-zinc-800"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Start Command
                  </label>
                  <Input
                    value={startCommand}
                    onChange={(e) => setStartCommand(e.target.value)}
                    placeholder="npm start"
                    className="bg-zinc-900 border-zinc-800"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Working Directory
                    </label>
                    <Input
                      value={workingDir}
                      onChange={(e) => setWorkingDir(e.target.value)}
                      placeholder="/workspace"
                      className="bg-zinc-900 border-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Port
                    </label>
                    <Input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      placeholder="3000"
                      className="bg-zinc-900 border-zinc-800"
                    />
                  </div>
                </div>
                {/* Domain Selection */}
                {domains.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Domain
                    </label>
                    <select
                      value={selectedDomainId}
                      onChange={(e) => setSelectedDomainId(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-100 text-sm"
                    >
                      <option value="">None (use port mapping)</option>
                      {domains.map((domain) => (
                        <option key={domain.id} value={domain.id}>
                          {domain.domain}
                          {domain.isDefault ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-zinc-500 mt-1">
                      {selectedDomainId
                        ? "A subdomain will be auto-generated, or specify one below"
                        : "Direct port mapping will be used"}
                    </p>
                  </div>
                )}

                {/* Subdomain - only show if domain is selected */}
                {selectedDomainId && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Subdomain (optional)
                    </label>
                    <Input
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      placeholder="Auto-generated if empty"
                      className="bg-zinc-900 border-zinc-800"
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      {subdomain
                        ? `Will be: ${subdomain}.${
                            domains.find((d) => d.id === selectedDomainId)
                              ?.domain
                          }`
                        : "Leave empty to auto-generate a random subdomain"}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoRebuild}
                    onChange={(e) => setAutoRebuild(e.target.checked)}
                    className="rounded border-zinc-700"
                  />
                  <label className="text-sm">
                    Enable auto-rebuild on GitHub push
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  className="border-zinc-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={createDeployment}
                  disabled={!name || !startCommand || !port}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Deployments List */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {deployments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Terminal className="h-12 w-12 text-zinc-700 mb-3" />
            <p className="text-zinc-400 mb-1">No deployments yet</p>
            <p className="text-xs text-zinc-600">
              Create your first deployment to get started
            </p>
          </div>
        ) : (
          deployments.map((deployment) => (
            <Card
              key={deployment.id}
              className="bg-zinc-900/50 border-zinc-800 p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-zinc-100">
                      {deployment.name}
                    </h3>
                    {getStatusBadge(deployment.status)}
                  </div>
                  {deployment.description && (
                    <p className="text-sm text-zinc-500">
                      {deployment.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {deployment.status === "RUNNING" && (
                    <>
                      {getDeploymentUrl(deployment) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            window.open(getDeploymentUrl(deployment)!, "_blank")
                          }
                          className="h-8 w-8 p-0"
                          title="Open in new tab"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLogsDeployment(deployment)}
                        className="h-8 w-8 p-0"
                        title="View logs"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setTerminalDeployment(deployment)}
                        className="h-8 w-8 p-0"
                        title="Open terminal"
                      >
                        <Terminal className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => stopDeployment(deployment.id)}
                        className="h-8 w-8 p-0"
                        title="Stop deployment"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {deployment.status === "STOPPED" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deployApplication(deployment.id)}
                      className="h-8 w-8 p-0"
                      title="Deploy"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(deployment)}
                    className="h-8 w-8 p-0"
                    title="Edit deployment"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteDeployment(deployment.id)}
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                    title="Delete deployment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <Terminal className="h-3 w-3" />
                  <code className="font-mono">{deployment.startCommand}</code>
                </div>
                {deployment.buildCommand && (
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-3 w-3" />
                    <code className="font-mono">{deployment.buildCommand}</code>
                  </div>
                )}
                {deployment.lastDeployedAt && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>
                      Last deployed:{" "}
                      {new Date(deployment.lastDeployedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {deployment.autoRebuild && deployment.webhookSecret && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-400">
                      Auto-rebuild enabled
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyWebhookUrl(deployment.id)}
                      className="h-6 px-2 ml-auto"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Webhook URL
                    </Button>
                  </div>
                )}
              </div>

              {/* Latest Build */}
              {deployment.builds && deployment.builds[0] && (
                <div className="mt-3 pt-3 border-t border-zinc-800">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-500">Latest build:</span>
                    {deployment.builds[0].status === "SUCCESS" && (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    )}
                    {deployment.builds[0].status === "FAILED" && (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                    {deployment.builds[0].status === "BUILDING" && (
                      <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
                    )}
                    <span className="text-zinc-400">
                      {deployment.builds[0].commitMessage ||
                        deployment.builds[0].triggeredBy}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Deploy Logs Dialog (for deployment progress) */}
      {selectedDeployment && (
        <Dialog
          open={!!selectedDeployment}
          onOpenChange={() => setSelectedDeployment(null)}
        >
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-3xl">
            <DialogHeader>
              <DialogTitle>Deployment Progress</DialogTitle>
            </DialogHeader>
            <div className="bg-black border border-zinc-800 rounded-lg p-4 h-96 overflow-auto font-mono text-xs">
              {deployLogs.map((log, i) => (
                <div key={i} className="text-zinc-300">
                  {log}
                </div>
              ))}
              {isDeploying && (
                <div className="flex items-center gap-2 text-zinc-500 mt-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Deploying...</span>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Terminal Dialog */}
      {terminalDeployment && (
        <DeploymentTerminal
          deploymentId={terminalDeployment.id}
          deploymentName={terminalDeployment.name}
          open={!!terminalDeployment}
          onOpenChange={(open) => !open && setTerminalDeployment(null)}
        />
      )}

      {/* Logs Viewer Dialog */}
      {logsDeployment && (
        <DeploymentLogs
          deploymentId={logsDeployment.id}
          deploymentName={logsDeployment.name}
          open={!!logsDeployment}
          onOpenChange={(open) => !open && setLogsDeployment(null)}
        />
      )}

      {/* Edit Deployment Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Edit Deployment</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update your deployment configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingDeployment?.status === "RUNNING" && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-yellow-200">
                  <p className="font-medium mb-1">Deployment is running</p>
                  <p className="text-yellow-300/80">
                    Changes will not take effect until you stop and redeploy
                    this deployment.
                  </p>
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-app"
                className="bg-zinc-900 border-zinc-800"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Description
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="bg-zinc-900 border-zinc-800"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Build Command (optional)
              </label>
              <Input
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                placeholder="npm run build"
                className="bg-zinc-900 border-zinc-800"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Start Command
              </label>
              <Input
                value={startCommand}
                onChange={(e) => setStartCommand(e.target.value)}
                placeholder="npm start"
                className="bg-zinc-900 border-zinc-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Working Directory
                </label>
                <Input
                  value={workingDir}
                  onChange={(e) => setWorkingDir(e.target.value)}
                  placeholder="/workspace"
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Port</label>
                <Input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="3000"
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
            </div>
            {/* Domain Selection */}
            {domains.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1 block">Domain</label>
                <select
                  value={selectedDomainId}
                  onChange={(e) => setSelectedDomainId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-100 text-sm"
                >
                  <option value="">None (use port mapping)</option>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.domain}
                      {domain.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 mt-1">
                  {selectedDomainId
                    ? "A subdomain will be auto-generated, or specify one below"
                    : "Direct port mapping will be used"}
                </p>
              </div>
            )}

            {/* Subdomain - only show if domain is selected */}
            {selectedDomainId && (
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Subdomain (optional)
                </label>
                <Input
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="Auto-generated if empty"
                  className="bg-zinc-900 border-zinc-800"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  {subdomain
                    ? `Will be: ${subdomain}.${
                        domains.find((d) => d.id === selectedDomainId)?.domain
                      }`
                    : "Leave empty to auto-generate a random subdomain"}
                </p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRebuild}
                onChange={(e) => setAutoRebuild(e.target.checked)}
                className="rounded border-zinc-700"
              />
              <label className="text-sm">
                Enable auto-rebuild on GitHub push
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setEditingDeployment(null);
                resetForm();
              }}
              className="border-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={updateDeployment}
              disabled={!name || !startCommand || !port}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

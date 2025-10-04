"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Code,
  Globe,
  Clock,
  Activity,
  Loader2,
  Edit,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/sidebar";
import { toast } from "sonner";
import { AnalyticsDashboard } from "@/components/edge-functions/analytics-dashboard";
import { FunctionEditorDialog } from "@/components/edge-functions/function-editor-dialog";
import { TestRunnerDialog } from "@/components/edge-functions/test-runner-dialog";
import { FunctionSettings } from "@/components/edge-functions/function-settings";

interface EdgeFunction {
  id: string;
  name: string;
  description?: string;
  code: string;
  handler: string;
  runtime: string;
  status: string;
  triggerType: string;
  timeout: number;
  memory: number;
  subdomain?: string;
  path?: string;
  domain?: {
    id: string;
    domain: string;
    verified: boolean;
  };
  invocationCount: number;
  errorCount: number;
  lastInvokedAt?: string;
  createdAt: string;
  updatedAt: string;
  deployedAt?: string;
}

export default function EdgeFunctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [func, setFunc] = useState<EdgeFunction | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "settings" | "logs">("overview");

  useEffect(() => {
    loadFunction();
  }, [resolvedParams.id]);

  const loadFunction = async () => {
    try {
      const response = await fetch(`/api/edge-functions/${resolvedParams.id}`);
      if (!response.ok) throw new Error("Failed to load function");
      const data = await response.json();
      setFunc(data.function);
    } catch (error: any) {
      console.error("Error loading function:", error);
      toast.error("Failed to load function");
      router.push("/dashboard/edge-functions");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!func) return;
    if (!confirm(`Are you sure you want to delete "${func.name}"?`)) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/edge-functions/${func.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete function");

      toast.success("Function deleted successfully");
      router.push("/dashboard/edge-functions");
    } catch (error: any) {
      console.error("Error deleting function:", error);
      toast.error(error.message || "Failed to delete function");
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "INACTIVE":
        return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
      case "ERROR":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "DEPLOYING":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-zinc-700 animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Loading function...</p>
        </div>
      </div>
    );
  }

  if (!func) {
    return null;
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
        <div className="border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-sm relative z-50">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard/edge-functions")}
                className="text-zinc-400 hover:text-zinc-300 -ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="h-8 w-px bg-zinc-800" />
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center">
                <Code className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-zinc-100">{func.name}</h1>
                {func.description && (
                  <p className="text-xs text-zinc-500">{func.description}</p>
                )}
              </div>
              <Badge
                className={getStatusColor(func.status)}
                variant="outline"
              >
                {func.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setShowTestDialog(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Play className="h-4 w-4 mr-2" />
                Test
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEditDialog(true)}
                className="border-zinc-700 text-zinc-300"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                disabled={deleting}
                className="border-red-500/20 text-red-500 hover:bg-red-500/10"
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
          
          {/* Tabs */}
          <div className="px-6 flex items-center gap-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "overview"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "settings"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "logs"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Logs
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <>
            {/* Analytics Dashboard - Main Focus */}
            <AnalyticsDashboard functionId={func.id} />

            {/* Function Details */}
            <Card className="p-6 bg-zinc-900/50 border-zinc-800">
              <h3 className="text-lg font-medium text-zinc-200 mb-4">
                Configuration
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Runtime</div>
                  <div className="text-sm text-zinc-300">{func.runtime}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Handler</div>
                  <div className="text-sm text-zinc-300 font-mono">
                    {func.handler}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Timeout</div>
                  <div className="text-sm text-zinc-300 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {func.timeout}ms
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Memory</div>
                  <div className="text-sm text-zinc-300">{func.memory}MB</div>
                </div>
              </div>

              {/* Endpoint URL */}
              <div className="mt-6 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-300">
                    Function Endpoint
                  </span>
                </div>
                <div className="space-y-3">
                  {/* Custom Domain URL (Priority 1) */}
                  {func.domain && func.subdomain && (
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Custom Domain (HTTPS)</div>
                      <div className="flex items-center gap-3">
                        <code className="flex-1 text-sm text-emerald-400 bg-zinc-900 px-3 py-2 rounded border border-zinc-700">
                          https://{func.subdomain}.{func.domain?.domain}{func.path || "/"}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const url = `https://${func.subdomain}.${func.domain?.domain}${func.path || "/"}`;
                            navigator.clipboard.writeText(url);
                            toast.success("URL copied to clipboard!");
                          }}
                          className="border-zinc-700 text-zinc-300"
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Base Domain URL (Priority 2) */}
                  {!func.domain && typeof window !== "undefined" && process.env.NEXT_PUBLIC_BASE_DOMAIN && (
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Base Domain (HTTPS)</div>
                      <div className="flex items-center gap-3">
                        <code className="flex-1 text-sm text-emerald-400 bg-zinc-900 px-3 py-2 rounded border border-zinc-700">
                          https://{func.id}.{process.env.NEXT_PUBLIC_BASE_DOMAIN}{func.path || "/"}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const url = `https://${func.id}.${process.env.NEXT_PUBLIC_BASE_DOMAIN}${func.path || "/"}`;
                            navigator.clipboard.writeText(url);
                            toast.success("URL copied to clipboard!");
                          }}
                          className="border-zinc-700 text-zinc-300"
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* API Endpoint (Fallback) */}
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">API Endpoint (Authenticated)</div>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 text-sm text-zinc-400 bg-zinc-900 px-3 py-2 rounded border border-zinc-700">
                        POST /api/edge-functions/{func.id}/invoke
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const url = `${window.location.origin}/api/edge-functions/${func.id}/invoke`;
                          navigator.clipboard.writeText(url);
                          toast.success("Endpoint copied to clipboard!");
                        }}
                        className="border-zinc-700 text-zinc-300"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>
                {!func.domain && !process.env.NEXT_PUBLIC_BASE_DOMAIN && (
                  <p className="text-xs text-zinc-500 mt-3">
                    💡 Configure KALPANA_BASE_DOMAIN or link a custom domain for public HTTPS access
                  </p>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-800 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-500">Created:</span>{" "}
                  <span className="text-zinc-300">{formatDate(func.createdAt)}</span>
                </div>
                {func.deployedAt && (
                  <div>
                    <span className="text-zinc-500">Deployed:</span>{" "}
                    <span className="text-zinc-300">
                      {formatDate(func.deployedAt)}
                    </span>
                  </div>
                )}
                {func.lastInvokedAt && (
                  <div>
                    <span className="text-zinc-500">Last Invoked:</span>{" "}
                    <span className="text-zinc-300">
                      {formatDate(func.lastInvokedAt)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-zinc-500">Total Invocations:</span>{" "}
                  <span className="text-zinc-300">
                    {func.invocationCount.toLocaleString()}
                  </span>
                </div>
              </div>
            </Card>
              </>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
              <FunctionSettings
                functionId={func.id}
                initialData={func}
                onUpdate={loadFunction}
              />
            )}

            {/* Logs Tab */}
            {activeTab === "logs" && (
              <Card className="p-6 bg-zinc-900/50 border-zinc-800">
                <h3 className="text-lg font-medium text-zinc-200 mb-6">Invocation Logs</h3>
                <p className="text-sm text-zinc-500">Logs viewer coming soon...</p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showEditDialog && func && (
        <FunctionEditorDialog
          function={func}
          onClose={() => {
            setShowEditDialog(false);
            loadFunction();
          }}
        />
      )}

      {showTestDialog && func && (
        <TestRunnerDialog
          function={func}
          onClose={() => setShowTestDialog(false)}
        />
      )}
    </div>
  );
}
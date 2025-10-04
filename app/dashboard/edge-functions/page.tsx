"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  Plus,
  Play,
  Trash2,
  Edit,
  Globe,
  Clock,
  Activity,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { FunctionEditorDialog } from "@/components/edge-functions/function-editor-dialog";
import { TestRunnerDialog } from "@/components/edge-functions/test-runner-dialog";
import { NotificationBell } from "@/components/workspace/notification-bell";
import { toast } from "sonner";

interface EdgeFunction {
  id: string;
  name: string;
  description?: string;
  code?: string;
  handler?: string;
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
}

export default function EdgeFunctionsPage() {
  const router = useRouter();
  const [functions, setFunctions] = useState<EdgeFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [editingFunction, setEditingFunction] = useState<EdgeFunction | null>(null);
  const [testingFunction, setTestingFunction] = useState<EdgeFunction | null>(null);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadFunctions();
  }, []);

  const loadFunctions = async () => {
    try {
      const response = await fetch("/api/edge-functions");
      if (!response.ok) throw new Error("Failed to load functions");
      const data = await response.json();
      setFunctions(data.functions || []);
    } catch (error: any) {
      console.error("Error loading functions:", error);
      toast.error("Failed to load edge functions");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`/api/edge-functions/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete function");

      toast.success("Function deleted successfully");
      loadFunctions();
    } catch (error: any) {
      console.error("Error deleting function:", error);
      toast.error(error.message || "Failed to delete function");
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleEdit = (func: EdgeFunction) => {
    setEditingFunction(func);
    setShowCreateDialog(true);
  };

  const handleTest = (func: EdgeFunction) => {
    setTestingFunction(func);
    setShowTestDialog(true);
  };

  const handleDialogClose = () => {
    setShowCreateDialog(false);
    setEditingFunction(null);
    loadFunctions();
  };

  const handleTestDialogClose = () => {
    setShowTestDialog(false);
    setTestingFunction(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "DEPLOYING":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "ERROR":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "INACTIVE":
        return <AlertCircle className="h-4 w-4 text-zinc-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-zinc-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "DEPLOYING":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "ERROR":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "INACTIVE":
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
      default:
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
            <div>
              <h1 className="text-lg font-medium text-zinc-100">Edge Functions</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Serverless functions with instant execution
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700">
                {functions.length} {functions.length === 1 ? "function" : "functions"}
              </Badge>
              <NotificationBell />
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Function
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {functions.length === 0 && !loading ? (
              <Card className="bg-zinc-900/50 border-zinc-800 p-12">
                <div className="text-center">
                  <Zap className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                    No edge functions yet
                  </h3>
                  <p className="text-zinc-500 mb-6">
                    Create serverless functions to handle APIs, webhooks, and data transformations
                  </p>
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Function
                  </Button>
                </div>
              </Card>
            ) : loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="bg-zinc-900/50 border-zinc-800 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Skeleton className="h-6 w-48 bg-zinc-800" />
                          <Skeleton className="h-6 w-20 bg-zinc-800" />
                        </div>
                        <Skeleton className="h-4 w-32 mb-4 bg-zinc-800" />
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <Skeleton className="h-16 bg-zinc-800" />
                          <Skeleton className="h-16 bg-zinc-800" />
                          <Skeleton className="h-16 bg-zinc-800" />
                        </div>
                        <Skeleton className="h-4 w-full bg-zinc-800" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-9 w-24 bg-zinc-800" />
                        <Skeleton className="h-9 w-9 bg-zinc-800" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {functions.map((func) => (
                  <Card
                    key={func.id}
                    onClick={() => router.push(`/dashboard/edge-functions/${func.id}`)}
                    className="bg-zinc-900/50 border-zinc-800 p-6 hover:border-zinc-700 transition-all cursor-pointer hover:scale-[1.01]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-zinc-100">
                            {func.name}
                          </h3>
                          <Badge className={getStatusColor(func.status)}>
                            {getStatusIcon(func.status)}
                            <span className="ml-1.5">{func.status}</span>
                          </Badge>
                          {func.domain && func.subdomain && (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                              Domain Linked
                            </Badge>
                          )}
                        </div>

                        {func.description && (
                          <p className="text-sm text-zinc-400 mb-3">
                            {func.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-sm text-zinc-500 mb-3">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{func.timeout}ms timeout</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5" />
                            <span>{func.invocationCount.toLocaleString()} invocations</span>
                          </div>
                          {func.lastInvokedAt && (
                            <div className="flex items-center gap-1.5">
                              Last invoked {formatDate(func.lastInvokedAt)}
                            </div>
                          )}
                        </div>

                        {func.domain && func.subdomain && (
                          <div className="flex items-center gap-2 mb-3">
                            <Globe className="h-4 w-4 text-zinc-500" />
                            <span className="text-sm text-emerald-400">
                              https://{func.subdomain}.{func.domain.domain}{func.path || "/"}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTest(func);
                          }}
                          className="border-zinc-700 hover:bg-zinc-800"
                        >
                          <Play className="h-4 w-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(func);
                          }}
                          className="border-zinc-700 hover:bg-zinc-800"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(func.id, func.name);
                          }}
                          disabled={deleting[func.id]}
                          className="text-red-400 hover:text-red-300"
                        >
                          {deleting[func.id] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
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

      {/* Dialogs */}
      {showCreateDialog && (
        <FunctionEditorDialog
          function={editingFunction!}
          onClose={handleDialogClose}
        />
      )}

      {showTestDialog && testingFunction && (
        <TestRunnerDialog
          function={testingFunction}
          onClose={handleTestDialogClose}
        />
      )}
    </div>
  );
}

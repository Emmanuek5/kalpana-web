"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface DiagnosticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function DiagnosticsDialog({
  open,
  onOpenChange,
  workspaceId,
}: DiagnosticsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/workspaces/${workspaceId}/diagnostics`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch diagnostics: ${response.statusText}`);
      }

      const data = await response.json();
      setDiagnostics(data.diagnostics);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDiagnostics();
    }
  }, [open, workspaceId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center justify-between">
            <span>Workspace Diagnostics & Logs</span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDiagnostics}
              disabled={loading}
              className="border-blue-900/50 bg-blue-950/30 text-blue-400 hover:bg-blue-900/40"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
              )}
              Refresh
            </Button>
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Debug information for troubleshooting workspace issues
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {error && (
            <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {loading && !diagnostics && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          )}

          {diagnostics && !loading && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Extension Status */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                    🔧 Extension Status
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm">
                      {diagnostics.kalpanaExtensionInstalled ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-zinc-400">
                        Extension Installed:
                      </span>
                      <Badge
                        variant={
                          diagnostics.kalpanaExtensionInstalled
                            ? "default"
                            : "destructive"
                        }
                      >
                        {diagnostics.kalpanaExtensionInstalled ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Extension Activation Log */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3">
                    📄 Extension Activation Log
                  </h3>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 max-h-[200px] overflow-auto">
                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words">
                      {diagnostics.extensionActivationLog ||
                        "No activation log found"}
                    </pre>
                  </div>
                </div>

                {/* Process Status */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                    🔌 Process Status
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm">
                      {diagnostics.codeServerRunning ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-zinc-400">
                        Code Server Running:
                      </span>
                      <Badge
                        variant={
                          diagnostics.codeServerRunning
                            ? "default"
                            : "destructive"
                        }
                      >
                        {diagnostics.codeServerRunning ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      {diagnostics.agentBridgeRunning ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-zinc-400">
                        Agent Bridge Running:
                      </span>
                      <Badge
                        variant={
                          diagnostics.agentBridgeRunning
                            ? "default"
                            : "destructive"
                        }
                      >
                        {diagnostics.agentBridgeRunning ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Network Status */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3">
                    🌐 Port 3002 Status (Extension WebSocket)
                  </h3>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 max-h-[150px] overflow-auto">
                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words">
                      {diagnostics.port3002Status || "Unable to check"}
                    </pre>
                  </div>
                </div>

                {/* Installed Extensions */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3">
                    📦 Installed Extensions
                  </h3>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 max-h-[150px] overflow-auto">
                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words">
                      {diagnostics.installedExtensions || "No extensions found"}
                    </pre>
                  </div>
                </div>

                {/* Container Logs */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3">
                    📋 Container Logs (Last 200 lines)
                  </h3>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 max-h-[400px] overflow-auto">
                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words">
                      {diagnostics.containerLogs || "No logs available"}
                    </pre>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

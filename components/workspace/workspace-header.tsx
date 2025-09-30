import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, X, RefreshCw, Bug } from "lucide-react";

interface WorkspaceHeaderProps {
  workspace: {
    name: string;
    status: string;
  };
  onStop: () => void;
  onRestart: () => void;
  onShowDiagnostics: () => void;
  stopping: boolean;
  restarting: boolean;
}

export function WorkspaceHeader({
  workspace,
  onStop,
  onRestart,
  onShowDiagnostics,
  stopping,
  restarting,
}: WorkspaceHeaderProps) {
  const router = useRouter();

  return (
    <header className="border-b border-zinc-900/50 bg-gradient-to-r from-zinc-950 via-black to-zinc-950 backdrop-blur-xl sticky top-0 z-30 shrink-0">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="h-5 w-px bg-zinc-800" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-900/30 flex items-center justify-center">
              <span className="text-emerald-500 text-sm font-bold">
                {workspace.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-zinc-100">
                {workspace.name}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="outline"
                  className={
                    workspace.status === "RUNNING"
                      ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-500 text-xs"
                      : workspace.status === "STARTING"
                      ? "border-blue-900/50 bg-blue-950/30 text-blue-500 text-xs"
                      : "border-zinc-800 bg-zinc-900/30 text-zinc-500 text-xs"
                  }
                >
                  {workspace.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {workspace.status === "RUNNING" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onShowDiagnostics}
                className="border-blue-900/50 bg-blue-950/30 text-blue-400 hover:bg-blue-900/40 hover:text-blue-300"
                title="View diagnostics & logs"
              >
                <Bug className="h-3.5 w-3.5 mr-2" />
                Logs
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRestart}
                disabled={restarting}
                className="border-emerald-900/50 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300"
              >
                {restarting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                )}
                Rebuild
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onStop}
                disabled={stopping}
                className="border-red-900/50 bg-red-950/30 text-red-400 hover:bg-red-900/40 hover:text-red-300"
              >
                {stopping ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5 mr-2" />
                )}
                Stop
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

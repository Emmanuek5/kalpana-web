import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { StartupLogsView } from "./startup-logs-view";

interface WorkspaceEditorProps {
  workspace: {
    status: string;
    vscodePort?: number;
  };
  starting: boolean;
  restarting: boolean;
  rebuildStage: string;
  rebuildLogs: string[];
  onStart: () => void;
}

export function WorkspaceEditor({
  workspace,
  starting,
  restarting,
  rebuildStage,
  rebuildLogs,
  onStart,
}: WorkspaceEditorProps) {
  if (workspace.status === "RUNNING" && workspace.vscodePort) {
    return (
      <iframe
        src={`http://localhost:${workspace.vscodePort}`}
        className="w-full h-full border-0"
        title="VSCode"
      />
    );
  }

  if (starting || restarting) {
    return (
      <StartupLogsView
        restarting={restarting}
        rebuildStage={rebuildStage}
        rebuildLogs={rebuildLogs}
      />
    );
  }

  if (workspace.status === "STOPPING") {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <Loader2 className="h-12 w-12 text-orange-500 animate-spin mx-auto mb-6" />
          <p className="text-zinc-500 text-sm">Shutting down...</p>
        </div>
      </div>
    );
  }

  // Stopped state
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="mb-6 text-zinc-700 text-6xl font-bold">DEV</div>
        <p className="text-zinc-600 text-sm mb-8">
          Start your workspace to begin coding
        </p>
        <Button
          onClick={onStart}
          disabled={starting}
          className="bg-emerald-600/90 hover:bg-emerald-500 text-white border-0"
        >
          {starting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Start Workspace
        </Button>
      </div>
    </div>
  );
}

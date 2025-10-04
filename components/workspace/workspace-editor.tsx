import React, { useRef, useEffect } from "react";
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
  onFileChange?: (filePath: string | null) => void;
}

export function WorkspaceEditor({
  workspace,
  starting,
  restarting,
  rebuildStage,
  rebuildLogs,
  onStart,
  onFileChange,
}: WorkspaceEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastFileRef = useRef<string | null>(null);

  // Poll iframe URL for file changes
  useEffect(() => {
    if (workspace.status !== "RUNNING" || !workspace.vscodePort || !onFileChange) {
      return;
    }

    const checkFileChange = () => {
      try {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow) return;

        // Try to get the iframe URL (may fail due to CORS)
        try {
          const iframeUrl = iframe.contentWindow.location.href;
          const filePath = extractFilePathFromUrl(iframeUrl);
          
          if (filePath !== lastFileRef.current) {
            lastFileRef.current = filePath;
            onFileChange(filePath);
          }
        } catch (e) {
          // CORS error - can't access iframe URL
          // This is expected for cross-origin iframes
        }
      } catch (error) {
        // Ignore errors
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(checkFileChange, 2000);
    return () => clearInterval(interval);
  }, [workspace.status, workspace.vscodePort, onFileChange]);

  // Extract file path from VSCode URL
  const extractFilePathFromUrl = (url: string): string | null => {
    try {
      // VSCode URLs typically have the file path in the URL
      // Example: http://localhost:40006/?folder=/workspace&file=/workspace/src/file.ts
      const urlObj = new URL(url);
      const fileParam = urlObj.searchParams.get('file');
      if (fileParam) {
        return fileParam;
      }
      
      // Alternative: check hash for file path
      if (urlObj.hash) {
        const match = urlObj.hash.match(/\/workspace\/[^\s&]+/);
        if (match) {
          return match[0];
        }
      }
      
      return null;
    } catch {
      return null;
    }
  };

  if (workspace.status === "RUNNING" && workspace.vscodePort) {
    return (
      <iframe
        ref={iframeRef}
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

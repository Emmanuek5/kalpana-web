import React from "react";
import { Loader2, Terminal } from "lucide-react";

interface StartupLogsViewProps {
  restarting: boolean;
  rebuildStage: string;
  rebuildLogs: string[];
}

export function StartupLogsView({
  restarting,
  rebuildStage,
  rebuildLogs,
}: StartupLogsViewProps) {
  return (
    <div className="h-full w-full flex items-center justify-center p-8">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Loader2 className="h-12 w-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-200 mb-2">
            {restarting ? "Rebuilding Environment" : "Starting Workspace"}
          </h2>
          <p className="text-sm text-zinc-500">{rebuildStage}</p>
        </div>

        {/* Logs */}
        {rebuildLogs.length > 0 && (
          <div className="bg-black/50 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-xs font-medium text-zinc-400">
                  Startup Logs
                </span>
                <span className="text-xs text-zinc-600 ml-auto">
                  {rebuildLogs.length} lines
                </span>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto overflow-x-hidden scrollbar-thin">
              <div className="p-4 space-y-1 font-mono text-xs">
                {rebuildLogs.map((log, i) => (
                  <div
                    key={i}
                    className="text-zinc-400 whitespace-pre-wrap break-all leading-relaxed"
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

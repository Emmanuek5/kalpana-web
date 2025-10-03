"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Terminal as TerminalIcon,
  FileCode,
  Search,
  GitCommit,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
} from "lucide-react";
import { useState } from "react";

interface ToolCall {
  id: string;
  type: string;
  function?: {
    name: string;
    arguments: string;
  };
  timestamp: string;
  state?: "executing" | "complete" | "error";
}

interface ToolResult {
  toolCallId: string;
  toolName: string;
  result: any;
  timestamp: string;
}

interface AgentActivityProps {
  toolCalls: ToolCall[];
  toolResults?: ToolResult[];
}

const TOOL_ICONS: Record<string, React.ComponentType<any>> = {
  listFiles: TerminalIcon,
  readFile: FileCode,
  searchCode: Search,
  runCommand: TerminalIcon,
  writeFile: FileCode,
  deleteFile: FileCode,
  moveFile: FileCode,
  createDirectory: TerminalIcon,
  fileTree: TerminalIcon,
  gitCommit: GitCommit,
  webResearch: Search,
  editCode: FileCode,
  getConsoleLogs: TerminalIcon,
  getLintErrors: AlertCircle,
  list_directory: TerminalIcon,
  read_file: FileCode,
  write_file: FileCode,
  search_files: Search,
  run_command: TerminalIcon,
  git_status: GitCommit,
  git_diff: GitCommit,
  git_log: GitCommit,
  read_multiple_files: FileCode,
  find_files: Search,
  get_file_info: FileCode,
  git_branch: GitCommit,
  git_stash: GitCommit,
  install_packages: TerminalIcon,
  run_tests: TerminalIcon,
};

export function AgentActivity({ toolCalls, toolResults = [] }: AgentActivityProps) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // Track which tools are currently executing (have call but no result yet)
  const executingToolIds = new Set(
    toolCalls
      .filter(tc => {
        // Check explicit state first, then fall back to result check
        if (tc.state) {
          return tc.state === "executing";
        }
        return !toolResults.some(tr => tr.toolCallId === tc.id);
      })
      .map(tc => tc.id)
  );

  const toggleTool = (id: string) => {
    setExpandedTools((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };


  // Show only tool calls (results update the call state, not separate items)
  if (toolCalls.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <Activity className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
          <p className="text-sm">No activity yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            Tool calls will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {toolCalls.map((call) => {
          const isExpanded = expandedTools.has(call.id);
          const isExecuting = call.state === "executing" || executingToolIds.has(call.id);
          const isComplete = call.state === "complete" || toolResults.some(tr => tr.toolCallId === call.id);
          const hasError = call.state === "error";
          
          // Handle both old format (call.function.name) and new format (call.toolName)
          const toolName = (call as any).toolName || call.function?.name || call.type || "unknown";
          const IconComponent = TOOL_ICONS[toolName] || Activity;

          return (
            <div
              key={`call-${call.id}`}
              className={`group relative border rounded-lg overflow-hidden transition-all ${
                hasError
                  ? 'bg-red-950/20 border-red-800/30 hover:border-red-700/50'
                  : isComplete
                  ? 'bg-emerald-950/20 border-emerald-800/30 hover:border-emerald-700/50'
                  : 'bg-zinc-900/20 border-zinc-800/30 hover:border-zinc-700/50'
              }`}
            >
              <button
                onClick={() => toggleTool(call.id)}
                className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left"
              >
                {/* Status Icon */}
                <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 transition-all ${
                  hasError
                    ? 'bg-red-500/10 border border-red-500/20'
                    : isComplete
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-zinc-500/10 border border-zinc-500/20'
                }`}>
                  {hasError ? (
                    <AlertCircle className="h-3 w-3 text-red-500" />
                  ) : isExecuting ? (
                    <Loader2 className="h-3 w-3 text-emerald-400 animate-spin" />
                  ) : isComplete ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <IconComponent className="h-3 w-3 text-zinc-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-medium block ${
                    hasError ? 'text-red-400' : isComplete ? 'text-emerald-300' : 'text-zinc-300'
                  }`}>
                    {toolName
                      .replace(/([A-Z])/g, " $1")
                      .replace(/_/g, " ")
                      .trim()}
                  </span>
                  <span className="text-[10px] text-zinc-600 block mt-0.5">
                    {new Date(call.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {/* Right side indicators */}
                <div className="flex items-center gap-2 shrink-0">
                  {isExecuting && (
                    <span className="text-[9px] text-emerald-400 font-medium">Running...</span>
                  )}
                  {isComplete && !isExpanded && (
                    <span className="text-[9px] text-emerald-500 font-medium">Done</span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3 text-zinc-600" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-zinc-600" />
                  )}
                </div>
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-zinc-800/30 bg-black/10">
                  {/* Show result if available */}
                  {(() => {
                    const result = toolResults.find(tr => tr.toolCallId === call.id);
                    if (result) {
                      let resultDisplay = "";
                      try {
                        resultDisplay = typeof result.result === "string" 
                          ? result.result 
                          : JSON.stringify(result.result, null, 2);
                      } catch (e) {
                        resultDisplay = String(result.result);
                      }
                      
                      return (
                        <div className="mt-2">
                          <div className="text-[10px] font-semibold text-emerald-500/70 mb-1 tracking-wide">
                            RESULT
                          </div>
                          <div className="text-xs bg-zinc-950/50 border border-zinc-800/30 p-2 rounded overflow-auto max-h-40 text-zinc-400">
                            <pre className="whitespace-pre-wrap font-mono text-[10px]">{resultDisplay}</pre>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Show arguments */}
                  <div className="mt-2">
                    <div className="text-[10px] font-semibold text-zinc-500/70 mb-1 tracking-wide">
                      INPUT
                    </div>
                    <div className="text-[11px] text-zinc-400 bg-zinc-950/50 border border-zinc-800/30 p-2 rounded overflow-auto max-h-40 font-mono leading-relaxed">
                      <pre className="whitespace-pre-wrap">
                        {(() => {
                          // Handle both old format (call.function.arguments) and new format (call.args)
                          const rawArgs = (call as any).args || call.function?.arguments;
                          
                          if (!rawArgs) {
                            return "No arguments";
                          }
                          try {
                            const args =
                              typeof rawArgs === "string"
                                ? JSON.parse(rawArgs)
                                : rawArgs;
                            const formatted = JSON.stringify(args, null, 2);
                            return formatted === "{}" ? "No arguments" : formatted;
                          } catch (e) {
                            return String(rawArgs);
                          }
                        })()}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
      })}
    </div>
  );
}

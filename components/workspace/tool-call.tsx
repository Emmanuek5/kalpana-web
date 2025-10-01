import React from "react";
import {
  ChevronDown,
  ChevronUp,
  Terminal as TerminalIcon,
  FileCode,
  Search,
  GitCommit,
  Upload,
  Check,
  AlertCircle,
} from "lucide-react";
import type { MessagePart } from "./types";

const TOOL_ICONS: Record<string, React.ComponentType<any>> = {
  listFiles: TerminalIcon,
  readFile: FileCode,
  readMultipleFiles: FileCode,
  searchCode: Search,
  runCommand: TerminalIcon,
  writeFile: FileCode,
  deleteFile: FileCode,
  moveFile: FileCode,
  createDirectory: TerminalIcon,
  fileTree: TerminalIcon,
  findFiles: Search,
  getFileInfo: FileCode,
  gitCommit: GitCommit,
  gitBranch: GitCommit,
  gitStash: GitCommit,
  gitPush: Upload,
  installPackages: Upload,
  runTests: Check,
  webResearch: Search,
  editCode: FileCode,
  getConsoleLogs: TerminalIcon,
  getLintErrors: AlertCircle,
};

export const ToolCall = React.memo(
  ({
    toolPart,
    isExpanded,
    onToggle,
  }: {
    toolPart: Extract<MessagePart, { type: "tool" }>;
    isExpanded: boolean;
    onToggle: () => void;
  }) => {
    const IconComponent = TOOL_ICONS[toolPart.toolName] || TerminalIcon;

    return (
      <div className="group relative bg-zinc-900/20 border border-zinc-800/30 rounded-md overflow-hidden hover:border-zinc-700/50 transition-colors">
        <button
          onClick={onToggle}
          className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left"
        >
          <div className="h-4 w-4 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <IconComponent className="h-2.5 w-2.5 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-medium text-zinc-500 block">
              {toolPart.toolName.replace(/([A-Z])/g, " $1").trim()}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isExpanded ? (
              <ChevronUp className="h-2.5 w-2.5 text-zinc-600" />
            ) : (
              <ChevronDown className="h-2.5 w-2.5 text-zinc-600" />
            )}
          </div>
        </button>
        {isExpanded && (
          <div className="px-3 pb-3 border-t border-zinc-800/30 bg-black/10">
            {toolPart.input && Object.keys(toolPart.input).length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] font-semibold text-emerald-500/70 mb-1 tracking-wide">
                  INPUT
                </div>
                <div className="text-xs text-zinc-400 bg-zinc-950/50 border border-zinc-800/30 p-2 rounded overflow-auto max-h-32 font-mono">
                  {JSON.stringify(toolPart.input, null, 2)}
                </div>
              </div>
            )}
            {toolPart.output && (
              <div className="mt-2">
                <div className="text-[10px] font-semibold text-emerald-500/70 mb-1 tracking-wide">
                  OUTPUT
                </div>
                <div className="text-xs text-zinc-400 bg-zinc-950/50 border border-zinc-800/30 p-2 rounded overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                  {typeof toolPart.output === "string"
                    ? toolPart.output
                    : JSON.stringify(toolPart.output, null, 2)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

ToolCall.displayName = "ToolCall";

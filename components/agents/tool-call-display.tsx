import React from "react";
import {
  ChevronDown,
  ChevronUp,
  Terminal as TerminalIcon,
  FileCode,
  Search,
  GitCommit,
  Check,
  AlertCircle,
  Loader2,
  FolderOpen,
  FileText,
  FilePlus,
  FileX,
  FolderPlus,
  Activity,
} from "lucide-react";

const TOOL_ICONS: Record<string, React.ComponentType<any>> = {
  list_directory: FolderOpen,
  read_file: FileText,
  read_multiple_files: FileCode,
  write_file: FilePlus,
  search_files: Search,
  run_command: TerminalIcon,
  delete_file: FileX,
  move_file: FileCode,
  create_directory: FolderPlus,
  git_status: GitCommit,
  git_diff: GitCommit,
  git_log: GitCommit,
  git_commit: GitCommit,
  git_branch: GitCommit,
  git_stash: GitCommit,
  find_files: Search,
  get_file_info: FileText,
  install_packages: TerminalIcon,
  run_tests: TerminalIcon,
};

/**
 * Generate human-readable description for a tool call
 */
function getToolDescription(toolName: string, args: any): string {
  if (!args) return toolName.replace(/_/g, " ");

  switch (toolName) {
    case "read_file":
      return `Reading ${args.path || "file"}`;
    case "write_file":
      return `Writing to ${args.path || "file"}`;
    case "list_directory":
      return `Listing ${args.path || "."}`;
    case "search_files":
      return `Searching for "${args.query || args.pattern}"`;
    case "run_command":
      return `Running: ${args.command}`;
    case "delete_file":
      return `Deleting ${args.path}`;
    case "move_file":
      return `Moving ${args.source} → ${args.destination}`;
    case "create_directory":
      return `Creating directory ${args.path}`;
    case "find_files":
      return `Finding files: ${args.pattern}`;
    case "get_file_info":
      return `Getting info for ${args.path}`;
    case "git_commit":
      return `Committing: "${args.message}"`;
    case "git_branch":
      return args.branchName 
        ? `Git ${args.action}: ${args.branchName}` 
        : `Git ${args.action}`;
    case "git_status":
      return "Getting git status";
    case "git_diff":
      return args.file ? `Git diff: ${args.file}` : "Git diff";
    case "install_packages":
      return `Installing ${args.packages?.join?.(", ") || "packages"}`;
    case "run_tests":
      return args.testPattern 
        ? `Running tests: ${args.testPattern}` 
        : "Running tests";
    case "read_multiple_files":
      return `Reading ${args.paths?.length || 0} files`;
    default:
      return toolName.replace(/_/g, " ");
  }
}

/**
 * Format tool result output
 */
function formatOutput(toolName: string, result: any): React.ReactNode {
  if (!result) return <span className="text-zinc-600 italic">No output</span>;

  // Handle errors
  if (result.error || result.success === false) {
    return <div className="text-red-400">{result.error || result.message || "Error occurred"}</div>;
  }

  // Handle success messages
  switch (toolName) {
    case "write_file":
      if (result.success) {
        return <div className="text-emerald-400">✓ Successfully wrote to {result.path}</div>;
      }
      break;
    
    case "list_directory":
      if (result.entries) {
        return (
          <div className="space-y-1">
            <div className="text-emerald-400">✓ Found {result.entries.length} items</div>
            <div className="text-zinc-500 text-[10px] max-h-20 overflow-auto">
              {result.entries.slice(0, 10).map((entry: any, i: number) => (
                <div key={i}>• {entry.name || entry}</div>
              ))}
              {result.entries.length > 10 && <div>... and {result.entries.length - 10} more</div>}
            </div>
          </div>
        );
      }
      break;
    
    case "read_multiple_files":
      if (result.successCount) {
        return (
          <div className="text-emerald-400">
            ✓ Read {result.successCount}/{result.totalCount} files
          </div>
        );
      }
      break;
    
    case "find_files":
      if (result.files) {
        return (
          <div className="space-y-1">
            <div className="text-emerald-400">✓ Found {result.files.length} files</div>
            {result.files.length > 0 && (
              <div className="text-zinc-500 text-[10px] max-h-20 overflow-auto">
                {result.files.slice(0, 8).map((file: string, i: number) => (
                  <div key={i}>• {file}</div>
                ))}
                {result.files.length > 8 && <div>... and {result.files.length - 8} more</div>}
              </div>
            )}
          </div>
        );
      }
      break;
  }

  // Default: show success or JSON
  if (result.success) {
    return <div className="text-emerald-400">✓ Success</div>;
  }

  // Fallback to JSON
  return (
    <div className="font-mono whitespace-pre-wrap text-[10px] text-zinc-400">
      {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
    </div>
  );
}

interface ToolCallDisplayProps {
  toolName: string;
  args: any;
  result?: any;
  isExecuting?: boolean;
  isComplete?: boolean;
  hasError?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ToolCallDisplay({
  toolName,
  args,
  result,
  isExecuting = false,
  isComplete = false,
  hasError = false,
  isExpanded,
  onToggle,
}: ToolCallDisplayProps) {
  const IconComponent = TOOL_ICONS[toolName] || Activity;
  const description = getToolDescription(toolName, args);

  return (
    <div className={`group relative border rounded-md overflow-hidden transition-all ${
      hasError 
        ? 'bg-red-950/20 border-red-800/30 hover:border-red-700/50' 
        : isComplete
        ? 'bg-emerald-950/20 border-emerald-800/30 hover:border-emerald-700/50'
        : 'bg-zinc-900/20 border-zinc-800/30 hover:border-zinc-700/50'
    }`}>
      <button
        onClick={onToggle}
        className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left"
      >
        {/* Status Icon */}
        <div className={`h-4 w-4 rounded flex items-center justify-center shrink-0 transition-all ${
          hasError 
            ? 'bg-red-500/10 border border-red-500/20' 
            : isComplete
            ? 'bg-emerald-500/10 border border-emerald-500/20'
            : 'bg-zinc-500/10 border border-zinc-500/20'
        }`}>
          {hasError ? (
            <AlertCircle className="h-2.5 w-2.5 text-red-500" />
          ) : isExecuting ? (
            <Loader2 className="h-2.5 w-2.5 text-emerald-400 animate-spin" />
          ) : isComplete ? (
            <Check className="h-2.5 w-2.5 text-emerald-500" />
          ) : (
            <IconComponent className="h-2.5 w-2.5 text-zinc-500" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <span className={`text-[11px] font-medium block truncate ${
            hasError ? 'text-red-400' : isComplete ? 'text-emerald-300' : 'text-zinc-300'
          }`}>
            {description}
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
            <ChevronUp className="h-2.5 w-2.5 text-zinc-600" />
          ) : (
            <ChevronDown className="h-2.5 w-2.5 text-zinc-600" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-zinc-800/30 bg-black/10">
          {/* Show output */}
          {(result || isExecuting) && (
            <div className="mt-2">
              <div className="text-[10px] font-semibold text-emerald-500/70 mb-1 tracking-wide">
                {hasError ? "ERROR" : "RESULT"}
              </div>
              <div className={`text-xs bg-zinc-950/50 border p-2 rounded overflow-auto max-h-40 ${
                hasError 
                  ? 'text-red-400 border-red-800/30' 
                  : 'text-zinc-400 border-zinc-800/30'
              }`}>
                {result ? (
                  formatOutput(toolName, result)
                ) : (
                  <span className="text-zinc-600 italic">Executing...</span>
                )}
              </div>
            </div>
          )}
          
          {/* Show raw input */}
          <details className="mt-2">
            <summary className="text-[10px] font-semibold text-zinc-500 cursor-pointer hover:text-zinc-400 transition-colors">
              RAW DATA
            </summary>
            <div className="mt-1 text-[9px] text-zinc-600 font-mono bg-zinc-950/50 border border-zinc-800/30 p-1.5 rounded overflow-auto max-h-24">
              <div className="text-emerald-500/50 mb-0.5">Input:</div>
              {args && Object.keys(args).length > 0 ? (
                <pre className="whitespace-pre-wrap">{JSON.stringify(args, null, 2)}</pre>
              ) : (
                <span className="text-zinc-700 italic">{"{}"}</span>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

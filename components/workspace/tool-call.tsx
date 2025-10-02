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
  Loader2,
  FolderOpen,
  FileText,
  FilePlus,
  FileX,
  FolderPlus,
  GitBranch,
  Package,
  TestTube,
  Globe,
  Code2,
  Bug,
  Info,
} from "lucide-react";
import type { MessagePart } from "./types";

const TOOL_ICONS: Record<string, React.ComponentType<any>> = {
  listFiles: FolderOpen,
  readFile: FileText,
  readFileLines: FileCode,
  readMultipleFiles: FileCode,
  searchCode: Search,
  runCommand: TerminalIcon,
  writeFile: FilePlus,
  deleteFile: FileX,
  moveFile: FileCode,
  createDirectory: FolderPlus,
  fileTree: FolderOpen,
  findFiles: Search,
  getFileInfo: Info,
  gitCommit: GitCommit,
  gitBranch: GitBranch,
  gitStash: GitCommit,
  gitPush: Upload,
  installPackages: Package,
  runTests: TestTube,
  webResearch: Globe,
  editCode: Code2,
  getConsoleLogs: TerminalIcon,
  getLintErrors: Bug,
  getProblems: AlertCircle,
  runInTerminal: TerminalIcon,
  formatDocument: Code2,
  goToDefinition: Search,
  findReferences: Search,
  searchSymbols: Search,
  getHover: Info,
  getCodeActions: Code2,
  applyCodeAction: Check,
  scrapeWebPage: Globe,
};

/**
 * Display formatted output based on tool type
 */
function OutputDisplay({ 
  toolName, 
  output, 
  hasError 
}: { 
  toolName: string; 
  output: any; 
  hasError: boolean;
}) {
  if (hasError) {
    return (
      <div className="font-mono whitespace-pre-wrap">
        {output?.error || output?.message || JSON.stringify(output, null, 2)}
      </div>
    );
  }

  // Handle string outputs
  if (typeof output === "string") {
    return <div className="font-mono whitespace-pre-wrap">{output}</div>;
  }

  // Format specific tool outputs
  switch (toolName) {
    case "readFile":
    case "readFileLines":
      if (output.success && output.content) {
        const lines = output.content.split('\n').length;
        return (
          <div className="space-y-1">
            <div className="text-emerald-400">✓ Read {lines} line{lines !== 1 ? 's' : ''} from {output.path}</div>
            {output.startLine && output.endLine && (
              <div className="text-zinc-500 text-[10px]">Lines {output.startLine}-{output.endLine}</div>
            )}
          </div>
        );
      }
      break;

    case "writeFile":
      if (output.success) {
        return <div className="text-emerald-400">✓ Successfully wrote to {output.path}</div>;
      }
      break;

    case "listFiles":
      if (output.success && output.files) {
        return (
          <div className="space-y-1">
            <div className="text-emerald-400">✓ Found {output.files.length} item{output.files.length !== 1 ? 's' : ''}</div>
            <div className="text-zinc-500 text-[10px] max-h-20 overflow-auto">
              {output.files.slice(0, 10).map((file: any, i: number) => (
                <div key={i}>• {typeof file === 'string' ? file : file.name}</div>
              ))}
              {output.files.length > 10 && <div>... and {output.files.length - 10} more</div>}
            </div>
          </div>
        );
      }
      break;

    case "searchCode":
      if (output.success && output.results) {
        return (
          <div className="text-emerald-400">
            ✓ Found {output.results.length} match{output.results.length !== 1 ? 'es' : ''}
          </div>
        );
      }
      break;

    case "runCommand":
      if (output.success) {
        return (
          <div className="space-y-1">
            <div className="text-emerald-400">✓ Command executed</div>
            {output.stdout && (
              <div className="text-zinc-400 text-[10px] font-mono max-h-20 overflow-auto whitespace-pre-wrap">
                {output.stdout}
              </div>
            )}
          </div>
        );
      }
      break;

    case "gitCommit":
    case "gitPush":
      if (output.success) {
        return <div className="text-emerald-400">✓ {output.message || 'Success'}</div>;
      }
      break;

    case "readMultipleFiles":
      if (output.success) {
        return (
          <div className="text-emerald-400">
            ✓ Read {output.successCount}/{output.totalCount} files
          </div>
        );
      }
      break;

    case "findFiles":
      if (output.success && output.files) {
        return (
          <div className="space-y-1">
            <div className="text-emerald-400">✓ Found {output.count} file{output.count !== 1 ? 's' : ''}</div>
            {output.files.length > 0 && (
              <div className="text-zinc-500 text-[10px] max-h-20 overflow-auto">
                {output.files.slice(0, 8).map((file: string, i: number) => (
                  <div key={i}>• {file}</div>
                ))}
                {output.files.length > 8 && <div>... and {output.files.length - 8} more</div>}
              </div>
            )}
          </div>
        );
      }
      break;

    case "getProblems":
      if (output.success) {
        return (
          <div className="text-emerald-400">
            {output.count === 0 
              ? '✓ No problems found' 
              : `⚠ Found ${output.count} problem${output.count !== 1 ? 's' : ''}`}
          </div>
        );
      }
      break;

    case "installPackages":
      if (output.success) {
        return (
          <div className="text-emerald-400">
            ✓ Installed {output.packages?.join(', ')}
          </div>
        );
      }
      break;

    case "scrapeWebPage":
      if (output.success) {
        return (
          <div className="space-y-1">
            <div className="text-emerald-400">✓ Scraped {output.url}</div>
            <div className="text-zinc-500 text-[10px]">
              {output.title && <div>Title: {output.title}</div>}
              {output.contentLength && <div>Content: {output.contentLength} characters</div>}
              {output.linksCount > 0 && <div>Links: {output.linksCount}</div>}
              {output.imagesCount > 0 && <div>Images: {output.imagesCount}</div>}
            </div>
          </div>
        );
      }
      break;
  }

  // Default: show JSON for success, or error message
  if (output.success === false && output.error) {
    return <div className="text-red-400">{output.error}</div>;
  }

  if (output.success) {
    return <div className="text-emerald-400">✓ Success</div>;
  }

  return (
    <div className="font-mono whitespace-pre-wrap text-[10px]">
      {JSON.stringify(output, null, 2)}
    </div>
  );
}

/**
 * Generate human-readable description for a tool call
 */
function getToolDescription(toolName: string, input: any): string {
  if (!input) return toolName;

  switch (toolName) {
    case "readFile":
      return `Reading ${input.path || "file"}`;
    case "readFileLines":
      return `Reading ${input.path || "file"}:${input.startLine}-${input.endLine}`;
    case "writeFile":
      return `Writing to ${input.path || "file"}`;
    case "listFiles":
      return `Listing ${input.path || "."}/`;
    case "searchCode":
      return `Searching for "${input.query}"`;
    case "runCommand":
      return `Running: ${input.command}`;
    case "deleteFile":
      return `Deleting ${input.path}`;
    case "moveFile":
      return `Moving ${input.source} → ${input.destination}`;
    case "createDirectory":
      return `Creating directory ${input.path}`;
    case "fileTree":
      return `Tree view of ${input.path || "."}`;
    case "findFiles":
      return `Finding files: ${input.pattern}`;
    case "getFileInfo":
      return `Getting info for ${input.path}`;
    case "gitCommit":
      return `Committing: "${input.message}"`;
    case "gitBranch":
      return input.branchName 
        ? `Git ${input.action}: ${input.branchName}` 
        : `Git ${input.action}`;
    case "gitStash":
      return `Git stash ${input.action}`;
    case "gitPush":
      return "Pushing to remote";
    case "installPackages":
      return `Installing ${input.packages?.join(", ")}`;
    case "runTests":
      return input.testPattern 
        ? `Running tests: ${input.testPattern}` 
        : "Running tests";
    case "webResearch":
      return `Researching: ${input.task}`;
    case "editCode":
      return `Editing code: ${input.instruction}`;
    case "readMultipleFiles":
      return `Reading ${input.paths?.length || 0} files`;
    case "getConsoleLogs":
      return `Getting console logs`;
    case "getLintErrors":
      return input.path ? `Linting ${input.path}` : "Getting lint errors";
    case "getProblems":
      return input.severity 
        ? `Getting ${input.severity} problems` 
        : "Getting all problems";
    case "runInTerminal":
      return `Terminal: ${input.command}`;
    case "formatDocument":
      return `Formatting ${input.filePath}`;
    case "goToDefinition":
      return `Finding definition in ${input.filePath}:${input.line}`;
    case "findReferences":
      return `Finding references in ${input.filePath}:${input.line}`;
    case "searchSymbols":
      return `Searching symbols: ${input.query}`;
    case "getHover":
      return `Getting info for ${input.filePath}:${input.line}`;
    case "getCodeActions":
      return `Getting fixes for ${input.filePath}:${input.line}`;
    case "applyCodeAction":
      return `Applying fix #${input.actionId}`;
    case "scrapeWebPage":
      return `Scraping ${input.url}`;
    default:
      return toolName.replace(/([A-Z])/g, " $1").trim();
  }
}

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
    const isExecuting = toolPart.state === "input-streaming" || toolPart.state === "input-available";
    const isComplete = toolPart.state === "output-available";
    const hasError = toolPart.state === "output-error";
    const description = getToolDescription(toolPart.toolName, toolPart.input);

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
            {/* Show output summary or full output */}
            <div className="mt-2">
              <div className="text-[10px] font-semibold text-emerald-500/70 mb-1 tracking-wide">
                {hasError ? "ERROR" : "RESULT"}
              </div>
              <div className={`text-xs bg-zinc-950/50 border p-2 rounded overflow-auto max-h-40 ${
                hasError 
                  ? 'text-red-400 border-red-800/30' 
                  : 'text-zinc-400 border-zinc-800/30'
              }`}>
                {toolPart.output ? (
                  <OutputDisplay 
                    toolName={toolPart.toolName} 
                    output={toolPart.output} 
                    hasError={hasError}
                  />
                ) : (
                  <span className="text-zinc-600 italic">
                    {isExecuting ? "Executing..." : "No output"}
                  </span>
                )}
              </div>
            </div>
            
            {/* Show raw input in collapsed section */}
            <details className="mt-2">
              <summary className="text-[10px] font-semibold text-zinc-500 cursor-pointer hover:text-zinc-400 transition-colors">
                RAW DATA
              </summary>
              <div className="mt-1 space-y-1">
                <div className="text-[9px] text-zinc-600 font-mono bg-zinc-950/50 border border-zinc-800/30 p-1.5 rounded overflow-auto max-h-24">
                  <div className="text-emerald-500/50 mb-0.5">Input:</div>
                  {toolPart.input && Object.keys(toolPart.input).length > 0 ? (
                    <pre className="whitespace-pre-wrap">{JSON.stringify(toolPart.input, null, 2)}</pre>
                  ) : (
                    <span className="text-zinc-700 italic">{"{}"}</span>
                  )}
                </div>
                <div className="text-[9px] text-zinc-600 font-mono bg-zinc-950/50 border border-zinc-800/30 p-1.5 rounded overflow-auto max-h-24">
                  <div className="text-emerald-500/50 mb-0.5">Output:</div>
                  <pre className="whitespace-pre-wrap">
                    {toolPart.output 
                      ? typeof toolPart.output === "string"
                        ? toolPart.output
                        : JSON.stringify(toolPart.output, null, 2)
                      : "null"}
                  </pre>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    );
  }
);

ToolCall.displayName = "ToolCall";

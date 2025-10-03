"use client";

import { 
  Brain, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle,
  Terminal as TerminalIcon,
  FileCode,
  Search,
  GitCommit,
  Activity,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useState, useMemo } from "react";
import { ToolCallDisplay } from "./tool-call-display";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  parts?: any[]; // Message parts (text, tool-call, tool-result) for workspace-style messages
}

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

interface TimelineItem {
  type: "message" | "tool-call";
  timestamp: string;
  data: ConversationMessage | ToolCall;
}

interface AgentTimelineProps {
  messages: ConversationMessage[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  streamingText?: string;
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

export function AgentTimeline({
  messages,
  toolCalls,
  toolResults,
  streamingText,
}: AgentTimelineProps) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // Track which tools are currently executing (have call but no result yet)
  const executingTools = useMemo(() => {
    const resultIds = new Set(toolResults.map(tr => tr.toolCallId));
    return toolCalls.filter(tc => {
      // Check explicit state first, then fall back to result check
      if (tc.state) {
        return tc.state === "executing";
      }
      return !resultIds.has(tc.id);
    });
  }, [toolCalls, toolResults]);

  // Compute sorted timeline of messages and tool calls
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    // Add all conversation messages
    messages.forEach((msg) => {
      items.push({
        type: "message",
        timestamp: msg.timestamp,
        data: msg,
      });
    });

    // DO NOT add individual tool calls to timeline if messages have parts
    // Tool calls are already included in message.parts
    // Individual tool calls are only for Activity tab real-time updates
    // Only add tool calls if there are NO messages with parts (backwards compat)
    const hasMessageParts = messages.some(m => m.parts && m.parts.length > 0);
    if (!hasMessageParts) {
      // Legacy mode: add individual tool calls
      toolCalls.forEach((toolCall) => {
        items.push({
          type: "tool-call",
          timestamp: toolCall.timestamp,
          data: toolCall,
        });
      });
    }

    // Sort by timestamp (chronological order) - this will properly interleave everything
    return items.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [messages, toolCalls, toolResults]);

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


  if (timeline.length === 0 && !streamingText) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-2 text-2xl">⚡</div>
          <p className="text-xs text-zinc-500">
            Agent ready. Activity will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="max-w-3xl mx-auto space-y-3">
        {timeline.map((item, idx) => (
          <div key={`${item.type}-${idx}`} className="space-y-2">
            {/* User Messages */}
            {item.type === "message" &&
              (item.data as ConversationMessage).role === "user" && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-4 w-4 rounded-md bg-zinc-800/50 flex items-center justify-center">
                      <span className="text-[9px] text-zinc-400">You</span>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-200 leading-relaxed">
                    {(item.data as ConversationMessage).content}
                  </div>
                </div>
              )}

            {/* Assistant Messages */}
            {item.type === "message" &&
              (item.data as ConversationMessage).role === "assistant" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="h-4 w-4 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <Brain className="h-2.5 w-2.5 text-emerald-500" />
                    </div>
                    <span className="text-[9px] text-zinc-500 font-medium">
                      Agent
                    </span>
                  </div>
                  
                  {/* Check if message has parts (workspace-style) */}
                  {(item.data as ConversationMessage).parts ? (
                    <div className="space-y-2">
                      {(item.data as ConversationMessage).parts!.map((part: any, partIdx: number) => {
                        // For tool-call parts, find matching result
                        if (part.type === "tool-call") {
                          const result = (item.data as ConversationMessage).parts!.find(
                            (p: any) => p.type === "tool-result" && p.toolCallId === part.toolCallId
                          );
                          
                          return (
                            <ToolCallDisplay
                              key={partIdx}
                              toolName={part.toolName}
                              args={part.args}
                              result={result?.result}
                              isExecuting={!result}
                              isComplete={!!result}
                              hasError={result?.result?.success === false}
                              isExpanded={expandedTools.has(part.toolCallId)}
                              onToggle={() => toggleTool(part.toolCallId)}
                            />
                          );
                        }
                        
                        // Skip tool-result parts (they're shown in tool-call)
                        if (part.type === "tool-result") {
                          return null;
                        }
                        
                        // Text part
                        if (part.type === "text") {
                          return (
                            <div key={partIdx} className="text-[13px] text-zinc-300 prose prose-invert prose-sm max-w-none prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:text-emerald-400 prose-code:bg-zinc-900/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900/50 prose-pre:border prose-pre:border-zinc-800 prose-headings:text-zinc-200 prose-headings:font-semibold prose-strong:text-zinc-100 prose-strong:font-semibold">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeHighlight]}
                              >
                                {part.text}
                              </ReactMarkdown>
                            </div>
                          );
                        }
                        
                        return null;
                      })}
                    </div>
                  ) : (
                    /* Old-style message with plain content */
                    <div className="text-[13px] text-zinc-300 prose prose-invert prose-sm max-w-none prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:text-emerald-400 prose-code:bg-zinc-900/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900/50 prose-pre:border prose-pre:border-zinc-800 prose-headings:text-zinc-200 prose-headings:font-semibold prose-strong:text-zinc-100 prose-strong:font-semibold">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                      >
                        {(item.data as ConversationMessage).content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

            {/* Tool Calls - Compact design matching workspace */}
            {item.type === "tool-call" &&
              (() => {
                const toolCall = item.data as ToolCall;
                const isExpanded = expandedTools.has(toolCall.id);
                // Check state: explicit state or check if in executing list
                const isExecuting = toolCall.state === "executing" || executingTools.some(et => et.id === toolCall.id);
                const isComplete = toolCall.state === "complete" || toolResults.some(tr => tr.toolCallId === toolCall.id);
                const hasError = toolCall.state === "error";
                const IconComponent =
                  TOOL_ICONS[toolCall.function?.name || toolCall.type] ||
                  Activity;
                
                // Parse arguments for description
                let args: any = {};
                try {
                  args = typeof toolCall.function?.arguments === "string"
                    ? JSON.parse(toolCall.function.arguments)
                    : toolCall.function?.arguments || {};
                } catch (e) {
                  args = {};
                }

                // Generate human-readable description
                const toolName = toolCall.function?.name || toolCall.type;
                let description = toolName.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
                
                // Add context from arguments
                if (args.path) description = `${description.split(' ')[0]} ${args.path}`;
                else if (args.command) description = `Running: ${args.command}`;
                else if (args.query) description = `Searching: ${args.query}`;
                else if (args.pattern) description = `Finding: ${args.pattern}`;

                return (
                  <div className={`group relative border rounded-md overflow-hidden transition-all ${
                    hasError 
                      ? 'bg-red-950/20 border-red-800/30 hover:border-red-700/50' 
                      : isComplete
                      ? 'bg-emerald-950/20 border-emerald-800/30 hover:border-emerald-700/50'
                      : 'bg-zinc-900/20 border-zinc-800/30 hover:border-zinc-700/50'
                  }`}>
                    <button
                      onClick={() => toggleTool(toolCall.id)}
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
                        {/* Show result if available */}
                        {(() => {
                          const result = toolResults.find(tr => tr.toolCallId === toolCall.id);
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
                        
                        {/* Show raw input in collapsed section */}
                        <details className="mt-2">
                          <summary className="text-[10px] font-semibold text-zinc-500 cursor-pointer hover:text-zinc-400 transition-colors">
                            RAW DATA
                          </summary>
                          <div className="mt-1 space-y-1">
                            <div className="text-[9px] text-zinc-600 font-mono bg-zinc-950/50 border border-zinc-800/30 p-1.5 rounded overflow-auto max-h-24">
                              <div className="text-emerald-500/50 mb-0.5">Input:</div>
                              {Object.keys(args).length > 0 ? (
                                <pre className="whitespace-pre-wrap">{JSON.stringify(args, null, 2)}</pre>
                              ) : (
                                <span className="text-zinc-700 italic">{"{}"}</span>
                              )}
                            </div>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                );
              })()}

          </div>
        ))}

        {/* Streaming message */}
        {streamingText && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="h-4 w-4 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Brain className="h-2.5 w-2.5 text-emerald-500" />
              </div>
              <span className="text-[9px] text-zinc-500 font-medium">
                Agent
              </span>
            </div>
            <div className="text-xs text-zinc-300 prose prose-invert prose-sm max-w-none prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:text-emerald-400 prose-code:bg-zinc-900/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900/50 prose-pre:border prose-pre:border-zinc-800 prose-headings:text-zinc-200 prose-headings:font-semibold prose-strong:text-zinc-100 prose-strong:font-semibold">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {streamingText}
              </ReactMarkdown>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-600 text-[10px]">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>Streaming...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

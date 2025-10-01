"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/sidebar";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Loader2,
  ArrowLeft,
  Github,
  GitBranch,
  CheckCircle2,
  XCircle,
  Upload,
  Send,
  MessageSquare,
  FileCode,
  Activity,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Terminal as TerminalIcon,
  Search,
  GitCommit,
  AlertCircle,
  Brain,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface Agent {
  id: string;
  name: string;
  task: string;
  githubRepo: string;
  sourceBranch: string;
  targetBranch: string;
  status: "IDLE" | "CLONING" | "RUNNING" | "COMPLETED" | "ERROR" | "PUSHING";
  errorMessage?: string;
  toolCalls?: string;
  filesEdited?: string;
  instructionQueue?: string;
  conversationHistory?: string;
  pushedAt?: string;
  lastMessageAt?: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  type?: string;
}

interface ToolCall {
  id: string;
  type: string;
  function?: {
    name: string;
    arguments: string;
  };
  timestamp: string;
}

interface EditedFile {
  path: string;
  operation: "created" | "modified" | "deleted";
  timestamp: string;
  originalContent?: string;
  newContent?: string;
  diff?: string;
}

// Timeline item - unifies messages and tool calls for proper ordering
interface TimelineItem {
  type: "message" | "tool-call";
  timestamp: string;
  data: ConversationMessage | ToolCall;
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
};

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params?.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [filesEdited, setFilesEdited] = useState<EditedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<EditedFile | null>(null);
  const [instruction, setInstruction] = useState("");
  const [sending, setSending] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const streamingTextRef = useRef("");
  const activityEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(384); // 96 * 4 = 384px (w-96)
  const [isResizing, setIsResizing] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [resuming, setResuming] = useState(false);

  // Compute sorted timeline of messages and tool calls
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    // Add all conversation messages
    conversation.forEach((msg) => {
      items.push({
        type: "message",
        timestamp: msg.timestamp,
        data: msg,
      });
    });

    // Add all tool calls (only if they come AFTER the last user message)
    // This prevents tool calls from appearing before their triggering message
    const lastUserMessage = conversation
      .filter((m) => m.role === "user")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    
    const lastUserTimestamp = lastUserMessage 
      ? new Date(lastUserMessage.timestamp).getTime() 
      : 0;

    toolCalls.forEach((toolCall) => {
      const toolTimestamp = new Date(toolCall.timestamp).getTime();
      // Only add tool calls that happened after the last user message
      if (toolTimestamp >= lastUserTimestamp) {
        items.push({
          type: "tool-call",
          timestamp: toolCall.timestamp,
          data: toolCall,
        });
      }
    });

    // Sort by timestamp (chronological order)
    return items.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [conversation, toolCalls]);

  useEffect(() => {
    if (agentId) {
      fetchAgent();
      // Connect to SSE stream for real-time updates
      connectToStream();
    }
  }, [agentId]);

  // Handle sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      // Constrain between 300px and 800px
      setSidebarWidth(Math.max(300, Math.min(800, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Auto-scroll activity when tool calls change
  useEffect(() => {
    if (activityEndRef.current && !showChat) {
      activityEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [toolCalls, showChat]);

  // Auto-scroll chat when conversation or streaming changes
  useEffect(() => {
    if (chatEndRef.current && showChat) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [conversation, streamingText, showChat, timeline]);

  const connectToStream = () => {
    if (!agentId) return;

    const eventSource = new EventSource(`/api/agents/${agentId}/stream`);
    let updateTimeout: NodeJS.Timeout | null = null;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "init":
            console.log("SSE connected:", data);
            setIsLiveStreaming(true);
            break;

          case "status":
            setAgent((prev) =>
              prev
                ? {
                    ...prev,
                    status: data.status,
                    errorMessage: data.error || prev.errorMessage,
                  }
                : null
            );
            // Show error alert if status is ERROR
            if (data.status === "ERROR" && data.error) {
              console.error("Agent error:", data.error);
            }
            break;

          case "tool-call":
            // Batch tool call updates to reduce re-renders
            setToolCalls((prev) => {
              const exists = prev.some((tc) => tc.id === data.toolCall.id);
              if (exists) return prev;
              
              // Parse arguments if they're a string
              const toolCall = { ...data.toolCall };
              if (toolCall.function?.arguments && typeof toolCall.function.arguments === 'string') {
                try {
                  toolCall.function.arguments = toolCall.function.arguments;
                } catch (e) {
                  console.error('Failed to parse tool arguments:', e);
                }
              }
              
              return [...prev, toolCall];
            });
            break;

          case "tool-result":
            // Log tool results for debugging
            console.log(`📤 Tool result received: ${data.toolName}`, data.result);
            break;

          case "message":
            // Only add if it's truly a new message (not a duplicate from streaming)
            setConversation((prev) => {
              // Check if message already exists (by timestamp and role)
              const exists = prev.some(
                (msg) =>
                  msg.timestamp === data.message.timestamp &&
                  msg.role === data.message.role
              );

              // Also check if we just added this from streaming (by content match)
              const recentMessage = prev[prev.length - 1];
              const isDuplicateStream =
                recentMessage?.role === "assistant" &&
                recentMessage?.content === data.message.content;

              if (exists || isDuplicateStream) {
                return prev;
              }

              return [...prev, data.message];
            });
            streamingTextRef.current = ""; // Reset accumulator
            setStreamingText(""); // Clear streaming text when message completes
            break;

          case "streaming":
            // Accumulate streaming text chunks
            streamingTextRef.current += data.content;

            // Update immediately for real-time feel (no debounce)
            setStreamingText(streamingTextRef.current);
            break;

          case "files":
            setFilesEdited((prev) => {
              // Only update if files actually changed
              if (JSON.stringify(prev) === JSON.stringify(data.files)) {
                return prev;
              }
              return data.files;
            });
            if (data.files.length > 0 && !selectedFile) {
              setSelectedFile(data.files[0]);
            }
            break;

          case "done":
            console.log("Received done event - agent completed");
            setIsLiveStreaming(false);

            // If we have accumulated streaming text, add it as a message
            if (streamingTextRef.current) {
              const assistantMessage: ConversationMessage = {
                role: "assistant",
                content: streamingTextRef.current,
                timestamp: new Date().toISOString(),
              };
              setConversation((prev) => [...prev, assistantMessage]);
            }

            streamingTextRef.current = ""; // Reset accumulator
            setStreamingText(""); // Clear streaming indicator
            
            if (updateTimeout) {
              clearTimeout(updateTimeout);
            }
            
            // Update agent status locally
            setAgent((prev) => prev ? { ...prev, status: "COMPLETED" } : null);
            
            // Keep stream open for potential resume - don't close EventSource!
            console.log("Stream remains open for potential resume");
            
            // Don't fetch - we already have all data from streaming!
            break;

          default:
            console.log("Unknown SSE event type:", data.type);
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      setIsLiveStreaming(false);
      eventSource.close();
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      // Don't fallback to polling - just reconnect SSE or rely on manual refresh
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
      setIsLiveStreaming(false);
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
    };
  };

  const fetchAgent = async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setAgent(data);

        if (data.toolCalls) {
          const parsed = JSON.parse(data.toolCalls);
          // Handle both old format (array) and new format (object with count)
          setToolCalls(Array.isArray(parsed) ? parsed : []);
        }
        if (data.filesEdited) {
          const files = JSON.parse(data.filesEdited);
          setFilesEdited(Array.isArray(files) ? files : []);
          if (files.length > 0 && !selectedFile) {
            setSelectedFile(files[0]);
          }
        }
        if (data.conversationHistory) {
          setConversation(JSON.parse(data.conversationHistory));
        }
      }
    } catch (error) {
      console.error("Failed to fetch agent:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatMessage.trim()) return;

    setSendingChat(true);
    setIsLiveStreaming(true); // Show streaming indicator
    // Stay on chat tab when sending
    setShowChat(true);

    // Clear input immediately for better UX
    const messageToSend = chatMessage;
    setChatMessage("");

    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend }),
      });

      if (!res.ok) {
        alert("Failed to send message");
        setIsLiveStreaming(false);
      }
      // SSE stream will handle all updates (user message + assistant response)
    } catch (error) {
      console.error("Error sending chat:", error);
      alert("Failed to send message");
      setIsLiveStreaming(false);
    } finally {
      setSendingChat(false);
    }
  };

  const handleResumeAgent = async () => {
    if (!chatMessage.trim()) return;

    setResuming(true);
    // Stay on chat tab when resuming
    setShowChat(true);

    // Optimistically add user message to conversation
    const userMessage: ConversationMessage = {
      role: "user",
      content: chatMessage,
      timestamp: new Date().toISOString(),
      type: "resume_task",
    };
    setConversation((prev) => [...prev, userMessage]);

    // Clear input immediately for better UX
    const messageToSend = chatMessage;
    setChatMessage("");

    try {
      const res = await fetch(`/api/agents/${agentId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTask: messageToSend }),
      });

      if (!res.ok) {
        // Remove optimistic message on error
        setConversation((prev) =>
          prev.filter((msg) => msg.timestamp !== userMessage.timestamp)
        );
        const error = await res.json();
        alert(error.error || "Failed to resume agent");
      }
      // SSE will handle the agent's response
    } catch (error) {
      console.error("Error resuming agent:", error);
      // Remove optimistic message on error
      setConversation((prev) =>
        prev.filter((msg) => msg.timestamp !== userMessage.timestamp)
      );
      alert("Failed to resume agent");
    } finally {
      setResuming(false);
    }
  };

  const handleSendInstruction = async () => {
    if (!instruction.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/instruct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });

      if (res.ok) {
        // Just clear the instruction - SSE will handle updates
        setInstruction("");
      } else {
        alert("Failed to send instruction");
      }
    } catch (error) {
      console.error("Error sending instruction:", error);
      alert("Failed to send instruction");
    } finally {
      setSending(false);
    }
  };

  const handlePushToGitHub = async () => {
    setPushing(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/push`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Successfully pushed to ${data.branch}`);
        // Fetch agent once to update pushedAt status
        await fetchAgent();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to push to GitHub");
      }
    } catch (error) {
      console.error("Error pushing to GitHub:", error);
      alert("Failed to push to GitHub");
    } finally {
      setPushing(false);
    }
  };

  const statusConfig = {
    IDLE: {
      color: "bg-zinc-800/80 text-zinc-400 border-zinc-700/50",
      icon: null,
    },
    CLONING: {
      color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    RUNNING: {
      color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    COMPLETED: {
      color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    ERROR: {
      color: "bg-red-500/20 text-red-300 border-red-500/30",
      icon: <XCircle className="h-3 w-3" />,
    },
    PUSHING: {
      color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      icon: <Upload className="h-3 w-3 animate-pulse" />,
    },
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-zinc-950 items-center justify-center">
        <Loader2 className="h-12 w-12 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-screen bg-zinc-950 items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Agent not found</p>
          <Button onClick={() => router.push("/dashboard/agents")}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-zinc-800/50 px-6 py-4 bg-zinc-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push("/dashboard/agents")}
              className="text-zinc-400 hover:text-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Bot className="h-5 w-5 text-emerald-400" />
            <div className="flex-1">
              <h1 className="text-lg font-medium text-zinc-100">
                {agent.name}
              </h1>
              <p className="text-sm text-zinc-500">{agent.task}</p>
            </div>
            <div className="flex items-center gap-2">
              {isLiveStreaming && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5">
                  <div className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse" />
                  Live
                </Badge>
              )}
              <Badge
                className={`${
                  statusConfig[agent.status].color
                } text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5`}
              >
                {statusConfig[agent.status].icon}
                {agent.status.charAt(0) + agent.status.slice(1).toLowerCase()}
              </Badge>
            </div>
            {agent.status === "COMPLETED" && !agent.pushedAt && (
              <Button
                size="sm"
                className="bg-purple-600 text-white hover:bg-purple-500"
                onClick={handlePushToGitHub}
                disabled={pushing}
              >
                {pushing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Pushing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Push to GitHub
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Repository Info */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-800/50">
              <Github className="h-4 w-4 text-zinc-500" />
              <span className="font-mono text-xs">{agent.githubRepo}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-800/50">
              <GitBranch className="h-4 w-4 text-zinc-500" />
              <span className="text-xs">
                {agent.sourceBranch} <span className="text-zinc-600">→</span> {agent.targetBranch}
              </span>
            </div>
            {agent.lastMessageAt && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 ml-auto">
                <Activity className="h-3.5 w-3.5" />
                Last activity: {new Date(agent.lastMessageAt).toLocaleString()}
              </div>
            )}
          </div>

          {/* Error Message Banner */}
          {agent.status === "ERROR" && agent.errorMessage && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-300">
                    Agent Error
                  </p>
                  <p className="text-xs text-red-400 mt-1">
                    {agent.errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Diff Viewer */}
          <div className="flex-1 flex flex-col border-r border-zinc-800/50">
            <div className="border-b border-zinc-800/50 px-4 py-3 bg-zinc-900/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-medium text-zinc-300">
                    Edited Files
                  </h2>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs px-2 py-0.5">
                    {filesEdited.length}
                  </Badge>
                </div>
                {filesEdited.length > 0 && (
                  <div className="text-xs text-zinc-500">
                    {filesEdited.filter(f => f.operation === 'created').length} created, {filesEdited.filter(f => f.operation === 'modified').length} modified
                  </div>
                )}
              </div>
            </div>

            {filesEdited.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-zinc-500">
                <p>No files edited yet</p>
              </div>
            ) : (
              <div className="flex flex-1 overflow-hidden">
                {/* File List */}
                <div className="w-64 border-r border-zinc-800/50 bg-zinc-900/20 overflow-y-auto">
                  {filesEdited.map((file, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedFile(file)}
                      className={`w-full text-left px-4 py-3 text-sm border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-all duration-200 ${
                        selectedFile?.path === file.path
                          ? "bg-zinc-800/50 text-emerald-400 border-l-2 border-l-emerald-500"
                          : "text-zinc-400 border-l-2 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${
                          file.operation === 'created' 
                            ? 'bg-emerald-500 animate-pulse' 
                            : 'bg-blue-500'
                        }`} />
                        <FileCode className="h-4 w-4 shrink-0" />
                        <span className="truncate text-xs">{file.path}</span>
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-1 ml-6">
                        {file.operation === 'created' ? '+ Created' : '~ Modified'}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Diff Display */}
                <div className="flex-1 overflow-y-auto bg-zinc-950/50">
                  {selectedFile && (
                    <div className="p-4">
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-sm font-medium text-zinc-300 font-mono">
                            {selectedFile.path}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <Badge className={`${
                            selectedFile.operation === 'created'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          } text-xs px-2 py-0.5`}>
                            {selectedFile.operation === "created" ? "+ Created" : "~ Modified"}
                          </Badge>
                          <span className="text-zinc-600">
                            {new Date(selectedFile.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
                        {selectedFile.diff ? (
                          <div className="font-mono text-xs">
                            {selectedFile.diff.split("\n").map((line, idx) => {
                              const isAddition = line.startsWith("+ ");
                              const isDeletion = line.startsWith("- ");
                              const isUnchanged = line.startsWith("  ");

                              return (
                                <div
                                  key={idx}
                                  className={`px-4 py-0.5 ${
                                    isAddition
                                      ? "bg-emerald-500/10 text-emerald-300"
                                      : isDeletion
                                      ? "bg-red-500/10 text-red-300"
                                      : "text-zinc-400"
                                  }`}
                                >
                                  <span className="select-none text-zinc-600 mr-2 inline-block w-8 text-right">
                                    {idx + 1}
                                  </span>
                                  <span className="select-none mr-1 text-zinc-600">
                                    {isAddition ? "+" : isDeletion ? "-" : " "}
                                  </span>
                                  {line.substring(2) || " "}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-4 text-xs text-zinc-500 text-center">
                            No diff available
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Tool Calls & Messages / Conversation */}
          <div className="flex flex-col relative" style={{ width: `${sidebarWidth}px` }}>
            {/* Resize Handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-500/50 transition-colors z-10"
              onMouseDown={(e) => {
                setIsResizing(true);
                e.preventDefault();
              }}
            />
            <div className="border-b border-zinc-800/50 px-4 py-3 bg-zinc-900/30">
              <div className="flex items-center justify-between">
                <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg">
                  <button
                    onClick={() => setShowChat(false)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${
                      !showChat
                        ? "bg-emerald-500/10 text-emerald-400 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                    }`}
                  >
                    <Activity className="h-4 w-4" />
                    Activity
                    {toolCalls.length > 0 && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0">
                        {toolCalls.length}
                      </Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setShowChat(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${
                      showChat
                        ? "bg-emerald-500/10 text-emerald-400 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                    }`}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Chat
                    {conversation.length > 0 && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0">
                        {conversation.length}
                      </Badge>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {!showChat ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {toolCalls.length === 0 ? (
                  <p className="text-xs text-zinc-500">No activity yet</p>
                ) : (
                  <>
                    {toolCalls.map((call, idx) => {
                      const IconComponent =
                        TOOL_ICONS[call.function?.name || call.type] ||
                        Activity;
                      return (
                        <Card
                          key={idx}
                          className="p-2.5 bg-zinc-900/50 border-zinc-800/50"
                        >
                          <div className="flex items-start gap-2">
                            <div className="h-4 w-4 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                              <IconComponent className="h-2.5 w-2.5 text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-zinc-300">
                                {(call.function?.name || call.type)
                                  .replace(/([A-Z])/g, " $1")
                                  .replace(/_/g, " ")
                                  .trim()}
                              </p>
                              {call.function?.arguments && (
                                <pre className="mt-1 text-[10px] text-zinc-500 overflow-x-auto max-h-20 overflow-y-auto">
                                  {JSON.stringify(
                                    JSON.parse(call.function.arguments),
                                    null,
                                    2
                                  )}
                                </pre>
                              )}
                              <p className="mt-1 text-[10px] text-zinc-600">
                                {new Date(call.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                    <div ref={activityEndRef} />
                  </>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3">
                {timeline.length === 0 && !streamingText ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center max-w-md">
                      <div className="mb-2 text-2xl">⚡</div>
                      <p className="text-xs text-zinc-500">
                        Agent ready. Conversation will appear here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto space-y-2.5">
                    {/* Render timeline items in chronological order */}
                    {timeline.map((item, idx) => (
                      <div key={`${item.type}-${idx}`} className="space-y-2">
                        {/* User Messages */}
                        {item.type === "message" &&
                          (item.data as ConversationMessage).role ===
                            "user" && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="h-4 w-4 rounded-md bg-zinc-800/50 flex items-center justify-center">
                                  <span className="text-[9px] text-zinc-400">
                                    You
                                  </span>
                                </div>
                              </div>
                              <div className="text-xs text-zinc-200 leading-relaxed">
                                {(item.data as ConversationMessage).content}
                              </div>
                            </div>
                          )}

                        {/* Assistant Messages */}
                        {item.type === "message" &&
                          (item.data as ConversationMessage).role ===
                            "assistant" && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 mb-1">
                                <div className="h-4 w-4 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                  <Brain className="h-2.5 w-2.5 text-emerald-500" />
                                </div>
                                <span className="text-[9px] text-zinc-500 font-medium">
                                  Agent
                                </span>
                              </div>
                              <div className="text-[13px] text-zinc-300 prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  rehypePlugins={[rehypeHighlight]}
                                  components={{
                                    p: ({ children }) => (
                                      <p className="mb-3 leading-relaxed text-[13px]">
                                        {children}
                                      </p>
                                    ),
                                    code: ({
                                      inline,
                                      children,
                                      ...props
                                    }: any) =>
                                      inline ? (
                                        <code
                                          className="px-1 py-0.5 bg-zinc-800/50 text-emerald-400 rounded text-[11px] font-mono"
                                          {...props}
                                        >
                                          {children}
                                        </code>
                                      ) : (
                                        <pre className="bg-zinc-900/50 p-3 rounded-lg my-2 overflow-x-auto border border-zinc-800/30">
                                          <code className="text-[11px] font-mono text-zinc-300">
                                            {children}
                                          </code>
                                        </pre>
                                      ),
                                    pre: ({ children }) => (
                                      <pre className="bg-zinc-900/50 border border-zinc-800/30 rounded-lg p-2 my-2 overflow-x-auto">
                                        {children}
                                      </pre>
                                    ),
                                    ul: ({ children }) => (
                                      <ul className="list-disc list-inside mb-2 space-y-1">
                                        {children}
                                      </ul>
                                    ),
                                    ol: ({ children }) => (
                                      <ol className="list-decimal list-inside mb-2 space-y-1">
                                        {children}
                                      </ol>
                                    ),
                                    li: ({ children }) => (
                                      <li className="text-zinc-400 leading-relaxed text-[13px] mb-1">
                                        {children}
                                      </li>
                                    ),
                                    h1: ({ children }) => (
                                      <h1 className="text-base font-bold text-zinc-100 mb-3 mt-4">
                                        {children}
                                      </h1>
                                    ),
                                    h2: ({ children }) => (
                                      <h2 className="text-sm font-semibold text-zinc-100 mb-2 mt-3">
                                        {children}
                                      </h2>
                                    ),
                                    h3: ({ children }) => (
                                      <h3 className="text-sm font-semibold text-zinc-200 mb-2 mt-2">
                                        {children}
                                      </h3>
                                    ),
                                    blockquote: ({ children }) => (
                                      <blockquote className="border-l-2 border-emerald-500/30 pl-3 py-1 my-2 text-zinc-400 italic text-xs">
                                        {children}
                                      </blockquote>
                                    ),
                                  }}
                                >
                                  {(item.data as ConversationMessage).content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}

                        {/* Tool Calls - now properly interleaved! */}
                        {item.type === "tool-call" &&
                          (() => {
                            const toolCall = item.data as ToolCall;
                            const isExpanded = expandedTools.has(toolCall.id);
                            const IconComponent =
                              TOOL_ICONS[
                                toolCall.function?.name || toolCall.type
                              ] || TerminalIcon;

                            return (
                              <div className="group relative bg-zinc-900/30 border border-zinc-800/40 rounded-lg overflow-hidden hover:border-zinc-700/60 transition-colors">
                                <button
                                  onClick={() =>
                                    setExpandedTools((prev) => {
                                      const newSet = new Set(prev);
                                      if (newSet.has(toolCall.id)) {
                                        newSet.delete(toolCall.id);
                                      } else {
                                        newSet.add(toolCall.id);
                                      }
                                      return newSet;
                                    })
                                  }
                                  className="w-full px-3 py-2 flex items-center gap-2.5 text-left"
                                >
                                  <div className="h-5 w-5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                    <IconComponent className="h-3 w-3 text-emerald-500" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-medium text-zinc-400 block">
                                      {(
                                        toolCall.function?.name || toolCall.type
                                      )
                                        .replace(/([A-Z])/g, " $1")
                                        .replace(/_/g, " ")
                                        .trim()}
                                    </span>
                                    <span className="text-[10px] text-zinc-600 block mt-0.5">
                                      {new Date(
                                        toolCall.timestamp
                                      ).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {isExpanded ? (
                                      <ChevronUp className="h-3 w-3 text-zinc-600" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3 text-zinc-600" />
                                    )}
                                  </div>
                                </button>
                                {isExpanded && toolCall.function?.arguments && (
                                  <div className="px-3 pb-3 border-t border-zinc-800/30 bg-black/10">
                                    <div className="mt-2">
                                      <div className="text-[10px] font-semibold text-emerald-500/70 mb-1 tracking-wide">
                                        ARGUMENTS
                                      </div>
                                      <div className="text-[11px] text-zinc-400 bg-zinc-950/50 border border-zinc-800/30 p-2 rounded overflow-auto max-h-40 font-mono leading-relaxed">
                                        {(() => {
                                          try {
                                            const args = typeof toolCall.function.arguments === 'string'
                                              ? JSON.parse(toolCall.function.arguments)
                                              : toolCall.function.arguments;
                                            return JSON.stringify(args, null, 2);
                                          } catch (e) {
                                            return toolCall.function.arguments;
                                          }
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                      </div>
                    ))}

                    {/* Show streaming message */}
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
                        <div className="text-xs text-zinc-300 prose prose-invert prose-xs max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                              p: ({ children }) => (
                                <p className="mb-2 leading-relaxed">
                                  {children}
                                </p>
                              ),
                              code: ({ inline, children, ...props }: any) =>
                                inline ? (
                                  <code
                                    className="px-1 py-0.5 bg-zinc-800/50 text-emerald-400 rounded text-[11px] font-mono"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                ) : (
                                  <code
                                    className="block bg-zinc-900/50 p-2 rounded-lg my-2 text-[11px] overflow-x-auto border border-zinc-800/30 font-mono"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                ),
                            }}
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
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>
            )}

            {/* Chat/Instruction Input */}
            {showChat ? (
              <div className="border-t border-zinc-800/50 px-3 py-2 bg-zinc-900/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
                  <p className="text-[10px] text-zinc-500">
                    {agent.status === "COMPLETED" || agent.status === "IDLE"
                      ? "Resume with new task or ask questions"
                      : "Chat with the agent"}
                  </p>
                </div>

                {/* Modern Textarea with Embedded Buttons */}
                <div className="relative bg-zinc-900/50 border border-zinc-800/60 rounded-lg hover:border-zinc-700/80 focus-within:border-emerald-500/40 transition-colors">
                  <textarea
                    rows={2}
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder={
                      agent.status === "COMPLETED" || agent.status === "IDLE"
                        ? "Give agent a new task..."
                        : "Send a message..."
                    }
                    className="w-full bg-transparent px-3 pt-2 pb-9 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (
                          agent.status === "COMPLETED" ||
                          agent.status === "IDLE"
                        ) {
                          handleResumeAgent();
                        } else {
                          handleSendChat();
                        }
                      }
                    }}
                  />

                  {/* Button Row Inside Textarea */}
                  <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between">
                    <div className="text-[10px] text-zinc-600">
                      {chatMessage.length > 0 && `${chatMessage.length} chars`}
                    </div>
                    <div className="flex gap-1.5">
                      {(agent.status === "COMPLETED" ||
                        agent.status === "IDLE") && (
                        <button
                          onClick={handleResumeAgent}
                          disabled={resuming || !chatMessage.trim()}
                          className="h-6 px-2.5 bg-purple-600/90 hover:bg-purple-600 disabled:bg-zinc-800 disabled:opacity-50 rounded-md flex items-center gap-1 transition-colors text-[10px] font-medium text-white disabled:cursor-not-allowed"
                        >
                          {resuming ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Resuming...</span>
                            </>
                          ) : (
                            <>
                              <PlayCircle className="h-3 w-3" />
                              <span>Resume</span>
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={
                          agent.status === "COMPLETED" ||
                          agent.status === "IDLE"
                            ? handleSendChat
                            : handleSendChat
                        }
                        disabled={sendingChat || !chatMessage.trim()}
                        className="h-6 px-2.5 bg-emerald-600/90 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:opacity-50 rounded-md flex items-center gap-1 transition-colors text-[10px] font-medium text-white disabled:cursor-not-allowed"
                      >
                        {sendingChat ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <Send className="h-3 w-3" />
                            <span>
                              {agent.status === "COMPLETED" ||
                              agent.status === "IDLE"
                                ? "Ask"
                                : "Send"}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              agent.status === "RUNNING" && (
                <div className="border-t border-zinc-800/50 p-3 bg-zinc-900/30">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
                    <p className="text-[10px] text-zinc-500">
                      Send additional instructions
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Input
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder="Add to queue..."
                      className="bg-zinc-800/50 border-zinc-700/50 text-xs h-7"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendInstruction();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={handleSendInstruction}
                      disabled={sending || !instruction.trim()}
                      className="bg-emerald-600 text-white hover:bg-emerald-500 h-7 w-7 p-0"
                    >
                      {sending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

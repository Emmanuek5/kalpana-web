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
import { useEffect, useState } from "react";

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
  originalContent: string;
  newContent: string;
  diff: string;
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
  const [resuming, setResuming] = useState(false);
  const [liveMessages, setLiveMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string; timestamp: string }>
  >([]);
  const [liveToolCalls, setLiveToolCalls] = useState<ToolCall[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (agentId) {
      fetchAgent();
      // Connect to SSE stream for real-time updates
      connectToStream();
    }
  }, [agentId]);

  const connectToStream = () => {
    if (!agentId) return;

    const eventSource = new EventSource(`/api/agents/${agentId}/stream`);

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
            setLiveToolCalls((prev) => [...prev, data.toolCall]);
            setToolCalls((prev) => [...prev, data.toolCall]);
            break;

          case "message":
            setLiveMessages((prev) => [...prev, data.message]);
            setConversation((prev) => [...prev, data.message]);
            setStreamingText(""); // Clear streaming text when message completes
            break;

          case "streaming":
            // Update the streaming text for the current message
            setStreamingText(data.content);
            break;

          case "files":
            setFilesEdited(data.files);
            if (data.files.length > 0 && !selectedFile) {
              setSelectedFile(data.files[0]);
            }
            break;

          case "done":
            setIsLiveStreaming(false);
            setStreamingText("");
            fetchAgent(); // Fetch final state
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

      // Fallback to polling if SSE fails
      const interval = setInterval(fetchAgent, 3000);
      return () => clearInterval(interval);
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
      setIsLiveStreaming(false);
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
    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatMessage }),
      });

      if (res.ok) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            assistantMessage += decoder.decode(value);
          }
        }

        // Refresh to get updated conversation
        setChatMessage("");
        await fetchAgent();
      } else {
        alert("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending chat:", error);
      alert("Failed to send message");
    } finally {
      setSendingChat(false);
    }
  };

  const handleResumeAgent = async () => {
    if (!chatMessage.trim()) return;

    setResuming(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTask: chatMessage }),
      });

      if (res.ok) {
        setChatMessage("");
        setShowChat(false);
        await fetchAgent();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to resume agent");
      }
    } catch (error) {
      console.error("Error resuming agent:", error);
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
        setInstruction("");
        await fetchAgent();
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
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Github className="h-4 w-4" />
              <span className="font-mono">{agent.githubRepo}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <GitBranch className="h-4 w-4" />
              <span>
                {agent.sourceBranch} → {agent.targetBranch}
              </span>
            </div>
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
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-zinc-400" />
                <h2 className="text-sm font-medium text-zinc-300">
                  Edited Files ({filesEdited.length})
                </h2>
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
                      className={`w-full text-left px-4 py-3 text-sm border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors ${
                        selectedFile?.path === file.path
                          ? "bg-zinc-800/50 text-emerald-400"
                          : "text-zinc-400"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileCode className="h-4 w-4 shrink-0" />
                        <span className="truncate">{file.path}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Diff Display */}
                <div className="flex-1 overflow-y-auto bg-zinc-950/50">
                  {selectedFile && (
                    <div className="p-4">
                      <div className="mb-4">
                        <h3 className="text-sm font-medium text-zinc-300 mb-2">
                          {selectedFile.path}
                        </h3>
                      </div>
                      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
                        <pre className="p-4 text-xs text-zinc-300 overflow-x-auto">
                          {selectedFile.diff || "No diff available"}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Tool Calls & Messages / Conversation */}
          <div className="w-96 flex flex-col">
            <div className="border-b border-zinc-800/50 px-4 py-3 bg-zinc-900/30">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowChat(false)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
                      !showChat
                        ? "bg-zinc-800/50 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Activity className="h-4 w-4" />
                    Activity
                  </button>
                  <button
                    onClick={() => setShowChat(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
                      showChat
                        ? "bg-zinc-800/50 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Chat ({conversation.length})
                  </button>
                </div>
              </div>
            </div>

            {!showChat ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {toolCalls.length === 0 ? (
                  <p className="text-sm text-zinc-500">No activity yet</p>
                ) : (
                  toolCalls.map((call, idx) => (
                    <Card
                      key={idx}
                      className="p-3 bg-zinc-900/50 border-zinc-800/50"
                    >
                      <div className="flex items-start gap-2">
                        <Activity className="h-4 w-4 text-emerald-400 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-300">
                            {call.function?.name || call.type}
                          </p>
                          {call.function?.arguments && (
                            <pre className="mt-1 text-xs text-zinc-500 overflow-x-auto">
                              {JSON.stringify(
                                JSON.parse(call.function.arguments),
                                null,
                                2
                              )}
                            </pre>
                          )}
                          <p className="mt-1 text-xs text-zinc-600">
                            {new Date(call.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4">
                {conversation.length === 0 &&
                !streamingText &&
                toolCalls.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center max-w-md">
                      <div className="mb-3 text-3xl">⚡</div>
                      <p className="text-sm text-zinc-500">
                        Agent ready. Conversation will appear here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto space-y-4">
                    {conversation.map((msg, idx) => (
                      <div key={idx} className="space-y-2">
                        {/* User Messages */}
                        {msg.role === "user" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="h-5 w-5 rounded-md bg-zinc-800/50 flex items-center justify-center">
                                <span className="text-[10px] text-zinc-400">
                                  You
                                </span>
                              </div>
                            </div>
                            <div className="text-sm text-zinc-200 leading-relaxed">
                              {msg.content}
                            </div>
                          </div>
                        )}

                        {/* Assistant Messages */}
                        {msg.role === "assistant" && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="h-5 w-5 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <Brain className="h-3 w-3 text-emerald-500" />
                              </div>
                              <span className="text-[10px] text-zinc-500 font-medium">
                                Agent
                              </span>
                            </div>
                            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                              {msg.content}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Tool Calls */}
                    {toolCalls.length > 0 && (
                      <div className="space-y-2">
                        {toolCalls.map((toolCall) => {
                          const isExpanded = expandedTools.has(toolCall.id);
                          const IconComponent =
                            TOOL_ICONS[
                              toolCall.function?.name || toolCall.type
                            ] || TerminalIcon;

                          return (
                            <div
                              key={toolCall.id}
                              className="group relative bg-zinc-900/30 border border-zinc-800/40 rounded-lg overflow-hidden hover:border-zinc-700/60 transition-colors"
                            >
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
                                    {(toolCall.function?.name || toolCall.type)
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
                                    <div className="text-xs text-zinc-400 bg-zinc-950/50 border border-zinc-800/30 p-2 rounded overflow-auto max-h-40 font-mono">
                                      {JSON.stringify(
                                        JSON.parse(toolCall.function.arguments),
                                        null,
                                        2
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Show streaming message */}
                    {streamingText && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-5 w-5 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <Brain className="h-3 w-3 text-emerald-500" />
                          </div>
                          <span className="text-[10px] text-zinc-500 font-medium">
                            Agent
                          </span>
                        </div>
                        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {streamingText}
                        </div>
                        <div className="flex items-center gap-2 text-zinc-600 text-xs">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Streaming...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Chat/Instruction Input */}
            {showChat ? (
              <div className="border-t border-zinc-800/50 p-4 bg-zinc-900/30">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-zinc-400" />
                  <p className="text-xs text-zinc-500">
                    {agent.status === "COMPLETED" || agent.status === "IDLE"
                      ? "Resume with new task or ask questions"
                      : "Chat with the agent"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder={
                      agent.status === "COMPLETED" || agent.status === "IDLE"
                        ? "Give agent a new task..."
                        : "Send a message..."
                    }
                    className="bg-zinc-800/50 border-zinc-700/50 text-sm"
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
                  <div className="flex gap-2">
                    {(agent.status === "COMPLETED" ||
                      agent.status === "IDLE") && (
                      <Button
                        size="sm"
                        onClick={handleResumeAgent}
                        disabled={resuming || !chatMessage.trim()}
                        className="flex-1 bg-purple-600 text-white hover:bg-purple-500"
                      >
                        {resuming ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Resuming...
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Resume Agent
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSendChat}
                      disabled={sendingChat || !chatMessage.trim()}
                      className={
                        agent.status === "COMPLETED" || agent.status === "IDLE"
                          ? "flex-1 bg-emerald-600 text-white hover:bg-emerald-500"
                          : "flex-1 bg-emerald-600 text-white hover:bg-emerald-500"
                      }
                    >
                      {sendingChat ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          {agent.status === "COMPLETED" ||
                          agent.status === "IDLE"
                            ? "Ask"
                            : "Send"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              agent.status === "RUNNING" && (
                <div className="border-t border-zinc-800/50 p-4 bg-zinc-900/30">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-zinc-400" />
                    <p className="text-xs text-zinc-500">
                      Send additional instructions
                    </p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder="Add to queue..."
                      className="bg-zinc-800/50 border-zinc-700/50 text-sm"
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
                      className="bg-emerald-600 text-white hover:bg-emerald-500"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
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

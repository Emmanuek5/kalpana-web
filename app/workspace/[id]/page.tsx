"use client";

import React, { useEffect, useState, useRef } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Send,
  Check,
  AlertCircle,
  Terminal as TerminalIcon,
  FileCode,
  Search,
  GitCommit,
  Upload,
  Brain,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceEditor } from "@/components/workspace/workspace-editor";
import { AIAgentPanel } from "@/components/workspace/ai-agent-panel";
import { DiagnosticsDialog } from "@/components/workspace/diagnostics-dialog";

// Custom scrollbar styles
const scrollbarStyles = `
  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: rgba(82, 82, 91, 0.5);
    border-radius: 2px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: rgba(82, 82, 91, 0.8);
  }
`;

// File path detection regex
const FILE_PATH_REGEX =
  /(?:^|\s)([a-zA-Z0-9_\-./]+\.(ts|tsx|js|jsx|json|css|html|md|py|java|go|rs|rb|php|vue|svelte)(?::\d+)?)/gi;

interface Workspace {
  id: string;
  name: string;
  description?: string;
  status: "STOPPED" | "STARTING" | "RUNNING" | "STOPPING" | "ERROR";
  vscodePort?: number;
  agentPort?: number;
  githubRepo?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  createdAt: Date;
}

type MessagePart =
  | { type: "text"; text: string }
  | {
      type: "checkpoint";
      title: string;
      description: string;
      status: "success" | "error" | "pending";
    }
  | {
      type: "tool";
      toolCallId: string;
      toolName: string;
      state:
        | "input-streaming"
        | "input-available"
        | "output-available"
        | "output-error";
      input?: any;
      output?: any;
      errorText?: string;
    }
  | {
      type: "reasoning";
      text: string;
    }
  | {
      type: "source";
      url: string;
      title?: string;
      content?: string;
    };

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [favoriteModels, setFavoriteModels] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(
    new Set()
  );
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [startupLogs, setStartupLogs] = useState<{
    stage: string;
    message: string;
    progress: number;
  } | null>(null);
  const [hasNixFile, setHasNixFile] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [rebuildLogs, setRebuildLogs] = useState<string[]>([]);
  const [rebuildStage, setRebuildStage] = useState<string>("");

  // Handler for opening files in editor
  const handleOpenFile = (filePath: string) => {
    if (!workspace || !workspace.vscodePort) return;

    // Parse file path and line number (e.g., "src/app.ts:42")
    const [path, line] = filePath.split(":");
    const lineNumber = line ? parseInt(line, 10) : 1;

    // Post message to VS Code iframe to open the file
    const iframe = document.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          {
            type: "openFile",
            path: path,
            line: lineNumber,
          },
          "*"
        );
      } catch (error) {
        console.error("Error opening file:", error);
      }
    }
  };

  // Render text with clickable file references
  const renderTextWithFileLinks = (text: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = new RegExp(FILE_PATH_REGEX);
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add clickable file link
      const filePath = match[1].trim();
      parts.push(
        <button
          key={`file-${match.index}`}
          onClick={() => handleOpenFile(filePath)}
          className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:underline transition-colors cursor-pointer bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800 hover:border-emerald-800 font-mono text-xs"
          title={`Open ${filePath}`}
        >
          <FileCode className="h-3 w-3" />
          {filePath}
        </button>
      );

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWorkspace();
    fetchUserSettings();
    fetchMessages();
    const interval = setInterval(fetchWorkspace, 5000);
    return () => clearInterval(interval);
  }, [resolvedParams.id]);

  // Poll for startup logs when starting
  useEffect(() => {
    if (workspace?.status === "STARTING") {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/workspaces/${resolvedParams.id}/logs`);
          if (res.ok) {
            const data = await res.json();
            setStartupLogs(data.status);
          }
        } catch (error) {
          console.error("Error fetching logs:", error);
        }
      }, 2000);

      return () => clearInterval(interval);
    } else if (workspace?.status === "RUNNING") {
      // Clear startup logs after a delay
      setTimeout(() => setStartupLogs(null), 2000);
    }
  }, [workspace?.status, resolvedParams.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchWorkspace = async () => {
    try {
      const res = await fetch(`/api/workspaces/${resolvedParams.id}`);
      if (res.ok) {
        const data = await res.json();
        setWorkspace(data);
      }
    } catch (error) {
      console.error("Error fetching workspace:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/workspaces/${resolvedParams.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const saveMessage = async (message: Message) => {
    try {
      await fetch(`/api/workspaces/${resolvedParams.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: message.role,
          parts: message.parts,
        }),
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  const clearChatHistory = async () => {
    if (
      !confirm(
        "Are you sure you want to clear all chat history? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/workspaces/${resolvedParams.id}/messages`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMessages([]);
      }
    } catch (error) {
      console.error("Error clearing chat history:", error);
    }
  };

  const fetchUserSettings = async () => {
    try {
      const [settingsRes, modelsRes] = await Promise.all([
        fetch("/api/user/settings"),
        fetch("/api/models"),
      ]);

      if (settingsRes.ok && modelsRes.ok) {
        const settings = await settingsRes.json();
        const modelsData = await modelsRes.json();

        const favorites = (settings.favoriteModels || [])
          .map((id: string) => {
            const model = modelsData.data?.find(
              (m: { id: string }) => m.id === id
            );
            return model ? { id: model.id, name: model.name } : null;
          })
          .filter(Boolean);

        setFavoriteModels(favorites);
        setSelectedModel(
          settings.defaultModel ||
            favorites[0]?.id ||
            "anthropic/claude-3.5-sonnet"
        );
      }
    } catch (error) {
      console.error("Error fetching user settings:", error);
      setSelectedModel("anthropic/claude-3.5-sonnet");
    }
  };

  const handleStart = async () => {
    setStarting(true);
    setRebuildLogs([]);
    setRebuildStage("Creating container...");

    try {
      const res = await fetch(`/api/workspaces/${resolvedParams.id}/start`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to start workspace");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "status") {
                setRebuildStage(data.message);
              } else if (data.type === "log") {
                setRebuildLogs((prev) => [...prev, data.message]);
              } else if (data.type === "complete") {
                setRebuildStage("Complete!");
                await fetchWorkspace();
                setTimeout(() => {
                  setStarting(false);
                  setRebuildLogs([]);
                }, 2000);
              } else if (data.type === "error") {
                setRebuildStage(`Error: ${data.message}`);
                setTimeout(() => {
                  setStarting(false);
                  setRebuildLogs([]);
                }, 3000);
              }
            } catch (e) {
              console.error("Error parsing SSE:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error starting workspace:", error);
      setRebuildStage("Start failed");
      setTimeout(() => {
        setStarting(false);
        setRebuildLogs([]);
      }, 3000);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      const res = await fetch(`/api/workspaces/${resolvedParams.id}/stop`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchWorkspace();
      }
    } catch (error) {
      console.error("Error stopping workspace:", error);
    } finally {
      setStopping(false);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    setRebuildLogs([]);
    setRebuildStage("Initiating rebuild...");

    try {
      const res = await fetch(`/api/workspaces/${resolvedParams.id}/rebuild`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to start rebuild");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "status") {
                setRebuildStage(data.message);
              } else if (data.type === "log") {
                setRebuildLogs((prev) => [...prev, data.message]);
              } else if (data.type === "complete") {
                setRebuildStage("Complete!");
                await fetchWorkspace();
                // Reload iframe
                setTimeout(() => {
                  const iframe = document.querySelector(
                    "iframe"
                  ) as HTMLIFrameElement;
                  if (iframe) {
                    iframe.src = iframe.src;
                  }
                  setRestarting(false);
                  setRebuildLogs([]);
                }, 2000);
              } else if (data.type === "error") {
                setRebuildStage(`Error: ${data.message}`);
                setTimeout(() => {
                  setRestarting(false);
                  setRebuildLogs([]);
                }, 3000);
              }
            } catch (e) {
              console.error("Error parsing SSE:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error restarting workspace:", error);
      setRebuildStage("Rebuild failed");
      setTimeout(() => {
        setRestarting(false);
        setRebuildLogs([]);
      }, 3000);
    }
  };

  const handleSendMessage = async (
    messageOverride?: string,
    images?: Array<{ name: string; base64: string; mimeType: string }>
  ) => {
    const messageToSend = messageOverride || inputMessage;
    if (!messageToSend.trim() || isStreaming) return;

    const userInput = messageToSend;
    setInputMessage("");
    setIsStreaming(true);

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      parts: [{ type: "text", text: userInput }],
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);

    // Save user message to database
    await saveMessage(userMsg);

    // Create empty assistant message
    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      parts: [],
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: resolvedParams.id,
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.parts
              .filter((p) => p.type === "text")
              .map((p: any) => p.text)
              .join("\n"),
          })),
          model: selectedModel,
          images: images || [], // Include images if provided
        }),
      });

      if (!res.ok) {
        throw new Error("AI agent request failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let currentText = "";
      let currentReasoning = "";
      let currentTextPartIndex = -1; // Track which text part we're updating

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") continue;

            try {
              const data = JSON.parse(dataStr);

              // Handle text deltas
              if (data.type === "text-delta" && data.delta) {
                currentText += data.delta;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    // If we don't have a current text part index, find or create one
                    if (currentTextPartIndex === -1) {
                      // Check if last part is a text part
                      const lastPart = lastMsg.parts[lastMsg.parts.length - 1];
                      if (lastPart && lastPart.type === "text") {
                        // Continue with the last text part
                        currentTextPartIndex = lastMsg.parts.length - 1;
                      } else {
                        // Last part is not text (probably a tool), create new text part
                        lastMsg.parts.push({ type: "text", text: "" });
                        currentTextPartIndex = lastMsg.parts.length - 1;
                      }
                    }

                    // Update the specific text part
                    (lastMsg.parts[currentTextPartIndex] as any).text =
                      currentText;
                  }
                  return updated;
                });
              }

              // Handle reasoning deltas
              if (data.type === "reasoning-delta" && data.delta) {
                currentReasoning += data.delta;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === "assistant") {
                    const reasoningPartIndex = lastMsg.parts.findIndex(
                      (p) => p.type === "reasoning"
                    );
                    if (reasoningPartIndex >= 0) {
                      (lastMsg.parts[reasoningPartIndex] as any).text =
                        currentReasoning;
                    } else {
                      lastMsg.parts.push({
                        type: "reasoning",
                        text: currentReasoning,
                      });
                    }
                  }
                  return updated;
                });
              }

              // Handle tool input start (AI SDK v5)
              if (data.type === "tool-input-start") {
                // Reset text tracking - next text delta should create a new text part AFTER this tool
                currentText = "";
                currentTextPartIndex = -1;

                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === "assistant") {
                    // Check if tool already exists by toolCallId
                    const existingTool = lastMsg.parts.find(
                      (p): p is Extract<MessagePart, { type: "tool" }> =>
                        p.type === "tool" &&
                        (p as any).toolCallId === data.toolCallId
                    );

                    if (!existingTool && data.toolCallId && data.toolName) {
                      lastMsg.parts.push({
                        type: "tool",
                        toolCallId: data.toolCallId,
                        toolName: data.toolName,
                        state: "input-streaming",
                        input: {},
                      });
                    }
                  }
                  return updated;
                });
              }

              // Handle tool input available (AI SDK v5)
              if (data.type === "tool-input-available") {
                // Reset text tracking - next text delta should create a new text part AFTER this tool
                currentText = "";
                currentTextPartIndex = -1;

                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === "assistant") {
                    const toolPart = lastMsg.parts.find(
                      (p): p is Extract<MessagePart, { type: "tool" }> =>
                        p.type === "tool" &&
                        (p as any).toolCallId === data.toolCallId
                    );
                    if (toolPart) {
                      toolPart.state = "input-available";
                      toolPart.input = data.input;
                    } else if (data.toolCallId && data.toolName) {
                      // Tool doesn't exist, create it
                      lastMsg.parts.push({
                        type: "tool",
                        toolCallId: data.toolCallId,
                        toolName: data.toolName,
                        state: "input-available",
                        input: data.input,
                      });
                    }
                  }
                  return updated;
                });
              }

              // Handle tool output available (AI SDK v5)
              if (data.type === "tool-output-available") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === "assistant") {
                    const toolPart = lastMsg.parts.find(
                      (p): p is Extract<MessagePart, { type: "tool" }> =>
                        p.type === "tool" &&
                        (p as any).toolCallId === data.toolCallId
                    );
                    if (toolPart) {
                      toolPart.state = "output-available";
                      toolPart.output = data.output;

                      // Add checkpoint for successful operations (only if not already added)
                      const checkpointExists = lastMsg.parts.some(
                        (p) =>
                          p.type === "checkpoint" &&
                          p.title ===
                            `${getToolDisplayName(toolPart.toolName)} completed`
                      );

                      if (!checkpointExists) {
                        lastMsg.parts.push({
                          type: "checkpoint",
                          title: `${getToolDisplayName(
                            toolPart.toolName
                          )} completed`,
                          description: getToolDescription(
                            toolPart.toolName,
                            data.output
                          ),
                          status: "success",
                        });
                      }
                    }
                  }
                  return updated;
                });
              }

              // Handle sources/citations
              if (data.type === "source" && data.url) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === "assistant") {
                    lastMsg.parts.push({
                      type: "source",
                      url: data.url,
                      title: data.title,
                      content: data.content,
                    });
                  }
                  return updated;
                });
              }

              // Handle step transitions
              if (data.type === "finish-step") {
                // Don't reset accumulators - just mark the step boundary
                // Text will continue accumulating across steps if needed
              }

              // Handle new step start - reset for fresh content
              if (data.type === "start-step") {
                currentText = "";
                currentReasoning = "";
              }

              // Handle stream finish
              if (data.type === "finish") {
                setIsStreaming(false);
                // Save assistant message to database
                setMessages((prev) => {
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    saveMessage(lastMsg);
                  }
                  return prev;
                });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg.role === "assistant") {
          lastMsg.parts.push({
            type: "checkpoint",
            title: "Error occurred",
            description: "Failed to process request. Please try again.",
            status: "error",
          });
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const getToolDisplayName = (toolName: string): string => {
    const names: Record<string, string> = {
      listFiles: "File Listing",
      readFile: "File Read",
      writeFile: "File Write",
      runCommand: "Command Execution",
      searchCode: "Code Search",
      gitCommit: "Git Commit",
      gitPush: "Git Push",
    };
    return names[toolName] || toolName;
  };

  const getToolDescription = (toolName: string, result: any): string => {
    if (toolName === "listFiles")
      return `Listed ${result?.files?.length || 0} files`;
    if (toolName === "readFile")
      return `Read file: ${result?.path || "unknown"}`;
    if (toolName === "writeFile")
      return `Wrote to: ${result?.path || "unknown"}`;
    if (toolName === "runCommand")
      return `Executed: ${result?.command || "command"}`;
    if (toolName === "searchCode")
      return `Found ${result?.matches?.length || 0} matches`;
    if (toolName === "gitCommit") return `Committed changes`;
    if (toolName === "gitPush") return `Pushed to remote`;
    return "Operation completed";
  };

  const getToolIcon = (toolName: string) => {
    const icons: Record<string, any> = {
      listFiles: FileCode,
      readFile: FileCode,
      writeFile: FileCode,
      runCommand: TerminalIcon,
      searchCode: Search,
      gitCommit: GitCommit,
      gitPush: Upload,
    };
    return icons[toolName] || FileCode;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
          <p className="text-sm text-zinc-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="mb-6 text-6xl">404</div>
          <h2 className="text-2xl font-semibold mb-3 text-zinc-200">
            Workspace not found
          </h2>
          <p className="text-zinc-500 mb-8">
            This workspace doesn't exist or you don't have access to it.
          </p>
          <Button
            onClick={() => router.push("/dashboard")}
            variant="outline"
            className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{scrollbarStyles}</style>
      <div className="h-screen bg-black flex flex-col overflow-hidden">
        {/* Futuristic Background Effect */}
        <div className="fixed inset-0 bg-gradient-to-br from-emerald-950/10 via-black to-black pointer-events-none" />
        <div className="fixed inset-0 bg-[linear-gradient(to_right,#0a0a0a_1px,transparent_1px),linear-gradient(to_bottom,#0a0a0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none" />

        {/* Header */}
        <WorkspaceHeader
          workspace={workspace}
          onStop={handleStop}
          onRestart={handleRestart}
          onShowDiagnostics={() => setShowDiagnostics(true)}
          stopping={stopping}
          restarting={restarting}
        />

        {/* Diagnostics Dialog */}
        <DiagnosticsDialog
          open={showDiagnostics}
          onOpenChange={setShowDiagnostics}
          workspaceId={workspace.id}
        />

        {/* Main Content - Proper Flex Layout */}
        <div className="relative z-10 flex-1 flex overflow-hidden">
          {/* Editor Area */}
          <div className="flex-1 bg-gradient-to-br from-zinc-950 to-black">
            <WorkspaceEditor
              workspace={workspace}
              starting={starting}
              restarting={restarting}
              rebuildStage={rebuildStage}
              rebuildLogs={rebuildLogs}
              onStart={handleStart}
            />
          </div>

          {/* AI Agent Panel - Side by side with flex */}
          <AIAgentPanel
            workspaceId={workspace.id}
            messages={messages}
            input={inputMessage}
            setInput={setInputMessage}
            handleSend={handleSendMessage}
            isStreaming={isStreaming}
            favoriteModels={favoriteModels}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            expandedTools={expandedTools}
            setExpandedTools={setExpandedTools}
            expandedReasoning={expandedReasoning}
            setExpandedReasoning={setExpandedReasoning}
            handleOpenFile={handleOpenFile}
            renderTextWithFileLinks={renderTextWithFileLinks}
            onClearHistory={clearChatHistory}
          />
        </div>
      </div>
    </>
  );
}

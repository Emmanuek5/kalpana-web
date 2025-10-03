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
  Code2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { toast } from "sonner";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceEditor } from "@/components/workspace/workspace-editor";
import { AIAgentPanel } from "@/components/workspace/ai-agent-panel";
import { DiagnosticsDialog } from "@/components/workspace/diagnostics-dialog";
import { DeploymentsPanel } from "@/components/workspace/deployments-panel";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [favoriteModels, setFavoriteModels] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [expandedTools, setExpandedTools] = React.useState<Set<string>>(
    new Set()
  );
  const [expandedReasoning, setExpandedReasoning] = React.useState<Set<string>>(
    new Set()
  );
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [startupLogs, setStartupLogs] = useState<{
    stage: string;
    message: string;
  } | null>(null);
  const [hasNixFile, setHasNixFile] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [rebuildLogs, setRebuildLogs] = useState<string[]>([]);
  const [rebuildStage, setRebuildStage] = useState<string>("");
  const [inputMessage, setInputMessage] = useState<string>("");
  const [activeTab, setActiveTab] = React.useState<"ai" | "deployments">("ai");
  
  // Chat management state
  const [chats, setChats] = useState<Array<{
    id: string;
    title: string;
    messageCount: number;
    lastMessageAt: Date;
  }>>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Handler for opening files in editor
  const handleOpenFile = async (filePath: string) => {
    if (!workspace || !workspace.agentPort) return;

    // Parse file path and line number (e.g., "src/app.ts:42")
    const [path, line] = filePath.split(":");
    const lineNumber = line ? parseInt(line, 10) : 1;

    try {
      // Send WebSocket message to open file in VS Code
      const response = await fetch(`http://localhost:${workspace.agentPort}/vscode-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'openFile',
          payload: {
            filePath: path,
            line: lineNumber,
          },
        }),
      });

      if (!response.ok) {
        console.error('Failed to open file:', await response.text());
      }
    } catch (error) {
      console.error("Error opening file:", error);
    }
  };

  // Render text with clickable file references
  const renderTextWithFileLinks = (text: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Enhanced regex to match:
    // 1. @mentions: @filename or @function()
    // 2. File paths with keywords: File: path/to/file.ts or Path: src/app.tsx
    // 3. Backtick file paths: `src/components/Button.tsx` or `app/page.tsx:42`
    // 4. Common file patterns: src/file.ts, app/page.tsx, lib/utils.ts
    const combinedRegex = /@([\w\-./()]+)|(?:File|Path|file|path):\s*([^\s,;]+)|`([^`]+\.[a-z]{2,4}(?::\d+)?)`|(?:^|\s)((?:src|app|lib|components|pages|api|utils|hooks|styles|public|container|docs|prisma|scripts)\/[\w\-./]+\.[a-z]{2,4}(?::\d+)?)/gi;
    let match;

    while ((match = combinedRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Check which group matched
      if (match[1]) {
        // @mention - style as badge
        const mentionText = match[1];
        const isFunction = mentionText.includes("()");
        parts.push(
          <span
            key={`mention-${match.index}`}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded text-[11px] text-emerald-400 font-mono"
          >
            {isFunction ? (
              <Code2 className="h-2.5 w-2.5" />
            ) : (
              <FileCode className="h-2.5 w-2.5" />
            )}
            {mentionText}
          </span>
        );
      } else if (match[2] || match[3] || match[4]) {
        // File path - clickable link (from any of the file path patterns)
        const filePath = (match[2] || match[3] || match[4]).trim();
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
      }

      lastIndex = combinedRegex.lastIndex;
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
    fetchChats();
    const interval = setInterval(fetchWorkspace, 5000);
    return () => clearInterval(interval);
  }, [resolvedParams.id]);
  
  // Fetch messages when chat changes
  useEffect(() => {
    if (currentChatId) {
      fetchMessages(currentChatId);
    }
  }, [currentChatId]);

  // Keep `starting` state in sync with backend status so logs resume after navigation
  useEffect(() => {
    if (!workspace) return;
    setStarting(workspace.status === "STARTING");
  }, [workspace?.status]);

  // Poll for startup logs when starting; feed them into rebuild UI state
  useEffect(() => {
    if (workspace?.status === "STARTING") {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/workspaces/${resolvedParams.id}/logs`);
          if (res.ok) {
            const data = await res.json();
            setStartupLogs(data.status);
            // Mirror into rebuild UI state so the panel shows logs when returning to the page
            if (data?.status?.message) {
              setRebuildStage(data.status.message);
            }
            if (typeof data?.logs === "string") {
              const lines = data.logs
                .split("\n")
                .map((l: string) => l.trim())
                .filter((l: string) => l.length > 0);
              setRebuildLogs(lines.slice(-500));
            }
          }
        } catch (error) {
          console.error("Error fetching logs:", error);
        }
      }, 2000);

      return () => clearInterval(interval);
    } else if (workspace?.status === "RUNNING") {
      // Clear startup logs after a delay
      setTimeout(() => setStartupLogs(null), 2000);
      // Also clear rebuild UI after a brief delay
      setTimeout(() => {
        setRebuildLogs([]);
        setRebuildStage("");
        setStarting(false);
      }, 2000);
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

  const fetchChats = async () => {
    try {
      const res = await fetch(`/api/workspaces/${resolvedParams.id}/chats`);
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats || []);
        
        // Select first chat or create new one if none exist
        if (data.chats && data.chats.length > 0) {
          setCurrentChatId(data.chats[0].id);
        } else {
          // Create first chat
          await handleCreateChat();
        }
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/workspaces/${resolvedParams.id}/messages?chatId=${chatId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const saveMessage = async (message: Message): Promise<string | null> => {
    if (!currentChatId) return null;
    
    try {
      const response = await fetch(`/api/workspaces/${resolvedParams.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: currentChatId,
          role: message.role,
          parts: message.parts,
        }),
      });
      
      const data = await response.json();
      
      // Auto-generate chat title from first user message
      if (message.role === "user" && messages.length === 0) {
        const textPart = message.parts.find(p => p.type === "text") as any;
        if (textPart?.text) {
          const title = generateChatTitle(textPart.text);
          await updateChatTitle(currentChatId, title);
        }
      }
      
      // Return the database-generated message ID
      return data.message?.id || null;
    } catch (error) {
      console.error("Error saving message:", error);
      return null;
    }
  };
  
  const generateChatTitle = (firstMessage: string): string => {
    // Take first 50 chars or until first newline
    let title = firstMessage.split('\n')[0].substring(0, 50);
    if (firstMessage.length > 50) {
      title += "...";
    }
    return title || "New Chat";
  };
  
  const updateChatTitle = async (chatId: string, title: string) => {
    try {
      await fetch(`/api/workspaces/${resolvedParams.id}/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      
      // Update local state
      setChats(chats.map(c => c.id === chatId ? { ...c, title } : c));
    } catch (error) {
      console.error("Error updating chat title:", error);
    }
  };
  
  const handleCreateChat = async () => {
    try {
      const res = await fetch(`/api/workspaces/${resolvedParams.id}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setChats([data.chat, ...chats]);
        setCurrentChatId(data.chat.id);
        setMessages([]); // Clear messages for new chat
      }
    } catch (error) {
      console.error("Error creating chat:", error);
    }
  };
  
  const handleSelectChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    // Messages will be fetched by useEffect
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

    // Add user message with temporary ID
    const tempId = Date.now().toString();
    const userMsg: Message = {
      id: tempId,
      role: "user",
      parts: [{ type: "text", text: userInput }],
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);

    // Save user message to database and get the database ID
    const dbMessageId = await saveMessage(userMsg);

    // Update message with database ID
    if (dbMessageId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: dbMessageId } : m))
      );
    }

    // Create checkpoint before AI processes the message (using database ID)
    if (dbMessageId) {
      try {
        await fetch(`/api/workspaces/${resolvedParams.id}/checkpoints`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: dbMessageId,
            previewText: userInput.substring(0, 100),
          }),
        });
        console.log("📸 Checkpoint created for message:", dbMessageId);
      } catch (error) {
        console.error("Failed to create checkpoint:", error);
        // Continue even if checkpoint fails
      }
    }

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
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: resolvedParams.id,
          chatId: currentChatId,
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
        signal: abortControllerRef.current.signal,
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

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.trim() || line.startsWith(":")) continue;
          
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]" || !dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              // Handle text deltas (AI SDK v5 format)
              if ((data.type === "text-delta" || data.type === "0") && data.textDelta) {
                currentText += data.textDelta;
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

              // Handle reasoning deltas (AI SDK v5 format)
              if (data.type === "reasoning-delta" && data.reasoningDelta) {
                currentReasoning += data.reasoningDelta;
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

              // Handle tool calls (AI SDK v5 format - type "9" is tool-call)
              if (data.type === "tool-call" || data.type === "9") {
                console.log("🔧 Tool call received:", data);
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
                      // Add tool with "input-streaming" state to show it's executing
                      console.log(`✅ Adding tool to message: ${data.toolName} (${data.toolCallId})`);
                      lastMsg.parts.push({
                        type: "tool",
                        toolCallId: data.toolCallId,
                        toolName: data.toolName,
                        state: "input-streaming",
                        input: data.args || {},
                      });
                    } else {
                      console.log(`⚠️ Tool already exists or missing data:`, { existingTool, data });
                    }
                  }
                  return updated;
                });
              }

              // Handle tool results (AI SDK v5 format - type "a" is tool-result)
              if (data.type === "tool-result" || data.type === "a") {
                console.log("✅ Tool result received:", data);
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
                      console.log(`✅ Updating tool result: ${toolPart.toolName} → output-available`);
                      toolPart.state = "output-available";
                      toolPart.output = data.result;

                      // Add checkpoint for successful operations
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
                            data.result
                          ),
                          status: "success",
                        });
                      }
                    } else if (data.toolCallId && data.toolName) {
                      // Tool doesn't exist, create it with result
                      lastMsg.parts.push({
                        type: "tool",
                        toolCallId: data.toolCallId,
                        toolName: data.toolName,
                        state: "output-available",
                        input: data.args || {},
                        output: data.result,
                      });
                    }
                  }
                  return updated;
                });
              }

              // Handle message finish (AI SDK v5 format)
              if (data.type === "finish" || data.type === "message-stop") {
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

              // Handle error events
              if (data.type === "error" || data.type === "credits_error") {
                console.error("Stream error:", data.error);
                setIsStreaming(false);
                
                // Show toast for credits error
                if (data.type === "credits_error" || data.isCreditsError) {
                  toast.error("Insufficient OpenRouter Credits", {
                    description: "Please add more credits to continue using AI features.",
                    action: {
                      label: "Add Credits",
                      onClick: () => window.open("https://openrouter.ai/settings/credits", "_blank"),
                    },
                    duration: 10000,
                  });
                  
                  // Also save to notification database
                  fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      type: "error",
                      title: "Insufficient OpenRouter Credits",
                      message: "Please add more credits at https://openrouter.ai/settings/credits to continue using AI features.",
                      actionLabel: "Add Credits",
                      actionUrl: "https://openrouter.ai/settings/credits",
                      workspaceId: workspace?.id,
                    }),
                  }).catch(err => console.error('Failed to save notification:', err));
                } else {
                  // Regular error toast
                  toast.error("Error", {
                    description: data.error || "An error occurred during processing",
                  });
                }
                
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    lastMsg.parts.push({
                      type: "checkpoint",
                      title: data.isCreditsError ? "Insufficient Credits" : "Error occurred",
                      description: data.error || "An error occurred during processing",
                      status: "error",
                    });
                  }
                  return updated;
                });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      
      // Check if it was aborted
      if (error.name === 'AbortError') {
        console.log("Request was aborted by user");
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg.role === "assistant") {
            lastMsg.parts.push({
              type: "checkpoint",
              title: "Generation stopped",
              description: "Generation was stopped by user.",
              status: "error",
            });
          }
          return updated;
        });
      } else {
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
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log("🛑 Stopping generation...");
    }
  }, []);

  // Handle code context messages from VS Code extension
  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = React.useRef(1000);
  const shouldReconnectRef = React.useRef(false);

  const handleWorkspaceSocketMessage = React.useCallback(
    (event: MessageEvent) => {
      console.log("📨 WebSocket message received:", event.data);

      try {
        const data = JSON.parse(event.data as string);
        console.log("📦 Parsed message:", data);

        if (data.type === "codeContext") {
          const { action, payload } = data;
          console.log("🎯 Code context action:", action, payload);

          if (action === "addToChat") {
            const context = `@${payload.filePath}:${payload.lineStart}-${payload.lineEnd}\n\n`;

            setInputMessage((prev) => {
              console.log("✅ Adding code to input, current:", prev.length, "chars");
              return prev + context;
            });

            console.log("💬 Code added to chat context:", payload.filePath);

            setTimeout(() => {
              const textarea = document.querySelector("textarea");
              if (textarea) {
                textarea.focus();
                textarea.scrollTop = textarea.scrollHeight;
                console.log("✅ Input focused and scrolled");
              }
            }, 100);
          } else if (action === "sendToAgent") {
            const message = `${payload.instruction}\n\n@${payload.filePath}:${payload.lineStart}-${payload.lineEnd}`;
            console.log("✨ Sending to agent:", payload.instruction);
            handleSendMessage(message);
          }
        }
      } catch (error) {
        console.error("❌ Failed to parse WebSocket message:", error);
      }
    },
    [handleSendMessage]
  );

  React.useEffect(() => {
    if (!workspace || !workspace.agentPort) {
      return;
    }

    shouldReconnectRef.current = true;
    reconnectDelayRef.current = 1000;

    const scheduleReconnect = () => {
      if (!shouldReconnectRef.current) {
        return;
      }

      if (reconnectTimeoutRef.current) {
        return;
      }

      const delay = reconnectDelayRef.current;
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, delay);

      reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 5000);
    };

    const connect = () => {
      if (!shouldReconnectRef.current) {
        return;
      }

      try {
        const ws = new WebSocket(`ws://localhost:${workspace.agentPort}`);
        wsRef.current = ws;

        // Set up keepalive ping interval
        let pingInterval: NodeJS.Timeout | null = null;

        ws.onopen = () => {
          console.log(`Connected to VS Code extension WebSocket on port ${workspace.agentPort}`);
          reconnectDelayRef.current = 1000;
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }

          // Start sending ping messages every 25 seconds to keep connection alive
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: 'ping' }));
              } catch (error) {
                console.error("❌ Failed to send ping:", error);
              }
            }
          }, 25000);
        };

        ws.onmessage = handleWorkspaceSocketMessage;

        ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
          ws.close();
        };

        ws.onclose = (event) => {
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
          if (!shouldReconnectRef.current) {
            return;
          }
          console.warn("⚠️ WebSocket closed:", event.reason || event.code);
          scheduleReconnect();
        };
      } catch (error) {
        console.error("❌ Failed to establish WebSocket connection:", error);
        scheduleReconnect();
      }
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (closeError) {
          console.error("⚠️ Error closing WebSocket:", closeError);
        }
      }
      wsRef.current = null;
    };
  }, [workspace?.agentPort, handleWorkspaceSocketMessage]);

  const getToolDisplayName = (toolName: string): string => {
    const names: Record<string, string> = {
      listFiles: "List Files",
      readFile: "File Read",
      readFileLines: "File Read (Lines)",
      writeFile: "File Write",
      readMultipleFiles: "Read Multiple Files",
      moveFile: "Move File",
      deleteFile: "Delete File",
      findFiles: "Find Files",
      searchCode: "Code Search",
      runCommand: "Command Execution",
      installPackages: "Install Packages",
      gitCommit: "Git Commit",
      gitPush: "Git Push",
      gitBranch: "Git Branch",
      gitStash: "Git Stash",
      scrapeWebPage: "Web Scrape",
      runTests: "Run Tests",
      getProblems: "Problems",
      getLintErrors: "Lint Errors",
      getConsoleLogs: "Console Logs",
      formatDocument: "Format Document",
      goToDefinition: "Go To Definition",
      findReferences: "Find References",
      searchSymbols: "Search Symbols",
      getHover: "Hover Info",
      getCodeActions: "Code Actions",
      applyCodeAction: "Apply Code Action",
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
      <div className="h-screen bg-black flex flex-col items-center justify-center p-8">
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

        {/* Main Content - Proper Flex Layout */
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

          {/* Right Panel with Tabs */}
          <div className="w-[500px] flex flex-col bg-black/40 border-l border-zinc-800">
            {/* Tab Headers */}
            <div className="flex border-b border-zinc-800 bg-zinc-950/50">
              <button
                onClick={() => setActiveTab("ai")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "ai"
                    ? "text-emerald-400 border-b-2 border-emerald-500"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                AI Agent
              </button>
              <button
                onClick={() => setActiveTab("deployments")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "deployments"
                    ? "text-emerald-400 border-b-2 border-emerald-500"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Deployments
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "ai" ? (
                <AIAgentPanel
                  workspaceId={workspace.id}
                  isWorkSpaceRunning={workspace.status === "RUNNING"}
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
                  onStopGeneration={handleStopGeneration}
                  chats={chats}
                  currentChatId={currentChatId}
                  currentChatTitle={chats.find(c => c.id === currentChatId)?.title || "New Chat"}
                  onSelectChat={handleSelectChat}
                  onCreateChat={handleCreateChat}
                />
              ) : (
                <DeploymentsPanel workspaceId={workspace.id} />
              )}
            </div>
          </div>
        </div>
}
      </div>
    </>
  );
}

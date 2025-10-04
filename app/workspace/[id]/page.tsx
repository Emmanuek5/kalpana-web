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
  Rocket,
  Users,
  Database,
  HardDrive,
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
import {
  DynamicTabBar,
  type DynamicTab,
} from "@/components/workspace/dynamic-tab-bar";
import { LiveSharePanel } from "@/components/workspace/live-share-panel";
import { DatabasesPanel } from "@/components/workspace/databases-panel";
import { BucketsPanel } from "@/components/workspace/buckets-panel";

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
  const [activeTab, setActiveTab] = React.useState<string>("ai");

  // Live Share state
  const [liveShareActive, setLiveShareActive] = useState(false);
  const [liveShareLink, setLiveShareLink] = useState<string | null>(null);
  const [collaboratorCount, setCollaboratorCount] = useState(0);

  // Presence tracking (WebSocket-based)
  const [activeViewers, setActiveViewers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const presenceUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasJoinedPresenceRef = useRef<boolean>(false);
  const presenceSetupDoneRef = useRef<boolean>(false); // Track if presence is already set up
  const myPresenceRef = useRef<any>(null); // Store presence data to avoid recreating
  const currentFileRef = useRef<string | null>(null); // Track current file

  // Chat management state
  const [chats, setChats] = useState<
    Array<{
      id: string;
      title: string;
      messageCount: number;
      lastMessageAt: Date;
    }>
  >([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Handler for opening files in editor
  const handleOpenFile = async (filePath: string) => {
    if (!workspace || !workspace.agentPort) return;

    // Parse file path and line number (e.g., "src/app.ts:42")
    const [path, line] = filePath.split(":");
    const lineNumber = line ? parseInt(line, 10) : 1;

    try {
      // Send WebSocket message to open file in VS Code
      const response = await fetch(
        `http://localhost:${workspace.agentPort}/vscode-command`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "openFile",
            payload: {
              filePath: path,
              line: lineNumber,
            },
          }),
        }
      );

      if (!response.ok) {
        console.error("Failed to open file:", await response.text());
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
    const combinedRegex =
      /@([\w\-./()]+)|(?:File|Path|file|path):\s*([^\s,;]+)|`([^`]+\.[a-z]{2,4}(?::\d+)?)`|(?:^|\s)((?:src|app|lib|components|pages|api|utils|hooks|styles|public|container|docs|prisma|scripts)\/[\w\-./]+\.[a-z]{2,4}(?::\d+)?)/gi;
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
      const res = await fetch(
        `/api/workspaces/${resolvedParams.id}/messages?chatId=${chatId}`
      );
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
      const response = await fetch(
        `/api/workspaces/${resolvedParams.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: currentChatId,
            role: message.role,
            parts: message.parts,
          }),
        }
      );

      const data = await response.json();

      // Auto-generate chat title from first user message
      if (message.role === "user" && messages.length === 0) {
        const textPart = message.parts.find((p) => p.type === "text") as any;
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
    let title = firstMessage.split("\n")[0].substring(0, 50);
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
      setChats(chats.map((c) => (c.id === chatId ? { ...c, title } : c)));
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
              if (
                (data.type === "text-delta" || data.type === "0") &&
                data.textDelta
              ) {
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
                      console.log(
                        `✅ Adding tool to message: ${data.toolName} (${data.toolCallId})`
                      );
                      lastMsg.parts.push({
                        type: "tool",
                        toolCallId: data.toolCallId,
                        toolName: data.toolName,
                        state: "input-streaming",
                        input: data.args || {},
                      });
                    } else {
                      console.log(`⚠️ Tool already exists or missing data:`, {
                        existingTool,
                        data,
                      });
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
                      console.log(
                        `✅ Updating tool result: ${toolPart.toolName} → output-available`
                      );
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
                    description:
                      "Please add more credits to continue using AI features.",
                    action: {
                      label: "Add Credits",
                      onClick: () =>
                        window.open(
                          "https://openrouter.ai/settings/credits",
                          "_blank"
                        ),
                    },
                    duration: 10000,
                  });

                  // Also save to notification database
                  fetch("/api/notifications", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      type: "error",
                      title: "Insufficient OpenRouter Credits",
                      message:
                        "Please add more credits at https://openrouter.ai/settings/credits to continue using AI features.",
                      actionLabel: "Add Credits",
                      actionUrl: "https://openrouter.ai/settings/credits",
                      workspaceId: workspace?.id,
                    }),
                  }).catch((err) =>
                    console.error("Failed to save notification:", err)
                  );
                } else {
                  // Regular error toast
                  toast.error("Error", {
                    description:
                      data.error || "An error occurred during processing",
                  });
                }

                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    lastMsg.parts.push({
                      type: "checkpoint",
                      title: data.isCreditsError
                        ? "Insufficient Credits"
                        : "Error occurred",
                      description:
                        data.error || "An error occurred during processing",
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
      if (error.name === "AbortError") {
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
  const pongTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastPongRef = React.useRef<number>(Date.now());

  const handleWorkspaceSocketMessage = React.useCallback(
    (event: MessageEvent) => {
      console.log("📨 WebSocket message received:", event.data);

      try {
        const data = JSON.parse(event.data as string);
        console.log("📦 Parsed message:", data);

        // Handle pong response
        if (data.type === "pong") {
          console.log("🏓 Pong received");
          lastPongRef.current = Date.now();

          // Clear pong timeout
          if (pongTimeoutRef.current) {
            clearTimeout(pongTimeoutRef.current);
            pongTimeoutRef.current = null;
          }
          return;
        }

        // Handle presence updates from other users
        if (data.type === "presence-update") {
          console.log("👥 Presence update received:", data.users);
          const users = (data.users || []).map((u: any) => ({
            ...u,
            isYou: u.id === currentUser?.id, // Only mark current user as "You"
          }));
          setActiveViewers(users);
          const newCollaboratorCount = Math.max(0, users.length - 1);
          setCollaboratorCount(newCollaboratorCount);
          return;
        }

        // Handle user joined
        if (data.type === "user-joined") {
          console.log("👋 User joined:", data.user);
          setActiveViewers((prev) => {
            if (prev.some((u) => u.id === data.user.id)) return prev;
            // Mark isYou as false for other users
            const userWithFlag = { ...data.user, isYou: false };
            return [...prev, userWithFlag];
          });
          setCollaboratorCount((prev) => prev + 1);
          return;
        }

        // Handle user left
        if (data.type === "user-left") {
          console.log("👋 User left:", data.user);
          setActiveViewers((prev) => prev.filter((u) => u.id !== data.user.id));
          setCollaboratorCount((prev) => Math.max(0, prev - 1));
          return;
        }

        // Handle joining an already-active Live Share session
        if (data.type === "liveshare-already-active") {
          console.log("📡 Joined workspace with active Live Share session");
          setLiveShareActive(true);
          setActiveTab("liveshare"); // Auto-switch to Live Share tab
          // Show notification
          console.log("💡 Live Share session is active - you've been connected!");
          return;
        }

        // Handle auto Live Share events from agent bridge
        if (data.type === "liveshare-auto-started") {
          console.log("🚀 Live Share auto-started by agent bridge");
          setLiveShareActive(true);
          setLiveShareLink(data.shareLink);
          setActiveTab("liveshare"); // Auto-switch to Live Share tab
          return;
        }

        if (data.type === "liveshare-auto-ended") {
          console.log("🛑 Live Share auto-ended by agent bridge");
          setLiveShareActive(false);
          setLiveShareLink(null);
          setActiveTab("ai"); // Switch back to AI tab
          return;
        }

        // Handle Live Share events from VS Code extension
        if (data.type === "liveshare-session-changed") {
          console.log("🔄 Live Share session changed:", data.session);
          if (data.session) {
            setLiveShareActive(true);
            // Update share link if available
            if (data.session.shareLink) {
              setLiveShareLink(data.session.shareLink);
            }
          }
          return;
        }

        if (data.type === "liveshare-session-ended") {
          console.log("🔄 Live Share session ended");
          setLiveShareActive(false);
          setLiveShareLink(null);
          return;
        }

        if (data.type === "liveshare-participants-changed") {
          console.log("👥 Live Share participants changed:", data.participants);
          // We use our own presence system instead of VSCode Live Share participants
          // The activeViewers are already managed by presence-join/leave/update events
          // So we don't need to update them here
          return;
        }

        if (data.type === "codeContext") {
          const { action, payload } = data;
          console.log("🎯 Code context action:", action, payload);

          if (action === "addToChat") {
            const context = `@${payload.filePath}:${payload.lineStart}-${payload.lineEnd}\n\n`;

            setInputMessage((prev) => {
              console.log(
                "✅ Adding code to input, current:",
                prev.length,
                "chars"
              );
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
          console.log(
            `Connected to VS Code extension WebSocket on port ${workspace.agentPort}`
          );
          reconnectDelayRef.current = 1000;
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }

          // Reset presence join flag so it can be sent again on reconnect
          hasJoinedPresenceRef.current = false;
          console.log("🔄 Reset presence join flag for new connection");

          // Start sending ping messages every 20 seconds to keep connection alive
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                console.log("🏓 Sending ping...");
                ws.send(JSON.stringify({ type: "ping" }));

                // Set timeout for pong response (8 seconds)
                pongTimeoutRef.current = setTimeout(() => {
                  console.error("❌ Pong timeout - no response from server");
                  const timeSinceLastPong = Date.now() - lastPongRef.current;
                  console.error(`⏱️ Last pong was ${timeSinceLastPong}ms ago`);

                  // If we haven't received a pong in 30 seconds, reconnect
                  if (timeSinceLastPong > 30000) {
                    console.error(
                      "🔄 Forcing reconnection due to pong timeout"
                    );
                    ws.close();
                  }
                }, 8000);
              } catch (error) {
                console.error("❌ Failed to send ping:", error);
              }
            }
          }, 20000);
        };

        ws.onmessage = handleWorkspaceSocketMessage;

        ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
          if (pongTimeoutRef.current) {
            clearTimeout(pongTimeoutRef.current);
            pongTimeoutRef.current = null;
          }
          ws.close();
        };

        ws.onclose = (event) => {
          console.warn(
            "⚠️ WebSocket closed:",
            event.code,
            event.reason || "(no reason)"
          );

          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
          if (pongTimeoutRef.current) {
            clearTimeout(pongTimeoutRef.current);
            pongTimeoutRef.current = null;
          }

          if (!shouldReconnectRef.current) {
            return;
          }

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
  }, [workspace?.agentPort]); // Removed handleWorkspaceSocketMessage to prevent reconnection loop

  // Fetch current user info for presence
  React.useEffect(() => {
    console.log("👤 Fetching current user for presence...");
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch("/api/auth/get-session");
        console.log("👤 Session API response:", res.status, res.ok);
        if (res.ok) {
          const data = await res.json();
          console.log("👤 Session data:", data);
          if (data.user) {
            const userData = {
              id: data.user.id,
              name: data.user.name || "Anonymous",
              email: data.user.email,
              image: data.user.image,
            };
            console.log("👤 Setting current user:", userData);
            setCurrentUser(userData);
          } else {
            console.warn("⚠️ No user in session data");
          }
        } else {
          console.error("❌ Session API failed:", res.status);
        }
      } catch (error) {
        console.error("❌ Failed to fetch user info:", error);
      }
    };

    fetchCurrentUser();
  }, []);

  // WebSocket-based presence tracking
  React.useEffect(() => {
    console.log("🔄 Presence useEffect running:", { 
      hasCurrentUser: !!currentUser, 
      currentUserId: currentUser?.id,
      hasWorkspace: !!workspace,
      workspaceId: workspace?.id,
      alreadySetup: presenceSetupDoneRef.current
    });
    
    if (!currentUser || !workspace) {
      console.log("⚠️ Skipping presence setup - missing currentUser or workspace");
      return;
    }
    
    // Only set up presence once
    if (presenceSetupDoneRef.current) {
      console.log("⚠️ Presence already set up, skipping");
      return;
    }
    
    presenceSetupDoneRef.current = true;
    console.log("✅ Setting up presence for user:", currentUser.name);

    // Generate consistent color for user
    const getUserColor = (userId: string) => {
      const colors = [
        "#3b82f6",
        "#8b5cf6",
        "#ec4899",
        "#f59e0b",
        "#10b981",
        "#06b6d4",
        "#f97316",
      ];
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = (hash << 5) - hash + userId.charCodeAt(i);
      }
      return colors[Math.abs(hash) % colors.length];
    };

    // Create presence object once and store in ref
    if (!myPresenceRef.current) {
      myPresenceRef.current = {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        image: currentUser.image,
        role: "guest", // Role will be determined by agent-bridge based on join order
        color: getUserColor(currentUser.id),
        isYou: true,
      };
    }
    
    const myPresence = myPresenceRef.current;

    // Add self to active viewers if not already there
    setActiveViewers((prev) => {
      if (prev.some((u) => u.id === currentUser.id)) return prev;
      return [myPresence, ...prev];
    });

    // Wait for WebSocket to be ready, then send join
    const checkAndJoin = () => {
      const ws = wsRef.current;
      console.log("🔍 Checking presence join conditions:", {
        hasWebSocket: !!ws,
        wsReadyState: ws?.readyState,
        wsOpen: ws?.readyState === WebSocket.OPEN,
        alreadyJoined: hasJoinedPresenceRef.current,
        userId: currentUser.id,
        userName: currentUser.name,
      });
      
      if (
        ws &&
        ws.readyState === WebSocket.OPEN &&
        !hasJoinedPresenceRef.current
      ) {
        hasJoinedPresenceRef.current = true;
        console.log("👋 Sending presence-join", myPresence);
        ws.send(
          JSON.stringify({
            type: "presence-join",
            user: myPresence,
          })
        );
      }
    };

    // Check immediately
    checkAndJoin();

    // If not ready, check every 500ms until ready
    const readyCheckInterval = setInterval(() => {
      if (hasJoinedPresenceRef.current) {
        clearInterval(readyCheckInterval);
        return;
      }
      checkAndJoin();
    }, 500);

    // Send periodic heartbeat (every 30 seconds)
    // Just to keep the connection alive - agent-bridge manages the user list
    const heartbeatInterval = setInterval(() => {
      const ws = wsRef.current;
      if (
        ws &&
        ws.readyState === WebSocket.OPEN &&
        hasJoinedPresenceRef.current
      ) {
        ws.send(
          JSON.stringify({
            type: "presence-heartbeat",
            user: myPresence,
            timestamp: Date.now(),
          })
        );
      }
    }, 30000);

    // Cleanup on unmount
    return () => {
      clearInterval(readyCheckInterval);
      clearInterval(heartbeatInterval);

      // Send presence-leave message
      const ws = wsRef.current;
      if (
        ws &&
        ws.readyState === WebSocket.OPEN &&
        hasJoinedPresenceRef.current
      ) {
        console.log("👋 Sending presence-leave on cleanup");
        ws.send(
          JSON.stringify({
            type: "presence-leave",
            user: myPresence,
          })
        );
      }

      hasJoinedPresenceRef.current = false;
      presenceSetupDoneRef.current = false; // Reset so it can be set up again if needed
      myPresenceRef.current = null; // Clear presence data
    };
  }, [currentUser?.id, workspace?.id]); // Only depend on IDs, not full objects

  // Handle file changes from VSCode iframe
  const handleFileChange = React.useCallback((filePath: string | null) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!currentUser) {
      return;
    }

    const oldFile = currentFileRef.current;

    // Send close event for previous file
    if (oldFile && oldFile !== filePath) {
      wsRef.current.send(
        JSON.stringify({
          type: "file-viewer-update",
          userId: currentUser.id,
          userName: currentUser.name,
          userColor: currentUser.color || "#3b82f6",
          filePath: oldFile,
          action: "close",
        })
      );
      console.log(`📂 Closed file: ${oldFile}`);
    }

    // Send open event for new file
    if (filePath) {
      wsRef.current.send(
        JSON.stringify({
          type: "file-viewer-update",
          userId: currentUser.id,
          userName: currentUser.name,
          userColor: currentUser.color || "#3b82f6",
          filePath,
          action: "open",
        })
      );
      console.log(`📂 Opened file: ${filePath}`);
    }

    currentFileRef.current = filePath;
  }, [currentUser]);

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

  // Live Share handlers
  const handleStartLiveShare = async () => {
    try {
      const res = await fetch(
        `/api/workspaces/${resolvedParams.id}/liveshare`,
        {
          method: "POST",
        }
      );

      const data = await res.json();

      if (data.success) {
        setLiveShareActive(true);
        setLiveShareLink(data.shareLink);
        setActiveTab("liveshare"); // Auto-switch to Live Share tab
        toast.success("Live Share started!", {
          icon: "🎉",
          description: "Share the link with your team",
        });
      }
    } catch (error: any) {
      toast.error("Failed to start Live Share", {
        description: error.message,
      });
    }
  };

  const handleEndLiveShare = async () => {
    try {
      await fetch(`/api/workspaces/${resolvedParams.id}/liveshare`, {
        method: "DELETE",
      });

      setLiveShareActive(false);
      setLiveShareLink(null);
      setCollaboratorCount(0);
      setActiveTab("ai"); // Switch back to AI tab
      toast.info("Live Share ended");
    } catch (error: any) {
      toast.error("Failed to end Live Share");
    }
  };

  // Define dynamic tabs
  const tabs: DynamicTab[] = React.useMemo(() => {
    const allTabs: DynamicTab[] = [
      {
        id: "ai",
        label: "AI Agent",
        icon: Brain,
        priority: 100,
        content: (
          <AIAgentPanel
            workspaceId={workspace?.id || ""}
            isWorkSpaceRunning={workspace?.status === "RUNNING"}
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
            currentChatTitle={
              chats.find((c) => c.id === currentChatId)?.title || "New Chat"
            }
            onSelectChat={handleSelectChat}
            onCreateChat={handleCreateChat}
          />
        ),
      },
      {
        id: "deployments",
        label: "Deployments",
        icon: Rocket,
        priority: 50,
        content: <DeploymentsPanel workspaceId={workspace?.id || ""} />,
      },
      {
        id: "databases",
        label: "Databases",
        icon: Database,
        priority: 40,
        content: <DatabasesPanel workspaceId={workspace?.id || ""} />,
      },
      {
        id: "buckets",
        label: "Buckets",
        icon: HardDrive,
        priority: 30,
        content: <BucketsPanel workspaceId={workspace?.id || ""} />,
      },
    ];

    // Add Live Share tab only when active
    if (liveShareActive) {
      allTabs.push({
        id: "liveshare",
        label: "Live Share",
        icon: Users,
        priority: 150, // Highest priority when active
        badge: collaboratorCount > 0 ? collaboratorCount : undefined,
        pulseColor: "#10b981", // Emerald-500
        content: (
          <LiveSharePanel
            workspaceId={workspace?.id || ""}
            agentBridgeWs={wsRef.current}
            shareLink={liveShareLink}
            activeUsers={activeViewers}
            onEndSession={handleEndLiveShare}
          />
        ),
      });
    }

    return allTabs;
  }, [
    workspace?.id,
    workspace?.status,
    liveShareActive,
    collaboratorCount,
    messages,
    inputMessage,
    isStreaming,
    favoriteModels,
    selectedModel,
    expandedTools,
    expandedReasoning,
    chats,
    currentChatId,
    liveShareLink,
  ]);

  // Get active tab content
  const activeTabContent = tabs.find((t) => t.id === activeTab)?.content;

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
      <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
        {/* Layer 0: Deep background with subtle glow */}
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_50%)] pointer-events-none" />

        {/* Layer 0.5: Mesh pattern for depth */}
        <div className="fixed inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none" />

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

        {/* Main Content - Layer 1 */}
        <div className="relative z-10 flex-1 flex overflow-hidden">
          {/* Editor Area - Layer 1: Main surface */}
          <div className="flex-1 bg-[#0f0f0f] relative">
            {/* Subtle top highlight */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

            <WorkspaceEditor
              workspace={workspace}
              starting={starting}
              restarting={restarting}
              rebuildStage={rebuildStage}
              rebuildLogs={rebuildLogs}
              onStart={handleStart}
              onFileChange={handleFileChange}
            />
          </div>

          {/* Right Panel - Layer 2: Elevated surface with depth */}
          <div className="w-[500px] flex flex-col bg-[#1a1a1a] border-l border-white/10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.3)] relative">
            {/* Inset highlight for depth */}
            <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-white/5 via-white/10 to-white/5" />

            {/* Dynamic Tab Bar */}
            <DynamicTabBar
              tabs={tabs}
              activeTabId={activeTab}
              onTabChange={setActiveTab}
              maxVisible={2}
            />

            {/* Active Tab Content */}
            <div className="flex-1 overflow-hidden">{activeTabContent}</div>
          </div>
        </div>
      </div>
    </>
  );
}

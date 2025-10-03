"use client";

import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import { FileCode, Loader2 } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  AgentHeader,
  AgentActivity,
  AgentConversation,
  AgentFilesPanel,
  AgentInput,
  AgentSidebar,
  AgentSidebarTab,
} from "@/components/agents";

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
  conversationHistory?: string;
  pushedAt?: string;
  lastMessageAt?: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
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
  diff?: string;
}

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params?.id as string;

  // State
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [filesEdited, setFilesEdited] = useState<EditedFile[]>([]);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const streamingTextRef = useRef("");

  // Fetch agent data
  useEffect(() => {
    if (agentId) {
      fetchAgent();
      connectToStream();
    }
  }, [agentId]);

  const fetchAgent = async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setAgent(data);

        if (data.toolCalls) {
          const parsed = JSON.parse(data.toolCalls);
          setToolCalls(Array.isArray(parsed) ? parsed : []);
        }
        if (data.filesEdited) {
          const files = JSON.parse(data.filesEdited);
          setFilesEdited(Array.isArray(files) ? files : []);
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

  const connectToStream = () => {
    if (!agentId) return;

    const eventSource = new EventSource(`/api/agents/${agentId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "init":
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
            break;

          case "tool-call":
            setToolCalls((prev) => {
              const exists = prev.some((tc) => tc.id === data.toolCall.id);
              if (exists) return prev;
              return [...prev, data.toolCall];
            });
            break;

          case "message":
            setConversation((prev) => {
              const exists = prev.some(
                (msg) =>
                  msg.timestamp === data.message.timestamp &&
                  msg.role === data.message.role
              );
              if (exists) return prev;
              return [...prev, data.message];
            });
            streamingTextRef.current = "";
            setStreamingText("");
            break;

          case "streaming":
            streamingTextRef.current += data.content;
            setStreamingText(streamingTextRef.current);
            break;

          case "files":
            setFilesEdited(data.files);
            break;

          case "done":
            setIsLiveStreaming(false);
            if (streamingTextRef.current) {
              setConversation((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: streamingTextRef.current,
                  timestamp: new Date().toISOString(),
                },
              ]);
            }
            streamingTextRef.current = "";
            setStreamingText("");
            setAgent((prev) => (prev ? { ...prev, status: "COMPLETED" } : null));
            break;
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = () => {
      setIsLiveStreaming(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsLiveStreaming(false);
    };
  };

  const handleSendChat = async () => {
    if (!chatMessage.trim()) return;

    setSendingChat(true);
    setIsLiveStreaming(true);

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

    const messageToSend = chatMessage;
    setChatMessage("");

    // Optimistically add user message
    const userMessage: ConversationMessage = {
      role: "user",
      content: messageToSend,
      timestamp: new Date().toISOString(),
    };
    setConversation((prev) => [...prev, userMessage]);

    try {
      const res = await fetch(`/api/agents/${agentId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTask: messageToSend }),
      });

      if (!res.ok) {
        setConversation((prev) =>
          prev.filter((msg) => msg.timestamp !== userMessage.timestamp)
        );
        const error = await res.json();
        alert(error.error || "Failed to resume agent");
      }
    } catch (error) {
      console.error("Error resuming agent:", error);
      setConversation((prev) =>
        prev.filter((msg) => msg.timestamp !== userMessage.timestamp)
      );
      alert("Failed to resume agent");
    } finally {
      setResuming(false);
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
          <button
            onClick={() => router.push("/dashboard/agents")}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <AgentHeader
          agent={agent}
          isLiveStreaming={isLiveStreaming}
          onBack={() => router.push("/dashboard/agents")}
          onPush={handlePushToGitHub}
          pushing={pushing}
        />

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Files Panel */}
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
                    {filesEdited.filter((f) => f.operation === "created").length}{" "}
                    created,{" "}
                    {filesEdited.filter((f) => f.operation === "modified").length}{" "}
                    modified
                  </div>
                )}
              </div>
            </div>
            <AgentFilesPanel files={filesEdited} />
          </div>

          {/* Right: Activity & Chat Sidebar */}
          <AgentSidebar
            activityCount={toolCalls.length}
            chatCount={conversation.length}
          >
            <AgentSidebarTab tab="activity">
              <AgentActivity toolCalls={toolCalls} />
            </AgentSidebarTab>

            <AgentSidebarTab tab="chat">
              <AgentConversation
                messages={conversation}
                streamingText={streamingText}
              />
              <AgentInput
                value={chatMessage}
                onChange={setChatMessage}
                onSend={handleSendChat}
                onResume={handleResumeAgent}
                sending={sendingChat}
                resuming={resuming}
                agentStatus={agent.status}
              />
            </AgentSidebarTab>
          </AgentSidebar>
        </div>
      </div>
    </div>
  );
}

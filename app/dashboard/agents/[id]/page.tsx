"use client";

import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import { FileCode, Loader2 } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAgentStream } from "@/hooks/use-agent-stream";
import {
  AgentHeader,
  AgentActivity,
  AgentConversation,
  AgentFilesPanel,
  AgentInput,
  AgentSidebar,
  AgentSidebarTab,
  AgentTimeline,
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
  pushedAt?: string;
  lastMessageAt?: string;
}

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params?.id as string;

  // Socket.io real-time stream (gets conversation, toolCalls, filesEdited)
  const { 
    status: streamStatus, 
    messages: conversation, 
    toolCalls, 
    filesEdited,
    connected 
  } = useAgentStream(agentId);

  // Local state for agent metadata
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [pushing, setPushing] = useState(false);

  // Fetch agent metadata (name, repo, branches, etc)
  useEffect(() => {
    if (agentId) {
      fetchAgent();
    }
  }, [agentId]);

  // Update agent status from stream
  useEffect(() => {
    if (streamStatus && agent) {
      console.log('📊 Updating agent status from stream:', streamStatus);
      setAgent(prev => prev ? { ...prev, status: streamStatus as any } : null);
    }
  }, [streamStatus]);

  // Debug: Log Socket.io connection state
  useEffect(() => {
    console.log('🔌 Socket.io connected:', connected);
    console.log('📊 Stream status:', streamStatus);
    console.log('💬 Messages:', conversation.length);
    console.log('🔧 Tool calls:', toolCalls.length);
    console.log('📁 Files edited:', filesEdited.length);
  }, [connected, streamStatus, conversation, toolCalls, filesEdited]);

  const fetchAgent = async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setAgent(data);
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
    const messageToSend = chatMessage;
    setChatMessage("");

    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to send message");
      }
    } catch (error) {
      console.error("Error sending chat:", error);
      alert("Failed to send message");
    } finally {
      setSendingChat(false);
    }
  };

  const handleResumeWithNewTask = async () => {
    if (!chatMessage.trim()) return;

    setResuming(true);
    const messageToSend = chatMessage;
    setChatMessage("");

    try {
      const res = await fetch(`/api/agents/${agentId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTask: messageToSend }),
      });

      if (res.ok) {
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
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  // Calculate stats
  const filesCreated = filesEdited.filter((f) => f.operation === "created").length;
  const filesModified = filesEdited.filter((f) => f.operation === "modified").length;
  const filesDeleted = filesEdited.filter((f) => f.operation === "deleted").length;
  const totalFiles = filesEdited.length;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <AgentHeader
          agent={agent}
          onPush={handlePushToGitHub}
          pushing={pushing}
          isLiveStreaming={agent.status === "RUNNING"}
          onBack={() => router.push("/dashboard/agents")}
        />

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Files Panel */}
          <div className="flex flex-1 flex-col overflow-hidden border-r">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  <h2 className="text-sm font-medium">Edited Files</h2>
                  <Badge variant="secondary">{totalFiles}</Badge>
                </div>
                {!connected && (
                  <Badge variant="destructive" className="text-xs">Disconnected</Badge>
                )}
                {connected && agent.status === "RUNNING" && (
                  <Badge variant="default" className="text-xs">Live</Badge>
                )}
              </div>
            </div>
            <AgentFilesPanel files={filesEdited} />
          </div>

          {/* Right: Chat & Activity Sidebar */}
          <AgentSidebar 
            activityCount={toolCalls.length}
            chatCount={conversation.length}
          >
            <AgentSidebarTab tab="activity">
              <AgentActivity 
                toolCalls={toolCalls}
              />
            </AgentSidebarTab>
            <AgentSidebarTab tab="chat">
              <AgentConversation
                messages={conversation}
                streamingText=""
              />
              <AgentInput
                value={chatMessage}
                onChange={setChatMessage}
                onSend={handleSendChat}
                onResume={handleResumeWithNewTask}
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

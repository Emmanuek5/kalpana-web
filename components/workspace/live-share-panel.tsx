"use client";

import React, { useEffect, useState, useRef } from "react";
import { Users, Copy, X, Circle, Share2, ExternalLink, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface Participant {
  id: string;
  name: string;
  email?: string;
  role: "host" | "guest";
  color?: string;
  isYou?: boolean;
}

interface LiveSharePanelProps {
  workspaceId: string;
  agentBridgeWs: WebSocket | null;
  shareLink: string | null;
  activeUsers: Participant[];
  onEndSession: () => void;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userColor?: string;
  message: string;
  timestamp: number;
}

export function LiveSharePanel({
  workspaceId,
  agentBridgeWs,
  shareLink,
  activeUsers,
  onEndSession,
}: LiveSharePanelProps) {
  const [participants, setParticipants] = useState<Participant[]>(activeUsers);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Update participants when activeUsers changes
  useEffect(() => {
    setParticipants(activeUsers);
  }, [activeUsers]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Listen for Live Share events from WebSocket
  useEffect(() => {
    if (!agentBridgeWs) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case "liveshare-already-active":
            toast.success("Live Share session active", {
              icon: "📡",
              description: "You've joined an ongoing collaboration session",
              duration: 4000,
            });
            break;

          case "user-joined":
            toast.success(`${message.user.name || 'Someone'} joined`, {
              icon: "👋",
              description: "Now collaborating in this workspace",
              duration: 3000,
            });
            break;

          case "user-left":
            toast.info(`${message.user.name || 'Someone'} left`, {
              icon: "👋",
              duration: 2000,
            });
            break;

          case "liveshare-session-ended":
            break;

          case "chat-message":
            // Add incoming chat message
            setChatMessages((prev) => [...prev, message.data]);
            break;
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    agentBridgeWs.addEventListener("message", handleMessage);
    return () => agentBridgeWs.removeEventListener("message", handleMessage);
  }, [agentBridgeWs]);

  const sendChatMessage = () => {
    if (!messageInput.trim() || !agentBridgeWs) return;

    const currentUser = participants.find((p) => p.isYou);
    if (!currentUser) return;

    const chatMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userColor: currentUser.color,
      message: messageInput.trim(),
      timestamp: Date.now(),
    };

    // Send to agent-bridge
    agentBridgeWs.send(
      JSON.stringify({
        type: "chat-message",
        data: chatMessage,
      })
    );

    // Add to local state immediately
    setChatMessages((prev) => [...prev, chatMessage]);
    setMessageInput("");
  };

  const copyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast.success("Link copied to clipboard!");
    }
  };

  const openVSCodeLiveSharePanel = async () => {
    try {
      // Send command to agent bridge to open VS Code Live Share panel
      const response = await fetch(`/api/workspaces/${workspaceId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `show-liveshare-panel-${Date.now()}`,
          type: "showLiveSharePanel",
          payload: {},
        }),
      });

      if (response.ok) {
        toast.success("VS Code Live Share panel opened!");
      } else {
        toast.error("Failed to open VS Code Live Share panel");
      }
    } catch (error) {
      toast.error("Failed to communicate with VS Code");
    }
  };

  return (
    <div className="h-full flex flex-col bg-black/40">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold text-emerald-400">
              Live Collaboration Active
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={openVSCodeLiveSharePanel}
              className="h-7 text-zinc-400 hover:text-emerald-400"
              title="Open VS Code Live Share panel"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              VS Code
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEndSession}
              className="h-7 text-zinc-400 hover:text-red-400"
            >
              <X className="h-4 w-4 mr-1" />
              End
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Share Link Section */}
        {shareLink && (
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wide font-medium">
              Share Link
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400 font-mono"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={copyShareLink}
                className="border-zinc-800 hover:border-emerald-800"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-zinc-600">
              Share this link with your team to collaborate in real-time
            </p>
          </div>
        )}

        {/* Participants Section */}
        <div className="space-y-3">
          <div className="text-xs text-zinc-500 uppercase tracking-wide font-medium">
            Active Participants ({participants.length})
          </div>

          {/* All Participants */}
          {participants.length > 0 ? (
            participants.map((participant) => {
              const isHost = participant.role === "host";
              const roleLabel = isHost ? "Host" : "Guest";
              const borderColor = participant.isYou
                ? "border-emerald-900/30 bg-emerald-950/20"
                : "border-zinc-800/50 bg-zinc-900/50";

              return (
                <div
                  key={participant.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${borderColor}`}
                >
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{
                      background:
                        participant.color || (isHost ? "#10b981" : "#8b5cf6"),
                    }}
                  >
                    {participant.isYou
                      ? "You"
                      : participant.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-300 truncate">
                      {participant.name}
                      {participant.isYou && " (You)"}
                      <span className="ml-2 text-xs text-zinc-500">
                        • {roleLabel}
                      </span>
                    </div>
                    {(participant as any).currentFile ? (
                      <div className="text-xs text-zinc-500 truncate flex items-center gap-1">
                        <span className="text-zinc-600">📄</span>
                        {(participant as any).currentFile.split('/').pop()}
                      </div>
                    ) : participant.email ? (
                      <div className="text-xs text-zinc-500 truncate">
                        {participant.email}
                      </div>
                    ) : null}
                  </div>
                  <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                </div>
              );
            })
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No participants</p>
              <p className="text-xs text-zinc-600 mt-1">
                Waiting for presence data...
              </p>
            </div>
          )}
        </div>

        {/* Chat Section */}
        <div className="mt-6">
          <div className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-3">
            Team Chat
          </div>
          
          {/* Chat Messages */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
            <div className="h-64 overflow-y-auto p-3 space-y-2">
              {chatMessages.length > 0 ? (
                chatMessages.map((msg) => {
                  const isYou = participants.find((p) => p.id === msg.userId)?.isYou;
                  return (
                    <div key={msg.id} className="flex gap-2">
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: msg.userColor || "#8b5cf6" }}
                      >
                        {msg.userName[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-medium text-zinc-300">
                            {msg.userName}
                            {isYou && " (You)"}
                          </span>
                          <span className="text-xs text-zinc-600">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-400 break-words">
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center text-center">
                  <p className="text-xs text-zinc-600">
                    No messages yet. Start chatting!
                  </p>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat Input */}
            <div className="border-t border-zinc-800/50 p-2 flex gap-2">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-zinc-800/50 border-zinc-700/50 text-sm text-zinc-300 placeholder:text-zinc-600"
              />
              <Button
                onClick={sendChatMessage}
                disabled={!messageInput.trim()}
                size="sm"
                className="bg-emerald-600/90 hover:bg-emerald-500 text-white"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
          <div className="flex items-start gap-3">
            <Share2 className="h-5 w-5 text-emerald-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-zinc-300 mb-1">
                Real-time Collaboration
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Collaborators can edit code together, see each other's cursors,
                share terminals, and debug in real-time using VSCode Live Share.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { Users, Copy, X, Circle, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Participant {
  userId: string;
  userName: string;
  email?: string;
  role: 'Owner' | 'Guest';
  joinedAt: number;
}

interface LiveSharePanelProps {
  workspaceId: string;
  agentBridgeWs: WebSocket | null;
  shareLink: string | null;
  onEndSession: () => void;
}

export function LiveSharePanel({
  workspaceId,
  agentBridgeWs,
  shareLink,
  onEndSession,
}: LiveSharePanelProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Listen for Live Share events from WebSocket
  useEffect(() => {
    if (!agentBridgeWs) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'user-joined':
            setParticipants((prev) => [...prev, message.user]);
            toast.success(`${message.user.userName} joined`, {
              icon: '👋',
              description: 'Now collaborating in this workspace',
              duration: 3000,
            });
            break;

          case 'user-left':
            setParticipants((prev) =>
              prev.filter((p) => p.userId !== message.user.userId)
            );
            toast.info(`${message.user.userName} left`, {
              icon: '👋',
              duration: 2000,
            });
            break;

          case 'liveshare-session-ended':
            setParticipants([]);
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    agentBridgeWs.addEventListener('message', handleMessage);
    return () => agentBridgeWs.removeEventListener('message', handleMessage);
  }, [agentBridgeWs]);

  const copyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast.success('Link copied to clipboard!');
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
            Active Participants ({participants.length + 1})
          </div>

          {/* You (Owner) */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/30">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
              You
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-300 font-medium">You (Owner)</div>
              <div className="text-xs text-zinc-500">Session host</div>
            </div>
            <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
          </div>

          {/* Other Participants */}
          {participants.length > 0 ? (
            participants.map((participant) => (
              <div
                key={participant.userId}
                className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                  {participant.userName[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-300 truncate">
                    {participant.userName}
                  </div>
                  {participant.email && (
                    <div className="text-xs text-zinc-500 truncate">
                      {participant.email}
                    </div>
                  )}
                </div>
                <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No collaborators yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Share the link above to invite team members
              </p>
            </div>
          )}
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
                Collaborators can edit code together, see each other's cursors, share terminals, and debug in real-time using VSCode Live Share.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

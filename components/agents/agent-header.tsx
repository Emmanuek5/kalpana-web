"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  ArrowLeft,
  Github,
  GitBranch,
  Activity,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface AgentHeaderProps {
  agent: {
    name: string;
    task: string;
    githubRepo: string;
    sourceBranch: string;
    targetBranch: string;
    status: "IDLE" | "CLONING" | "RUNNING" | "COMPLETED" | "ERROR" | "PUSHING";
    errorMessage?: string;
    lastMessageAt?: string;
    pushedAt?: string;
  };
  isLiveStreaming: boolean;
  onBack: () => void;
  onPush?: () => void;
  pushing?: boolean;
}

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

export function AgentHeader({
  agent,
  isLiveStreaming,
  onBack,
  onPush,
  pushing = false,
}: AgentHeaderProps) {
  return (
    <div className="border-b border-zinc-800/50 px-6 py-4 bg-zinc-950/50 backdrop-blur-sm">
      {/* Title Row */}
      <div className="flex items-center gap-4">
        <Button
          size="sm"
          variant="ghost"
          onClick={onBack}
          className="text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Bot className="h-5 w-5 text-emerald-400" />
        <div className="flex-1">
          <h1 className="text-lg font-medium text-zinc-100">{agent.name}</h1>
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
        {agent.status === "COMPLETED" && !agent.pushedAt && onPush && (
          <Button
            size="sm"
            className="bg-purple-600 text-white hover:bg-purple-500"
            onClick={onPush}
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
            {agent.sourceBranch} <span className="text-zinc-600">→</span>{" "}
            {agent.targetBranch}
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
              <p className="text-sm font-medium text-red-300">Agent Error</p>
              <p className="text-xs text-red-400 mt-1">{agent.errorMessage}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

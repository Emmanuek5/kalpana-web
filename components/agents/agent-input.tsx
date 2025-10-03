"use client";

import { Button } from "@/components/ui/button";
import { MessageSquare, Send, PlayCircle, Loader2 } from "lucide-react";

interface AgentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onResume?: () => void;
  sending: boolean;
  resuming?: boolean;
  agentStatus: "IDLE" | "CLONING" | "RUNNING" | "COMPLETED" | "ERROR" | "PUSHING";
  placeholder?: string;
}

export function AgentInput({
  value,
  onChange,
  onSend,
  onResume,
  sending,
  resuming = false,
  agentStatus,
  placeholder,
}: AgentInputProps) {
  const isCompleted = agentStatus === "COMPLETED" || agentStatus === "IDLE";
  const canResume = isCompleted && onResume;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canResume) {
        onResume();
      } else {
        onSend();
      }
    }
  };

  return (
    <div className="border-t border-zinc-800/50 px-3 py-3 bg-zinc-900/30">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
        <p className="text-[10px] text-zinc-500">
          {isCompleted
            ? "Resume with new task or ask questions"
            : "Chat with the agent"}
        </p>
      </div>

      {/* Modern Textarea with Embedded Buttons */}
      <div className="relative bg-zinc-900/50 border border-zinc-800/60 rounded-lg hover:border-zinc-700/80 focus-within:border-emerald-500/40 transition-colors">
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder ||
            (isCompleted ? "Give agent a new task..." : "Send a message...")
          }
          className="w-full bg-transparent px-3 pt-2 pb-10 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none"
          onKeyDown={handleKeyDown}
        />

        {/* Button Row Inside Textarea */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <div className="text-[10px] text-zinc-600">
            {value.length > 0 && `${value.length} chars`}
          </div>
          <div className="flex gap-1.5">
            {canResume && (
              <Button
                size="sm"
                onClick={onResume}
                disabled={resuming || !value.trim()}
                className="h-7 px-3 bg-purple-600/90 hover:bg-purple-600 disabled:bg-zinc-800 disabled:opacity-50 text-[11px] font-medium"
              >
                {resuming ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Resuming...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-3 w-3 mr-1.5" />
                    Resume
                  </>
                )}
              </Button>
            )}
            <Button
              size="sm"
              onClick={onSend}
              disabled={sending || !value.trim()}
              className="h-7 px-3 bg-emerald-600/90 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:opacity-50 text-[11px] font-medium"
            >
              {sending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-3 w-3 mr-1.5" />
                  {isCompleted ? "Ask" : "Send"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

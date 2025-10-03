"use client";

import { Brain, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface AgentConversationProps {
  messages: ConversationMessage[];
  streamingText?: string;
}

export function AgentConversation({
  messages,
  streamingText,
}: AgentConversationProps) {
  if (messages.length === 0 && !streamingText) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-2 text-2xl">⚡</div>
          <p className="text-xs text-zinc-500">
            Agent ready. Conversation will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="max-w-3xl mx-auto space-y-3">
        {messages.map((msg, idx) => (
          <div key={idx} className="space-y-2">
            {msg.role === "user" ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-4 w-4 rounded-md bg-zinc-800/50 flex items-center justify-center">
                    <span className="text-[9px] text-zinc-400">You</span>
                  </div>
                </div>
                <div className="text-xs text-zinc-200 leading-relaxed">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="h-4 w-4 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <Brain className="h-2.5 w-2.5 text-emerald-500" />
                  </div>
                  <span className="text-[9px] text-zinc-500 font-medium">
                    Agent
                  </span>
                </div>
                <div className="text-[13px] text-zinc-300 prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      p: ({ children }) => (
                        <p className="mb-3 leading-relaxed text-[13px]">
                          {children}
                        </p>
                      ),
                      code: ({ inline, children, ...props }: any) =>
                        inline ? (
                          <code
                            className="px-1 py-0.5 bg-zinc-800/50 text-emerald-400 rounded text-[11px] font-mono"
                            {...props}
                          >
                            {children}
                          </code>
                        ) : (
                          <pre className="bg-zinc-900/50 p-3 rounded-lg my-2 overflow-x-auto border border-zinc-800/30">
                            <code className="text-[11px] font-mono text-zinc-300">
                              {children}
                            </code>
                          </pre>
                        ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-2 space-y-1">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-2 space-y-1">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-zinc-400 leading-relaxed text-[13px] mb-1">
                          {children}
                        </li>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-emerald-500/30 pl-3 py-1 my-2 text-zinc-400 italic text-xs">
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Streaming message */}
        {streamingText && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="h-4 w-4 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Brain className="h-2.5 w-2.5 text-emerald-500" />
              </div>
              <span className="text-[9px] text-zinc-500 font-medium">
                Agent
              </span>
            </div>
            <div className="text-xs text-zinc-300 prose prose-invert prose-xs max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {streamingText}
              </ReactMarkdown>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-600 text-[10px]">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>Streaming...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

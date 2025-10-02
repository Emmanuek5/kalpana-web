"use client";

import React from "react";
import { Brain, User, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { CodeBlock } from "./code-block";
import { ToolCall } from "./tool-call";
import type { Message, MessagePart } from "./types";

export type { Message, MessagePart } from "./types";

export const MessageBubble = React.memo(
  ({
    message,
    expandedTools,
    setExpandedTools,
    renderTextWithFileLinks,
    onRestore,
    showRestore = false,
  }: {
    message: Message;
    expandedTools: Set<string>;
    setExpandedTools: React.Dispatch<React.SetStateAction<Set<string>>>;
    renderTextWithFileLinks: (text: string) => React.ReactNode;
    onRestore?: (messageId: string) => void;
    showRestore?: boolean;
  }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);

    // Build user message text
    const userText = React.useMemo(
      () =>
        message.role === "user"
          ? message.parts
              .filter((p) => p.type === "text")
              .map((p: any) => p.text)
              .join("\n")
          : "",
      [message]
    );

    // Max length before truncation
    const MAX_LENGTH = 300;
    const isLongUserMessage = userText.length > MAX_LENGTH;
    const previewText = isLongUserMessage
      ? userText.slice(0, MAX_LENGTH) + "..."
      : userText;

    const markdownComponents = React.useMemo(
      () => ({
        p: ({ children }: any) => {
          const getText = (node: any): string => {
            if (typeof node === "string") return node;
            if (Array.isArray(node)) return node.map(getText).join("");
            if (node?.props?.children) return getText(node.props.children);
            return "";
          };
          const text = getText(children);
          return (
            <p className="mb-3 leading-relaxed text-zinc-200">
              {renderTextWithFileLinks(text)}
            </p>
          );
        },
        code: CodeBlock,
        pre: ({ children }: any) => (
          <pre className="bg-zinc-900/70 border border-zinc-800/50 rounded-xl p-4 my-3 overflow-x-auto text-sm">
            {children}
          </pre>
        ),
        ul: ({ children }: any) => (
          <ul className="list-disc list-inside mb-3 space-y-1 text-zinc-300">
            {children}
          </ul>
        ),
        ol: ({ children }: any) => (
          <ol className="list-decimal list-inside mb-3 space-y-1 text-zinc-300">
            {children}
          </ol>
        ),
        li: ({ children }: any) => <li className="text-zinc-300">{children}</li>,
        h1: ({ children }: any) => (
          <h1 className="text-lg font-bold text-white mb-2 mt-4">{children}</h1>
        ),
        h2: ({ children }: any) => (
          <h2 className="text-base font-semibold text-white mb-2 mt-3">
            {children}
          </h2>
        ),
        h3: ({ children }: any) => (
          <h3 className="text-sm font-semibold text-zinc-200 mb-1 mt-2">
            {children}
          </h3>
        ),
        blockquote: ({ children }: any) => (
          <blockquote className="border-l-2 border-emerald-500/40 pl-3 py-1 my-2 text-zinc-400 italic">
            {children}
          </blockquote>
        ),
      }),
      [renderTextWithFileLinks]
    );

    const handleToggleTool = React.useCallback(
      (toolCallId: string) => {
        setExpandedTools((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(toolCallId)) {
            newSet.delete(toolCallId);
          } else {
            newSet.add(toolCallId);
          }
          return newSet;
        });
      },
      [setExpandedTools]
    );

    const assistantParts = React.useMemo(() => {
      return message.parts.map((part, partIdx) => {
        if (part.type === "text" && (part as any).text) {
          const textPart = part as Extract<MessagePart, { type: "text" }>;
          return (
            <div key={partIdx} className="text-sm text-zinc-200">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={markdownComponents}
              >
                {textPart.text}
              </ReactMarkdown>
            </div>
          );
        }

        if (part.type === "tool") {
          const toolPart = part as Extract<MessagePart, { type: "tool" }>;
          return (
            <ToolCall
              key={partIdx}
              toolPart={toolPart}
              isExpanded={expandedTools.has(toolPart.toolCallId)}
              onToggle={() => handleToggleTool(toolPart.toolCallId)}
            />
          );
        }

        return null;
      });
    }, [message.parts, expandedTools, handleToggleTool, markdownComponents]);

    return (
      <div 
        className="w-full space-y-2"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-zinc-500">
          <div className="flex items-center gap-2">
          {message.role === "user" ? (
            <User className="h-3 w-3 text-blue-400" />
          ) : (
            <Brain className="h-3 w-3 text-emerald-400" />
          )}
            <span>{message.role === "user" ? "You" : "Agent"}</span>
          </div>
          
          {/* Restore Button (only for user messages with checkpoint) */}
          {message.role === "user" && showRestore && onRestore && isHovered && (
            <button
              onClick={() => onRestore(message.id)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/30 rounded-md transition-all"
              title="Restore to this checkpoint"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Restore</span>
            </button>
          )}
        </div>

        {/* Bubble */}
        <div
          className={`w-full rounded-xl px-4 py-3 shadow-sm text-sm leading-relaxed ${
            message.role === "user"
              ? "bg-blue-500/10 border border-blue-500/20 text-blue-100"
              : "bg-zinc-800/60 border border-zinc-700 text-zinc-100"
          }`}
        >
          {message.role === "user" ? (
            <>
              <div>
                {isExpanded || !isLongUserMessage ? userText : previewText}
              </div>
              {isLongUserMessage && (
                <button
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className="flex items-center gap-1 text-xs text-blue-400 mt-2 hover:text-blue-300"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3" /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" /> Show more
                    </>
                  )}
                </button>
              )}
            </>
          ) : (
            <div className="space-y-3">{assistantParts}</div>
          )}
        </div>
      </div>
    );
  }
);

MessageBubble.displayName = "MessageBubble";

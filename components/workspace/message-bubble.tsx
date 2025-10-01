import React from "react";
import { Brain } from "lucide-react";
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
  }: {
    message: Message;
    expandedTools: Set<string>;
    setExpandedTools: React.Dispatch<React.SetStateAction<Set<string>>>;
    renderTextWithFileLinks: (text: string) => React.ReactNode;
  }) => {
    // Pre-compute user message text once
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
            <p className="mb-3 leading-relaxed">
              {renderTextWithFileLinks(text)}
            </p>
          );
        },
        code: CodeBlock,
        pre: ({ children }: any) => (
          <pre className="bg-zinc-900/50 border border-zinc-800/30 rounded-lg p-3 my-2 overflow-x-auto">
            {children}
          </pre>
        ),
        ul: ({ children }: any) => (
          <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
        ),
        ol: ({ children }: any) => (
          <ol className="list-decimal list-inside mb-3 space-y-1">
            {children}
          </ol>
        ),
        li: ({ children }: any) => (
          <li className="text-zinc-400">{children}</li>
        ),
        h1: ({ children }: any) => (
          <h1 className="text-lg font-bold text-zinc-100 mb-2 mt-4">
            {children}
          </h1>
        ),
        h2: ({ children }: any) => (
          <h2 className="text-base font-semibold text-zinc-100 mb-2 mt-3">
            {children}
          </h2>
        ),
        h3: ({ children }: any) => (
          <h3 className="text-sm font-semibold text-zinc-200 mb-1 mt-2">
            {children}
          </h3>
        ),
        blockquote: ({ children }: any) => (
          <blockquote className="border-l-2 border-emerald-500/30 pl-3 py-1 my-2 text-zinc-400 italic">
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

    // Pre-compute assistant parts rendering to avoid recompute
    const assistantParts = React.useMemo(() => {
      return message.parts.map((part, partIdx) => {
        if (part.type === "text" && (part as any).text) {
          const textPart = part as Extract<MessagePart, { type: "text" }>;
          return (
            <div key={partIdx} className="text-sm text-zinc-300">
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

        if (
          part.type === "tool" &&
          (part as any).state === "output-available"
        ) {
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
      <div className="space-y-3">
        {message.role === "user" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-5 w-5 rounded-md bg-zinc-800/50 flex items-center justify-center">
                <span className="text-[10px] text-zinc-400">You</span>
              </div>
            </div>
            <div className="text-sm text-zinc-200 leading-relaxed">
              {userText}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-5 w-5 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Brain className="h-3 w-3 text-emerald-500" />
              </div>
              <span className="text-[10px] text-zinc-500 font-medium">
                Agent
              </span>
            </div>
            {assistantParts}
          </div>
        )}
      </div>
    );
  }
);

MessageBubble.displayName = "MessageBubble";

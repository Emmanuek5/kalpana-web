import React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
  ChevronDown,
  ChevronUp,
  X,
  Paperclip,
  Image as ImageIcon,
  BrushCleaning,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export interface AttachedImage {
  name: string;
  base64: string;
  mimeType: string;
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

interface AIAgentPanelProps {
  workspaceId: string;
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  handleSend: (messageOverride?: string, images?: AttachedImage[]) => void;
  isStreaming: boolean;
  favoriteModels: Array<{ id: string; name: string }>;
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  expandedTools: Set<string>;
  setExpandedTools: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedReasoning: Set<string>;
  setExpandedReasoning: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleOpenFile: (filePath: string) => void;
  renderTextWithFileLinks: (text: string) => React.ReactNode;
  onClearHistory?: () => void;
}

// Memoized CodeBlock component (unchanged, already optimized)
const CodeBlock = React.memo(
  ({ inline, className, children, ...props }: any) => {
    const extractText = React.useCallback((node: any): string => {
      if (typeof node === "string") return node;
      if (typeof node === "number") return String(node);
      if (Array.isArray(node)) return node.map(extractText).join("");
      if (node && typeof node === "object") {
        if (node.props && node.props.children) {
          return extractText(node.props.children);
        }
        return JSON.stringify(node, null, 2);
      }
      return "";
    }, []);

    const content = extractText(children);

    return inline ? (
      <code
        className="px-1.5 py-0.5 bg-zinc-800/50 text-emerald-400 rounded text-xs font-mono"
        {...props}
      >
        {content}
      </code>
    ) : (
      <code
        className={`block bg-zinc-900/50 p-3 rounded-lg my-2 text-xs overflow-x-auto border border-zinc-800/30 ${
          className || ""
        }`}
        {...props}
      >
        {content}
      </code>
    );
  }
);

CodeBlock.displayName = "CodeBlock";

// Memoized Tool Call component (unchanged)
const ToolCall = React.memo(
  ({
    toolPart,
    isExpanded,
    onToggle,
  }: {
    toolPart: Extract<MessagePart, { type: "tool" }>;
    isExpanded: boolean;
    onToggle: () => void;
  }) => {
    const IconComponent = TOOL_ICONS[toolPart.toolName] || TerminalIcon;

    return (
      <div className="group relative bg-zinc-900/20 border border-zinc-800/30 rounded-md overflow-hidden hover:border-zinc-700/50 transition-colors">
        <button
          onClick={onToggle}
          className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left"
        >
          <div className="h-4 w-4 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <IconComponent className="h-2.5 w-2.5 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-medium text-zinc-500 block">
              {toolPart.toolName.replace(/([A-Z])/g, " $1").trim()}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isExpanded ? (
              <ChevronUp className="h-2.5 w-2.5 text-zinc-600" />
            ) : (
              <ChevronDown className="h-2.5 w-2.5 text-zinc-600" />
            )}
          </div>
        </button>
        {isExpanded && (
          <div className="px-3 pb-3 border-t border-zinc-800/30 bg-black/10">
            {toolPart.input && Object.keys(toolPart.input).length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] font-semibold text-emerald-500/70 mb-1 tracking-wide">
                  INPUT
                </div>
                <div className="text-xs text-zinc-400 bg-zinc-950/50 border border-zinc-800/30 p-2 rounded overflow-auto max-h-32 font-mono">
                  {JSON.stringify(toolPart.input, null, 2)}
                </div>
              </div>
            )}
            {toolPart.output && (
              <div className="mt-2">
                <div className="text-[10px] font-semibold text-emerald-500/70 mb-1 tracking-wide">
                  OUTPUT
                </div>
                <div className="text-xs text-zinc-400 bg-zinc-950/50 border border-zinc-800/30 p-2 rounded overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                  {typeof toolPart.output === "string"
                    ? toolPart.output
                    : JSON.stringify(toolPart.output, null, 2)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

ToolCall.displayName = "ToolCall";

// Memoized Message component (optimized: pre-compute user text, stable markdown components)
const MessageBubble = React.memo(
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
      [renderTextWithFileLinks] // Stable if prop is stable
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

// Memoized InputSection component to isolate input re-renders
const InputSection = React.memo(
  ({
    input,
    setInput,
    handleSend,
    isStreaming,
    attachedImages,
    favoriteModels,
    selectedModel,
    setSelectedModel,
    onImageUpload,
    onRemoveImage,
    onSendWithContext,
    onKeyDown,
  }: {
    input: string;
    setInput: (value: string) => void;
    handleSend: (messageOverride?: string, images?: AttachedImage[]) => void;
    isStreaming: boolean;
    attachedImages: AttachedImage[];
    favoriteModels: Array<{ id: string; name: string }>;
    selectedModel: string;
    setSelectedModel: (value: string) => void;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveImage: (name: string) => void;
    onSendWithContext: () => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  }) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    return (
      <div className="px-3 pt-3 pb-4">
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl hover:border-zinc-700/80 focus-within:border-emerald-500/40 transition-colors flex flex-col">
          <div className="flex flex-col">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask anything..."
              disabled={isStreaming}
              className="w-full bg-transparent px-4 pt-4 pb-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed scrollbar-thin"
              style={{ minHeight: "72px", maxHeight: "200px" }}
            />

            {/* Controls */}
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming}
                  className="h-7 w-7 rounded-lg hover:bg-zinc-800/80 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                  title="Attach images"
                >
                  <Paperclip className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-400" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onImageUpload}
                />

                {favoriteModels.length > 0 && (
                  <div className="relative">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="h-7 pl-2 pr-6 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 rounded-lg text-[11px] text-zinc-400 font-medium appearance-none focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
                    >
                      {favoriteModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500 pointer-events-none" />
                  </div>
                )}
              </div>

              <button
                onClick={onSendWithContext}
                disabled={!input.trim() || isStreaming}
                className="h-7 w-7 bg-emerald-600/90 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:opacity-50 rounded-lg flex items-center justify-center transition-colors disabled:cursor-not-allowed"
              >
                {isStreaming ? (
                  <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Attached Images Preview (memoized separately if needed) */}
        {attachedImages.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachedImages.map((img) => (
              <div
                key={img.name}
                className="relative inline-flex bg-zinc-800/50 rounded-md overflow-hidden max-w-[100px]"
              >
                <img
                  src={`data:${img.mimeType};base64,${img.base64}`}
                  alt={img.name}
                  className="w-16 h-16 object-cover"
                />
                <button
                  onClick={() => onRemoveImage(img.name)}
                  className="absolute top-1 right-1 h-4 w-4 bg-zinc-900/80 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[10px] text-white px-1 truncate">
                  {img.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

InputSection.displayName = "InputSection";

const TOOL_ICONS: Record<string, React.ComponentType<any>> = {
  listFiles: TerminalIcon,
  readFile: FileCode,
  readMultipleFiles: FileCode,
  searchCode: Search,
  runCommand: TerminalIcon,
  writeFile: FileCode,
  deleteFile: FileCode,
  moveFile: FileCode,
  createDirectory: TerminalIcon,
  fileTree: TerminalIcon,
  findFiles: Search,
  getFileInfo: FileCode,
  gitCommit: GitCommit,
  gitBranch: GitCommit,
  gitStash: GitCommit,
  gitPush: Upload,
  installPackages: Upload,
  runTests: Check,
  webResearch: Search,
  editCode: FileCode,
  getConsoleLogs: TerminalIcon,
  getLintErrors: AlertCircle,
};

export function AIAgentPanel({
  workspaceId,
  messages,
  input,
  setInput,
  handleSend,
  isStreaming,
  favoriteModels,
  selectedModel,
  setSelectedModel,
  expandedTools,
  setExpandedTools,
  handleOpenFile,
  renderTextWithFileLinks,
  onClearHistory,
}: AIAgentPanelProps) {
  const [attachedFiles, setAttachedFiles] = React.useState<
    Array<{ path: string; name: string; content?: string }>
  >([]);
  const [attachedImages, setAttachedImages] = React.useState<AttachedImage[]>(
    []
  );
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);

  // Stable callbacks for input section
  const handleImageUpload = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("image/")) {
          alert("Please select only image files");
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setAttachedImages((prev) => [
            ...prev,
            {
              name: file.name,
              base64: base64.split(",")[1],
              mimeType: file.type,
            },
          ]);
        };
        reader.readAsDataURL(file);
      });

      if (e.target) {
        e.target.value = "";
      }
    },
    []
  );

  const removeAttachedImage = React.useCallback((name: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.name !== name));
  }, []);

  const handleSendWithContext = React.useCallback(() => {
    let messageWithContext = input;
    const hasFiles = attachedFiles.length > 0;
    const hasImages = attachedImages.length > 0;

    if (hasFiles) {
      const filesList = attachedFiles.map((file) => file.path).join(", ");
      messageWithContext = `[Attached files: ${filesList}]\n\n${input}`;
    }

    setAttachedFiles([]);

    if (hasImages) {
      const images = [...attachedImages];
      setAttachedImages([]);
      handleSend(messageWithContext, images);
    } else {
      handleSend(messageWithContext);
    }
  }, [input, attachedFiles, attachedImages, handleSend]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
        e.preventDefault();
        handleSendWithContext();
      }
    },
    [isStreaming, handleSendWithContext]
  );

  // Debounced auto-scroll
  const scrollToBottom = React.useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, []);

  React.useEffect(() => {
    if (autoScroll || isStreaming) {
      requestAnimationFrame(scrollToBottom);
    }
  }, [messages.length, autoScroll, isStreaming, scrollToBottom]);

  const handleScroll = React.useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
      setAutoScroll(isAtBottom);
    }
  }, []);

  // Memoize messages rendering
  const renderedMessages = React.useMemo(
    () =>
      messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          expandedTools={expandedTools}
          setExpandedTools={setExpandedTools}
          renderTextWithFileLinks={renderTextWithFileLinks}
        />
      )),
    [messages, expandedTools, setExpandedTools, renderTextWithFileLinks]
  );

  const hasTextContent = React.useMemo(
    () =>
      messages.some(
        (m) =>
          m.role === "assistant" &&
          m.parts.some((p) => p.type === "text" && (p as any).text)
      ),
    [messages]
  );

  const showProcessing = isStreaming && !hasTextContent;

  // Memoize InputSection props to prevent unnecessary re-renders
  const inputSectionProps = React.useMemo(
    () => ({
      input,
      setInput,
      handleSend,
      isStreaming,
      attachedImages,
      favoriteModels,
      selectedModel,
      setSelectedModel,
      onImageUpload: handleImageUpload,
      onRemoveImage: removeAttachedImage,
      onSendWithContext: handleSendWithContext,
      onKeyDown: handleKeyDown,
    }),
    [
      input,
      setInput,
      handleSend,
      isStreaming,
      attachedImages,
      favoriteModels,
      selectedModel,
      setSelectedModel,
      handleImageUpload,
      removeAttachedImage,
      handleSendWithContext,
      handleKeyDown,
    ]
  );

  // Handle paste for images (isolated effect)
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              setAttachedImages((prev) => [
                ...prev,
                {
                  name: `pasted-image-${Date.now()}.png`,
                  base64: base64.split(",")[1],
                  mimeType: item.type,
                },
              ]);
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []); // Empty deps: only once

  return (
    <div className="w-full h-full shrink-0 bg-zinc-950 flex flex-col shadow-2xl overflow-hidden">
      {/* Header (simple, no heavy logic) */}
      <div className="px-4 py-3 border-b border-zinc-800/30 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium text-zinc-300">AI Agent</span>
        </div>
        {messages.length > 0 && onClearHistory && (
          <button
            onClick={onClearHistory}
            className="h-7 px-2 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            title="Clear chat history"
          >
            <BrushCleaning className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 scrollbar-thin"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="mb-3 text-3xl">⚡</div>
              <p className="text-sm text-zinc-500">
                Agent ready to assist with your tasks
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {renderedMessages}

            {showProcessing && (
              <div className="flex items-center gap-2 text-zinc-600 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            scrollToBottom();
          }}
          className="absolute bottom-20 right-8 bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-300 text-xs px-2 py-1 rounded-md flex items-center gap-1 transition-colors"
        >
          <ChevronDown className="h-3 w-3" />
          Scroll to bottom
        </button>
      )}

      {/* Input Section */}
      <InputSection {...inputSectionProps} />
    </div>
  );
}

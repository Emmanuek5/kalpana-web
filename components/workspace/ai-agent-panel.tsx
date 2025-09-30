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
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { FileMentionPicker } from "./file-mention-picker";

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

const TOOL_ICONS: Record<string, React.ComponentType<any>> = {
  listFiles: TerminalIcon,
  readFile: FileCode,
  searchCode: Search,
  runCommand: TerminalIcon,
  writeFile: FileCode,
  deleteFile: FileCode,
  moveFile: FileCode,
  createDirectory: TerminalIcon,
  fileTree: TerminalIcon,
  gitCommit: GitCommit,
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
  const [showFilePicker, setShowFilePicker] = React.useState(false);
  const [filePickerPosition, setFilePickerPosition] = React.useState({
    top: 0,
    left: 0,
  });
  const [mentionQuery, setMentionQuery] = React.useState("");
  const [attachedFiles, setAttachedFiles] = React.useState<
    Array<{ path: string; name: string; content?: string }>
  >([]);
  const [attachedImages, setAttachedImages] = React.useState<AttachedImage[]>(
    []
  );
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Check if there's any text content to show (not counting tool calls)
  const hasTextContent = messages.some(
    (m) =>
      m.role === "assistant" &&
      m.parts.some((p) => p.type === "text" && (p as any).text)
  );

  // Check if there are completed tool calls
  const hasCompletedTools = messages.some(
    (m) =>
      m.role === "assistant" &&
      m.parts.some(
        (p) => p.type === "tool" && (p as any).state === "output-available"
      )
  );

  // Show processing if streaming and no text yet (even if tools are done)
  const showProcessing = isStreaming && !hasTextContent;

  // Detect @ mentions and show file picker
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Check if user typed @
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const textAfterAt = value.slice(lastAtIndex + 1);
      // Only show picker if @ is at start or after a space, and no space after @
      const beforeAt = value.slice(0, lastAtIndex);
      if (
        (lastAtIndex === 0 || beforeAt.endsWith(" ")) &&
        !textAfterAt.includes(" ")
      ) {
        setMentionQuery(textAfterAt);
        setShowFilePicker(true);

        // Calculate position (show right above input)
        if (inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          setFilePickerPosition({
            top: rect.top - 216, // Show right above input (200px picker + 16px gap)
            left: rect.left + 4,
          });
        }
        return;
      }
    }

    setShowFilePicker(false);
  };

  // Handle file selection from picker
  const handleFileSelect = async (file: {
    path: string;
    name: string;
    type: "file" | "directory";
  }) => {
    if (file.type === "directory") {
      setShowFilePicker(false);
      return;
    }

    // Just add the file path, don't fetch content
    setAttachedFiles((prev) => [...prev, { path: file.path, name: file.name }]);

    // Remove @ mention from input
    const lastAtIndex = input.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      setInput(input.slice(0, lastAtIndex).trim());
    }

    setShowFilePicker(false);
  };

  // Remove attached file
  const removeAttachedFile = (path: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.path !== path));
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            base64: base64.split(",")[1], // Remove data:image/xxx;base64, prefix
            mimeType: file.type,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle paste event for images
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
  }, []);

  // Remove attached image
  const removeAttachedImage = (name: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.name !== name));
  };

  // Enhanced send handler with file and image context
  const handleSendWithContext = () => {
    let messageWithContext = input;
    const hasFiles = attachedFiles.length > 0;
    const hasImages = attachedImages.length > 0;

    if (hasFiles) {
      // Just list the attached files, don't send content - let AI read them if needed
      const filesList = attachedFiles.map((file) => file.path).join(", ");
      messageWithContext = `[Attached files: ${filesList}]\n\n${input}`;
    }

    // Clear attached files and images after sending
    setAttachedFiles([]);

    // If we have images, pass them separately
    if (hasImages) {
      const images = [...attachedImages];
      setAttachedImages([]);
      handleSend(messageWithContext, images);
    } else {
      handleSend(messageWithContext);
    }
  };

  return (
    <div className="w-[500px] shrink-0 border-l border-zinc-900/50 bg-gradient-to-b from-black via-zinc-950 to-black backdrop-blur-2xl flex flex-col shadow-2xl overflow-hidden">
      {/* Agent Header */}
      <div className="px-6 py-4 border-b border-zinc-800/50 shrink-0 bg-zinc-950/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-900/30 flex items-center justify-center">
                <Brain className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-black" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100">
                AI Assistant
              </div>
              <div className="text-xs text-zinc-600">Always ready to help</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {favoriteModels.length > 0 && (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-400 focus:outline-none focus:border-emerald-500/50"
              >
                {favoriteModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}
            {messages.length > 0 && onClearHistory && (
              <Button
                onClick={onClearHistory}
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                title="Clear chat history"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="mb-4 text-4xl text-zinc-800">⚡</div>
              <p className="text-xs text-zinc-600">Agent ready to assist</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="space-y-3">
              {message.role === "user" && (
                <div className="flex justify-end">
                  <div className="bg-emerald-900/20 border border-emerald-900/30 rounded-lg px-4 py-2.5 max-w-[85%]">
                    <p className="text-sm text-zinc-200">
                      {message.parts
                        .filter((p) => p.type === "text")
                        .map((p: any) => p.text)
                        .join("\n")}
                    </p>
                  </div>
                </div>
              )}

              {message.role === "assistant" && (
                <div className="space-y-2">
                  {message.parts.map((part, partIdx) => {
                    // Render text parts
                    if (part.type === "text" && (part as any).text) {
                      const textPart = part as Extract<
                        MessagePart,
                        { type: "text" }
                      >;
                      return (
                        <div key={partIdx} className="text-sm text-zinc-300">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                              p: ({ children }) => (
                                <p className="mb-3 leading-relaxed">
                                  {renderTextWithFileLinks(
                                    children?.toString() || ""
                                  )}
                                </p>
                              ),
                              code: ({ inline, children, ...props }: any) =>
                                inline ? (
                                  <code
                                    className="px-1.5 py-0.5 bg-zinc-800 text-emerald-400 rounded text-xs font-mono"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                ) : (
                                  <code
                                    className="block bg-zinc-900 p-3 rounded my-2 text-xs overflow-x-auto"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                ),
                              pre: ({ children }) => (
                                <pre className="bg-zinc-900 border border-zinc-800 rounded p-3 my-2 overflow-x-auto">
                                  {children}
                                </pre>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc list-inside mb-3 space-y-1">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal list-inside mb-3 space-y-1">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="text-zinc-400">{children}</li>
                              ),
                              h1: ({ children }) => (
                                <h1 className="text-lg font-bold text-zinc-100 mb-2 mt-4">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-base font-semibold text-zinc-100 mb-2 mt-3">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-sm font-semibold text-zinc-200 mb-1 mt-2">
                                  {children}
                                </h3>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-2 border-emerald-500/50 pl-3 py-1 my-2 text-zinc-400 italic">
                                  {children}
                                </blockquote>
                              ),
                            }}
                          >
                            {textPart.text}
                          </ReactMarkdown>
                        </div>
                      );
                    }

                    // Render tool calls with sleek design
                    if (
                      part.type === "tool" &&
                      (part as any).state === "output-available"
                    ) {
                      const toolPart = part as Extract<
                        MessagePart,
                        { type: "tool" }
                      >;
                      const isExpanded = expandedTools.has(toolPart.toolCallId);
                      const IconComponent =
                        TOOL_ICONS[toolPart.toolName] || TerminalIcon;

                      return (
                        <div
                          key={partIdx}
                          className="group relative bg-gradient-to-r from-zinc-900/40 to-zinc-900/20 border border-zinc-800/40 rounded-lg overflow-hidden hover:border-emerald-500/30 transition-all"
                        >
                          <button
                            onClick={() =>
                              setExpandedTools((prev) => {
                                const newSet = new Set(prev);
                                if (newSet.has(toolPart.toolCallId)) {
                                  newSet.delete(toolPart.toolCallId);
                                } else {
                                  newSet.add(toolPart.toolCallId);
                                }
                                return newSet;
                              })
                            }
                            className="w-full px-3 py-2.5 flex items-center gap-3 text-left"
                          >
                            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                              <IconComponent className="h-3.5 w-3.5 text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-zinc-300 block">
                                {toolPart.toolName
                                  .replace(/([A-Z])/g, " $1")
                                  .trim()}
                              </span>
                              {toolPart.input && (
                                <span className="text-[10px] text-zinc-600 truncate block mt-0.5">
                                  {Object.entries(toolPart.input)
                                    .slice(0, 2)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(", ")}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                              )}
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-3 border-t border-zinc-800/30 bg-black/20">
                              {toolPart.input &&
                                Object.keys(toolPart.input).length > 0 && (
                                  <div className="mt-3">
                                    <div className="text-[10px] font-semibold text-emerald-500/70 mb-1.5 tracking-wide">
                                      INPUT
                                    </div>
                                    <div className="text-xs text-zinc-400 bg-zinc-950/50 border border-zinc-800/30 p-2.5 rounded-md overflow-auto max-h-32 font-mono">
                                      {JSON.stringify(toolPart.input, null, 2)}
                                    </div>
                                  </div>
                                )}
                              {toolPart.output && (
                                <div className="mt-3">
                                  <div className="text-[10px] font-semibold text-emerald-500/70 mb-1.5 tracking-wide">
                                    OUTPUT
                                  </div>
                                  <div className="text-xs text-zinc-400 bg-zinc-950/50 border border-zinc-800/30 p-2.5 rounded-md overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                                    {typeof toolPart.output === "string"
                                      ? toolPart.output
                                      : JSON.stringify(
                                          toolPart.output,
                                          null,
                                          2
                                        )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Skip checkpoints (they're redundant with tool displays)
                    // Skip reasoning, sources, and in-progress tools
                    return null;
                  })}
                </div>
              )}
            </div>
          ))
        )}

        {/* Show "Processing..." when streaming but no text yet */}
        {showProcessing && (
          <div className="flex items-center gap-2 text-zinc-600 text-[11px] px-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Processing...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800/50 shrink-0 bg-gradient-to-b from-zinc-950/50 to-zinc-950/80 backdrop-blur-sm">
        {/* Attached Files */}
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file) => (
              <div
                key={file.path}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-950/30 border border-emerald-800/50 rounded-lg text-xs backdrop-blur-sm"
              >
                <FileCode className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-200">{file.name}</span>
                <button
                  onClick={() => removeAttachedFile(file.path)}
                  className="hover:bg-emerald-900/50 rounded p-0.5 transition-colors"
                >
                  <X className="h-3 w-3 text-emerald-400" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Attached Images */}
        {attachedImages.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedImages.map((image) => (
              <div key={image.name} className="relative group inline-block">
                <img
                  src={`data:${image.mimeType};base64,${image.base64}`}
                  alt={image.name}
                  className="h-20 w-20 object-cover rounded-lg border border-blue-800/50"
                />
                <button
                  onClick={() => removeAttachedImage(image.name)}
                  className="absolute -top-2 -right-2 bg-blue-950 hover:bg-blue-900 border border-blue-700 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3 text-blue-300" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[10px] text-blue-200 truncate rounded-b-lg">
                  {image.name}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Textarea with inline buttons */}
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !isStreaming &&
                !showFilePicker
              ) {
                e.preventDefault();
                handleSendWithContext();
              }
            }}
            placeholder="Ask the AI agent anything... (@ for files, Shift+Enter for new line)"
            disabled={isStreaming}
            className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-2xl px-4 py-2.5 pb-12 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed scrollbar-thin"
          />

          {/* Bottom action bar inside textarea */}
          <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between mb-3">
            {/* Left side - Attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className="h-8 px-3 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/50 hover:border-blue-500/50 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group mt-4"
              title="Attach images (or paste)"
            >
              <Paperclip className="h-3.5 w-3.5 text-zinc-400 group-hover:text-blue-400 transition-colors" />
            </button>

            {/* Right side - Send button */}
            <Button
              onClick={handleSendWithContext}
              disabled={!input.trim() || isStreaming}
              size="sm"
              className="h-8 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white border-0 shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isStreaming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* File Mention Picker - Portal to prevent layout shift */}
        {showFilePicker &&
          typeof document !== "undefined" &&
          createPortal(
            <FileMentionPicker
              workspaceId={workspaceId}
              onSelect={handleFileSelect}
              onClose={() => setShowFilePicker(false)}
              position={filePickerPosition}
              searchQuery={mentionQuery}
            />,
            document.body
          )}
      </div>
    </div>
  );
}

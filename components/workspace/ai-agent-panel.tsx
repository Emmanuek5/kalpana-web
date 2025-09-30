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
    <div className="w-full h-full shrink-0 bg-zinc-950 flex flex-col shadow-2xl overflow-hidden">
      {/* Minimalist Header */}
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

      {/* Messages - Centered Single Column */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 scrollbar-thin">
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
            {messages.map((message) => (
              <div key={message.id} className="space-y-3">
                {/* User Messages */}
                {message.role === "user" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-5 w-5 rounded-md bg-zinc-800/50 flex items-center justify-center">
                        <span className="text-[10px] text-zinc-400">You</span>
                      </div>
                    </div>
                    <div className="text-sm text-zinc-200 leading-relaxed">
                      {message.parts
                        .filter((p) => p.type === "text")
                        .map((p: any) => p.text)
                        .join("\n")}
                    </div>
                  </div>
                )}

                {/* Assistant Messages */}
                {message.role === "assistant" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-5 w-5 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <Brain className="h-3 w-3 text-emerald-500" />
                      </div>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        Agent
                      </span>
                    </div>
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
                                      className="px-1.5 py-0.5 bg-zinc-800/50 text-emerald-400 rounded text-xs font-mono"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  ) : (
                                    <code
                                      className="block bg-zinc-900/50 p-3 rounded-lg my-2 text-xs overflow-x-auto border border-zinc-800/30"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  ),
                                pre: ({ children }) => (
                                  <pre className="bg-zinc-900/50 border border-zinc-800/30 rounded-lg p-3 my-2 overflow-x-auto">
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
                                  <blockquote className="border-l-2 border-emerald-500/30 pl-3 py-1 my-2 text-zinc-400 italic">
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

                      // Render tool calls with minimal design
                      if (
                        part.type === "tool" &&
                        (part as any).state === "output-available"
                      ) {
                        const toolPart = part as Extract<
                          MessagePart,
                          { type: "tool" }
                        >;
                        const isExpanded = expandedTools.has(
                          toolPart.toolCallId
                        );
                        const IconComponent =
                          TOOL_ICONS[toolPart.toolName] || TerminalIcon;

                        return (
                          <div
                            key={partIdx}
                            className="group relative bg-zinc-900/30 border border-zinc-800/40 rounded-lg overflow-hidden hover:border-zinc-700/60 transition-colors"
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
                              className="w-full px-3 py-2 flex items-center gap-2.5 text-left"
                            >
                              <div className="h-5 w-5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                <IconComponent className="h-3 w-3 text-emerald-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-zinc-400 block">
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
                                {isExpanded ? (
                                  <ChevronUp className="h-3 w-3 text-zinc-600" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 text-zinc-600" />
                                )}
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="px-3 pb-3 border-t border-zinc-800/30 bg-black/10">
                                {toolPart.input &&
                                  Object.keys(toolPart.input).length > 0 && (
                                    <div className="mt-2">
                                      <div className="text-[10px] font-semibold text-emerald-500/70 mb-1 tracking-wide">
                                        INPUT
                                      </div>
                                      <div className="text-xs text-zinc-400 bg-zinc-950/50 border border-zinc-800/30 p-2 rounded overflow-auto max-h-32 font-mono">
                                        {JSON.stringify(
                                          toolPart.input,
                                          null,
                                          2
                                        )}
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

                      return null;
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Show "Processing..." when streaming but no text yet */}
            {showProcessing && (
              <div className="flex items-center gap-2 text-zinc-600 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area - Modern Style */}
      <div className="p-4 border-t border-zinc-800/30 shrink-0">
        <div className="max-w-3xl mx-auto">
          {/* Attached Files */}
          {attachedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachedFiles.map((file) => (
                <div
                  key={file.path}
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-950/20 border border-emerald-800/30 rounded-md text-xs"
                >
                  <FileCode className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-300">{file.name}</span>
                  <button
                    onClick={() => removeAttachedFile(file.path)}
                    className="hover:bg-emerald-900/30 rounded p-0.5 transition-colors"
                  >
                    <X className="h-2.5 w-2.5 text-emerald-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Attached Images */}
          {attachedImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachedImages.map((image) => (
                <div key={image.name} className="relative group inline-block">
                  <img
                    src={`data:${image.mimeType};base64,${image.base64}`}
                    alt={image.name}
                    className="h-16 w-16 object-cover rounded-lg border border-zinc-700/50"
                  />
                  <button
                    onClick={() => removeAttachedImage(image.name)}
                    className="absolute -top-1.5 -right-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5 text-zinc-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input with integrated controls */}
          <div className="relative bg-zinc-900/50 border border-zinc-800/60 rounded-xl hover:border-zinc-700/80 focus-within:border-emerald-500/40 transition-colors">
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
              rows={1}
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
              placeholder="Ask anything..."
              disabled={isStreaming}
              className="w-full bg-transparent px-4 py-3 pr-32 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed scrollbar-thin"
              style={{ minHeight: "44px", maxHeight: "200px" }}
            />

            {/* Bottom right controls */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              {/* Attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
                className="h-7 w-7 rounded-lg hover:bg-zinc-800/80 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                title="Attach images"
              >
                <Paperclip className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-400" />
              </button>

              {/* Model Selector - Styled like reference */}
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

              {/* Send button */}
              <button
                onClick={handleSendWithContext}
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

          {/* Hint text */}
          <div className="mt-1.5 px-1 text-[10px] text-zinc-600">
            Press Enter to send, Shift+Enter for new line, @ to mention files
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

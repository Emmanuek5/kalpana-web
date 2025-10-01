import React from "react";
import { Loader2, Brain, ChevronDown, BrushCleaning } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { InputSection } from "./input-section";
import { FileMentionAutocomplete, type FileItem, type MentionItem } from "./file-mention-autocomplete";
import type { Message, AttachedImage } from "./types";

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
  
  // File mention state
  const [fileList, setFileList] = React.useState<FileItem[]>([]);
  const [showFileMention, setShowFileMention] = React.useState(false);
  const [fileMentionQuery, setFileMentionQuery] = React.useState("");
  const [fileMentionPosition, setFileMentionPosition] = React.useState({ top: 0, left: 0 });
  const [mentionedItems, setMentionedItems] = React.useState<Array<{
    type: "file" | "function";
    name: string;
    path?: string;
    file?: string;
    fullPath: string;
  }>>([]);
  
  // Codebase index state
  const [codebaseIndex, setCodebaseIndex] = React.useState<any>(null);

  // Fetch file list on mount
  React.useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/files`);
        if (res.ok) {
          const data = await res.json();
          setFileList(data.files || []);
        }
      } catch (error) {
        console.error("Failed to fetch file list:", error);
      }
    };

    fetchFiles();
  }, [workspaceId]);

  // Fetch codebase index on mount
  React.useEffect(() => {
    const fetchIndex = async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/codebase-index`);
        if (res.ok) {
          const data = await res.json();
          setCodebaseIndex(data);
          console.log("📚 Codebase index loaded:", data.stats);
        }
      } catch (error) {
        console.error("Failed to fetch codebase index:", error);
      }
    };

    fetchIndex();
    
    // Refresh index every 5 minutes
    const interval = setInterval(fetchIndex, 300000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  // Detect @ mentions in input
  const handleInputChange = React.useCallback((value: string) => {
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex === -1) {
      setShowFileMention(false);
      return;
    }

    // Check if @ is at start or preceded by whitespace
    const charBefore = lastAtIndex > 0 ? value[lastAtIndex - 1] : " ";
    if (charBefore !== " " && charBefore !== "\n") {
      setShowFileMention(false);
      return;
    }

    // Extract query after @
    const afterAt = value.slice(lastAtIndex + 1);
    const spaceIndex = afterAt.search(/\s/);
    
    // If there's a space after @, close autocomplete
    if (spaceIndex !== -1) {
      setShowFileMention(false);
      return;
    }
    
    const query = afterAt;

    setFileMentionQuery(query);
    setShowFileMention(true);
  }, []);

  // Handle file/function selection from autocomplete
  const handleFileSelect = React.useCallback((item: MentionItem) => {
    const lastAtIndex = input.lastIndexOf("@");
    const beforeAt = input.slice(0, lastAtIndex);
    const afterAt = input.slice(lastAtIndex + 1);
    const spaceIndex = afterAt.search(/\s/);
    const afterQuery = spaceIndex === -1 ? " " : afterAt.slice(spaceIndex);

    const isFile = "path" in item && item.type === "file";
    const isFunction = item.type === "function";
    
    // Keep @mention in the text
    const mentionText = isFile ? item.name : `${item.name}()`;
    const newInput = `${beforeAt}@${mentionText}${afterQuery}`;
    setInput(newInput);
    setShowFileMention(false);
    
    // Track mentioned items for context (not displayed as separate badges)
    const fullPath = isFile ? item.path : `${(item as any).file}:${(item as any).line}`;
    
    setMentionedItems((prev) => [
      ...prev,
      {
        type: isFile ? "file" : "function",
        name: mentionText,
        path: isFile ? item.path : undefined,
        file: isFunction ? (item as any).file : undefined,
        fullPath,
      },
    ]);
  }, [input, setInput]);

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

  const inputRef = React.useRef(input);
  
  // Keep ref in sync with input
  React.useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const handleSendWithContext = React.useCallback(() => {
    const currentInput = inputRef.current;
    
    // Keep @mentions in the text, they'll be styled in the UI
    // Just send the message as-is
    const messageToSend = currentInput;

    setAttachedFiles([]);
    setMentionedItems([]);
    setShowFileMention(false);

    if (attachedImages.length > 0) {
      const images = [...attachedImages];
      setAttachedImages([]);
      handleSend(messageToSend, images);
    } else {
      handleSend(messageToSend);
    }
  }, [attachedFiles, attachedImages, handleSend]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Close file mention on Escape
      if (e.key === "Escape" && showFileMention) {
        e.preventDefault();
        setShowFileMention(false);
        return;
      }
      
      // If file mention is open, don't handle these keys (autocomplete will handle them)
      if (showFileMention && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        // Let autocomplete handle navigation
        return;
      }
      
      // If file mention is open and Enter is pressed, let autocomplete handle it
      if (showFileMention && e.key === "Enter" && !e.shiftKey) {
        // Autocomplete will handle selection
        return;
      }
      
      // Normal Enter to send message
      if (e.key === "Enter" && !e.shiftKey && !isStreaming && !showFileMention) {
        e.preventDefault();
        handleSendWithContext();
      }
    },
    [isStreaming, showFileMention, handleSendWithContext]
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

  // Remove mentioned item
  const handleRemoveMention = React.useCallback((index: number) => {
    setMentionedItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Memoize InputSection props to prevent unnecessary re-renders
  // Note: input is included but InputSection uses local state to avoid re-render lag
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
      showFileMention,
      onInputChange: handleInputChange,
      mentionedItems,
      onRemoveMention: handleRemoveMention,
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
      showFileMention,
      handleInputChange,
      mentionedItems,
      handleRemoveMention,
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

      {/* Input Section with File Mention Autocomplete */}
      <div className="relative">
        {/* File Mention Autocomplete - positioned directly against input top */}
        {showFileMention && fileList.length > 0 && (
          <div className="absolute bottom-full left-6 right-6 z-50">
            <FileMentionAutocomplete
              files={fileList}
              functions={codebaseIndex?.symbols?.functions || []}
              query={fileMentionQuery}
              onSelect={handleFileSelect}
            />
          </div>
        )}

        {/* Input Section */}
        <InputSection {...inputSectionProps} />
      </div>
    </div>
  );
}

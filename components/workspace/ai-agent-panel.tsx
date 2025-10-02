import React from "react";
import { Loader2, Brain, ChevronDown, Plus } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { InputSection } from "./input-section";
import { FileMentionAutocomplete, type FileItem, type MentionItem } from "./file-mention-autocomplete";
import { RestoreCheckpointModal } from "./restore-checkpoint-modal";
import { ChatDropdown, type ChatItem } from "./chat-dropdown";
import type { Message, AttachedImage } from "./types";

interface AIAgentPanelProps {
  workspaceId: string;
  messages: Message[];
  isWorkSpaceRunning: boolean;
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
  onStopGeneration?: () => void;
  // Chat management
  chats: ChatItem[];
  currentChatId: string | null;
  currentChatTitle: string;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
}

export function AIAgentPanel({
  workspaceId,
  messages,
  isWorkSpaceRunning,
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
  onStopGeneration,
  chats,
  currentChatId,
  currentChatTitle,
  onSelectChat,
  onCreateChat,
}: AIAgentPanelProps) {
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
  
  // Checkpoint restore state
  const [restoreModalOpen, setRestoreModalOpen] = React.useState(false);
  const [restoreCheckpointId, setRestoreCheckpointId] = React.useState<string | null>(null);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [restoreError, setRestoreError] = React.useState<string | null>(null);

  // Fetch file list and codebase index on mount
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

    fetchFiles();
    fetchIndex();
    
    // Refresh index every 5 minutes
    const interval = setInterval(fetchIndex, 300000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  // Detect @ mentions in input
  const handleInputChange = React.useCallback((value: string) => {
    setInput(value);
    
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
  }, [setInput]);

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

  const handleSendWithContext = React.useCallback(() => {
    // Keep @mentions in the text, they'll be styled in the UI
    const messageToSend = input;

    setMentionedItems([]);
    setShowFileMention(false);

    if (attachedImages.length > 0) {
      const images = [...attachedImages];
      setAttachedImages([]);
      handleSend(messageToSend, images);
    } else {
      handleSend(messageToSend);
    }
  }, [input, attachedImages, handleSend]);

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

  const scrollToBottom = React.useCallback(
    (smooth: boolean = true) => {
      if (messagesContainerRef.current) {
        const el = messagesContainerRef.current;
        el.scrollTo({
          top: el.scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        });
      }
    },
    []
  );
  
  React.useEffect(() => {
    if (autoScroll) {
      scrollToBottom(false); // jump immediately on new message
    }
  }, [messages.length, autoScroll, scrollToBottom]);


  // Also observe container size (handles streaming text growth)
React.useEffect(() => {
  if (!messagesContainerRef.current) return;

  const el = messagesContainerRef.current;
  const resizeObserver = new ResizeObserver(() => {
    if (autoScroll) scrollToBottom(true);
  });

  resizeObserver.observe(el);

  return () => resizeObserver.disconnect();
}, [autoScroll, scrollToBottom]);


  const handleScroll = React.useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
      setAutoScroll(isAtBottom);
    }
  }, []);



  


  // Remove mentioned item
  const handleRemoveMention = React.useCallback((index: number) => {
    setMentionedItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle restore checkpoint
  const handleRestoreClick = React.useCallback((messageId: string) => {
    setRestoreCheckpointId(messageId);
    setRestoreModalOpen(true);
  }, []);

  // Determine which messages to show based on scroll position
  const visibleMessages = React.useMemo(() => {
    // If user has scrolled up, show all messages
    if (!autoScroll) {
      return messages;
    }
    
    // If at bottom, show only last 2 user-assistant pairs (4 messages total)
    if (messages.length <= 4) {
      return messages;
    }
    
    // Find the last 2 user messages and their corresponding assistant responses
    const userMessages = messages.filter(m => m.role === "user");
    if (userMessages.length === 0) {
      return messages;
    }
    
    // Get last 2 user messages
    const lastUserMessages = userMessages.slice(-2);
    const lastUserIndices = lastUserMessages.map(um => 
      messages.findIndex(m => m.id === um.id)
    );
    
    // Get the earliest index of the last 2 user messages
    const startIndex = Math.min(...lastUserIndices);
    
    // Return messages from that point onwards
    return messages.slice(startIndex);
  }, [messages, autoScroll]);

  // Memoize messages rendering
  const renderedMessages = React.useMemo(
    () =>
      visibleMessages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          expandedTools={expandedTools}
          setExpandedTools={setExpandedTools}
          renderTextWithFileLinks={renderTextWithFileLinks}
          onRestore={handleRestoreClick}
          showRestore={message.role === "user"}
        />
      )),
    [visibleMessages, expandedTools, setExpandedTools, renderTextWithFileLinks, handleRestoreClick]
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

  const handleRestoreConfirm = React.useCallback(async () => {
    if (!restoreCheckpointId) return;
    
    setIsRestoring(true);
    setRestoreError(null);
    
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/checkpoints/${restoreCheckpointId}/restore`,
        { method: 'POST' }
      );
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to restore checkpoint');
      }
      
      // Reload the page to reflect restored state
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to restore checkpoint:', error);
      setRestoreError(error.message || 'Failed to restore checkpoint. Please try again.');
      setIsRestoring(false);
    }
  }, [restoreCheckpointId, workspaceId]);

  const handleRestoreCancel = React.useCallback(() => {
    setRestoreModalOpen(false);
    setRestoreCheckpointId(null);
    setRestoreError(null);
  }, []);

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

  // Get message preview for restore modal
  const restoreMessage = React.useMemo(() => {
    if (!restoreCheckpointId) return null;
    return messages.find(m => m.id === restoreCheckpointId);
  }, [restoreCheckpointId, messages]);

  const restoreMessagePreview = React.useMemo(() => {
    if (!restoreMessage) return "";
    const textPart = restoreMessage.parts.find(p => p.type === "text");
    return (textPart as any)?.text || "No message";
  }, [restoreMessage]);

  return (
    <>
      <div className="w-full h-full shrink-0 bg-zinc-950 flex flex-col shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/30 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Brain className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium text-zinc-300">AI Agent</span>
        </div>
        
        {/* Chat Dropdown - Center */}
        <div className="flex-1 flex justify-center max-w-xs">
          <ChatDropdown
            chats={chats}
            currentChatId={currentChatId}
            currentChatTitle={currentChatTitle}
            onSelectChat={onSelectChat}
            onCreateChat={onCreateChat}
          />
        </div>
        
        {/* New Chat Button - Right */}
        <button
          onClick={onCreateChat}
          className="p-2 hover:bg-zinc-800 rounded-md transition-colors"
          title="New Chat"
        >
          <Plus className="h-4 w-4 text-zinc-400" />
        </button>
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
            {/* Show indicator when older messages are hidden */}
            {autoScroll && visibleMessages.length < messages.length && (
              <div className="flex items-center justify-center py-3">
                <button
                  onClick={() => {
                    setAutoScroll(false);
                    // Scroll to top to show all messages
                    if (messagesContainerRef.current) {
                      messagesContainerRef.current.scrollTop = 0;
                    }
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-zinc-800/50"
                >
                  <ChevronDown className="h-3 w-3 rotate-180" />
                  {messages.length - visibleMessages.length} older message{messages.length - visibleMessages.length !== 1 ? 's' : ''} hidden
                  <span className="text-zinc-600">• Click to view all</span>
                </button>
              </div>
            )}
            
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
        <InputSection
          input={input}
          setInput={setInput}
          isWorkSpaceRunning={isWorkSpaceRunning}
          handleSend={handleSend}
          isStreaming={isStreaming}
          attachedImages={attachedImages}
          favoriteModels={favoriteModels}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          onImageUpload={handleImageUpload}
          onRemoveImage={removeAttachedImage}
          onSendWithContext={handleSendWithContext}
          onKeyDown={handleKeyDown}
          showFileMention={showFileMention}
          onInputChange={handleInputChange}
          mentionedItems={mentionedItems}
          onRemoveMention={handleRemoveMention}
          onStop={onStopGeneration}
        />
      </div>
    </div>
    
    {/* Restore Checkpoint Modal */}
    <RestoreCheckpointModal
      isOpen={restoreModalOpen}
      onClose={handleRestoreCancel}
      onConfirm={handleRestoreConfirm}
      messagePreview={restoreMessagePreview}
      timestamp={restoreMessage?.createdAt || new Date()}
      isRestoring={isRestoring}
      error={restoreError}
    />
  </>
  );
}

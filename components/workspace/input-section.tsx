import React from "react";
import { Loader2, Send, ChevronDown, Paperclip, X, File, Code2, Square } from "lucide-react";

interface AttachedImage {
  name: string;
  mimeType: string;
  base64: string;
}

interface MentionedItem {
  type: "file" | "function";
  name: string;
  fullPath: string;
}

interface InputSectionProps {
  input: string;
  isWorkSpaceRunning: boolean;
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
  showFileMention?: boolean;
  onInputChange?: (value: string) => void;
  mentionedItems?: MentionedItem[];
  onRemoveMention?: (index: number) => void;
  onStop?: () => void;
}

export const InputSection = React.memo((props: InputSectionProps) => {
  const {
    input,
    isWorkSpaceRunning,
    isStreaming,
    attachedImages,
    favoriteModels,
    selectedModel,
    setSelectedModel,
    onImageUpload,
    onRemoveImage,
    onSendWithContext,
    onKeyDown,
    mentionedItems = [],
    onRemoveMention,
    onInputChange,
    onStop,
  } = props;

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const editableRef = React.useRef<HTMLDivElement>(null);
  const isTypingRef = React.useRef(false);
  const placeholder = "Ask anything... (type @ to mention files)";

  const highlightText = (text: string): string => {
    if (!text) return '';
    
    const mentionRegex = /@[^\s]+/g;
    return text.replace(mentionRegex, (match) => {
      return `<span class="bg-sky-500/30 text-sky-300 rounded px-1 py-0.5 font-medium">${match}</span>`;
    });
  };

  const saveCursorPosition = () => {
    const selection = window.getSelection();
    if (!selection || !editableRef.current) return null;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editableRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  };

  const restoreCursorPosition = (position: number) => {
    if (!editableRef.current) return;
    
    const selection = window.getSelection();
    if (!selection) return;

    let currentPos = 0;
    const range = document.createRange();
    range.setStart(editableRef.current, 0);
    range.collapse(true);

    const nodeStack: Node[] = [editableRef.current];
    let node: Node | undefined;
    let foundStart = false;

    while (!foundStart && (node = nodeStack.pop())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0;
        if (currentPos + textLength >= position) {
          range.setStart(node, position - currentPos);
          foundStart = true;
        } else {
          currentPos += textLength;
        }
      } else {
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
          nodeStack.push(node.childNodes[i]);
        }
      }
    }

    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  // Update contenteditable when input changes externally (like after send)
  React.useEffect(() => {
    if (editableRef.current && !isTypingRef.current) {
      const currentText = editableRef.current.textContent || '';
      if (currentText !== input) {
        editableRef.current.textContent = input;
      }
    }
  }, [input]);

  const handleInput = React.useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const value = target.textContent || '';
      
      isTypingRef.current = true;
      
      // Save cursor position before modifying content
      const cursorPos = saveCursorPosition();
      
      // Apply highlighting in real-time
      const highlighted = highlightText(value);
      if (target.innerHTML !== highlighted) {
        target.innerHTML = highlighted;
        
        // Restore cursor position after highlighting
        if (cursorPos !== null) {
          restoreCursorPosition(cursorPos);
        }
      }
      
      // Notify parent of input change immediately for @ detection
      if (onInputChange) {
        onInputChange(value);
      }
    },
    [onInputChange]
  );

  const handleBlur = React.useCallback(() => {
    // Apply highlighting when user stops typing
    if (editableRef.current) {
      const cursorPos = saveCursorPosition();
      const value = editableRef.current.textContent || '';
      editableRef.current.innerHTML = highlightText(value);
      if (cursorPos !== null) {
        restoreCursorPosition(cursorPos);
      }
    }
    isTypingRef.current = false;
  }, []);

  const handleFocus = React.useCallback(() => {
    isTypingRef.current = true;
  }, []);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Convert div keyboard event to textarea-like event for compatibility
      const syntheticEvent = {
        ...e,
        currentTarget: {
          ...e.currentTarget,
          value: e.currentTarget.textContent || '',
        },
      } as any;
      onKeyDown(syntheticEvent);
    },
    [onKeyDown]
  );

  return (
    <div className="px-3 pt-3 pb-4">
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl hover:border-zinc-700/80 focus-within:border-emerald-500/40 transition-colors flex flex-col">
        <div className="flex flex-col">
          <div className="relative">
            <div
              ref={editableRef}
              contentEditable={!isStreaming}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onFocus={handleFocus}
              data-placeholder={placeholder}
              suppressContentEditableWarning
              className="w-full bg-transparent px-4 pt-4 pb-3 text-sm text-zinc-100 selection:bg-emerald-500/30 focus:outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed scrollbar-thin mention-input overflow-y-auto"
              style={{
                minHeight: "72px",
                maxHeight: "200px",
              }}
            />
          </div>

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
                    className="h-7 rounded-2xl pl-2 pr-6 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/50 text-[11px] text-zinc-400 font-medium appearance-none focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
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

            {isStreaming && onStop ? (
              <button
                onClick={onStop}
                className="h-7 w-7 bg-red-600/90 hover:bg-red-600 rounded-lg flex items-center justify-center transition-colors"
                title="Stop generation"
              >
                <Square className="h-3 w-3 text-white fill-white" />
              </button>
            ) : (
              <button
                onClick={onSendWithContext}
                disabled={!input.trim() || isStreaming || !isWorkSpaceRunning}
                className="h-7 w-7 bg-emerald-600/90 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:opacity-50 rounded-lg flex items-center justify-center transition-colors disabled:cursor-not-allowed"
              >
                {isStreaming ? (
                  <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 text-white" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Attached Images Preview */}
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
});

InputSection.displayName = "InputSection";
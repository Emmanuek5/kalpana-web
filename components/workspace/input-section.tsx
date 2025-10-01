import React from "react";
import { Loader2, Send, ChevronDown, Paperclip, X, File, Code2 } from "lucide-react";
import type { AttachedImage } from "./types";

export type { AttachedImage } from "./types";

interface MentionedItem {
  type: "file" | "function";
  name: string;
  fullPath: string;
}

interface InputSectionProps {
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
  showFileMention?: boolean;
  onInputChange?: (value: string) => void;
  mentionedItems?: MentionedItem[];
  onRemoveMention?: (index: number) => void;
}

export const InputSection = React.memo((props: InputSectionProps) => {
  const {
    input,
    setInput,
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
  } = props;

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = React.useState(input);

  // Sync local value when input prop changes (e.g., after send)
  React.useEffect(() => {
    setLocalValue(input);
    if (textareaRef.current) {
      textareaRef.current.value = input;
    }
  }, [input]);

  // Debounced state update to parent
  const debouncedSetInput = React.useMemo(
    () => {
      let timeoutId: NodeJS.Timeout;
      return (value: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => setInput(value), 150);
      };
    },
    [setInput]
  );

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setLocalValue(value);
      debouncedSetInput(value);
      
      // Notify parent of input change for @ detection
      if (props.onInputChange) {
        props.onInputChange(value);
      }
    },
    [debouncedSetInput, props]
  );

  // Render highlighted content overlay
  const renderHighlightedContent = () => {
    if (!localValue) return null;
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const mentionRegex = /@([\w\-./()]+)/g;
    let match;

    while ((match = mentionRegex.exec(localValue)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`} className="text-transparent">
            {localValue.slice(lastIndex, match.index)}
          </span>
        );
      }

      // Add highlighted mention
      const isFunction = match[1].includes("()");
      parts.push(
        <span
          key={`mention-${match.index}`}
          className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded text-[11px] text-emerald-400 font-mono"
        >
          {isFunction ? (
            <Code2 className="h-2.5 w-2.5" />
          ) : (
            <File className="h-2.5 w-2.5" />
          )}
          {match[1]}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < localValue.length) {
      parts.push(
        <span key={`text-${lastIndex}`} className="text-transparent">
          {localValue.slice(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  return (
    <div className="px-3 pt-3 pb-4">
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl hover:border-zinc-700/80 focus-within:border-emerald-500/40 transition-colors flex flex-col">
        <div className="flex flex-col">
          <div className="relative">
            {/* Highlighted overlay */}
            <div
              className="absolute inset-0 px-4 pt-4 pb-3 text-sm pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
              style={{ minHeight: "72px", maxHeight: "200px" }}
            >
              {renderHighlightedContent()}
            </div>
            
            {/* Actual textarea (text is transparent where mentions are) */}
            <textarea
              ref={textareaRef}
              rows={2}
              defaultValue={input}
              onChange={handleChange}
              onKeyDown={onKeyDown}
              placeholder="Ask anything... (type @ to mention files)"
              disabled={isStreaming}
              className="relative w-full bg-transparent px-4 pt-4 pb-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed scrollbar-thin"
              style={{ 
                minHeight: "72px", 
                maxHeight: "200px",
                caretColor: "#10b981"
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

import React from "react";
import { File, Code2 } from "lucide-react";

interface MentionedItem {
  type: "file" | "function";
  name: string;
  fullPath: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  mentionedItems: MentionedItem[];
  onRemoveMention: (index: number) => void;
}

export const MentionInput = React.memo((props: MentionInputProps) => {
  const {
    value,
    onChange,
    onKeyDown,
    placeholder = "Ask anything...",
    disabled = false,
    mentionedItems,
    onRemoveMention,
  } = props;

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Render value with inline badges for @mentions
  const renderContent = () => {
    if (!value && !mentionedItems.length) {
      return <span className="text-zinc-600">{placeholder}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Find all @mentions in the text
    const mentionRegex = /@([\w\-./()]+)/g;
    let match;
    let mentionIndex = 0;

    while ((match = mentionRegex.exec(value)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {value.slice(lastIndex, match.index)}
          </span>
        );
      }

      // Find corresponding mentioned item
      const mentionText = match[1];
      const item = mentionedItems[mentionIndex];

      if (item) {
        // Add badge
        parts.push(
          <span
            key={`mention-${mentionIndex}`}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded text-[11px] text-emerald-400 font-mono"
            contentEditable={false}
          >
            {item.type === "function" ? (
              <Code2 className="h-2.5 w-2.5" />
            ) : (
              <File className="h-2.5 w-2.5" />
            )}
            {item.name}
            <button
              onClick={(e) => {
                e.preventDefault();
                onRemoveMention(mentionIndex);
              }}
              className="ml-0.5 hover:text-emerald-300"
              contentEditable={false}
            >
              ×
            </button>
          </span>
        );
        mentionIndex++;
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push(<span key={`text-${lastIndex}`}>{value.slice(lastIndex)}</span>);
    }

    return parts;
  };

  return (
    <div className="relative">
      {/* Hidden textarea for actual input */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        rows={2}
        className="w-full bg-transparent px-4 pt-4 pb-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed scrollbar-thin"
        style={{ minHeight: "72px", maxHeight: "200px" }}
      />

      {/* Overlay with styled mentions (positioned on top) */}
      {mentionedItems.length > 0 && (
        <div
          className="absolute inset-0 px-4 pt-4 pb-3 text-sm text-zinc-100 pointer-events-none whitespace-pre-wrap break-words"
          style={{ minHeight: "72px", maxHeight: "200px", overflow: "hidden" }}
        >
          {renderContent()}
        </div>
      )}
    </div>
  );
});

MentionInput.displayName = "MentionInput";

import React from "react";
import Fuse from "fuse.js";
import { File, Folder, ChevronRight, Code2 } from "lucide-react";

export interface FileItem {
  path: string;
  name: string;
  type: "file" | "directory";
}

export interface FunctionItem {
  name: string;
  file: string;
  line: number;
  type: "function";
}

export type MentionItem = FileItem | FunctionItem;

interface FileMentionAutocompleteProps {
  files: FileItem[];
  functions?: FunctionItem[];
  query: string;
  onSelect: (item: MentionItem) => void;
  position?: { top: number; left: number };
}

export const FileMentionAutocomplete = React.memo(
  ({ files, functions = [], query, onSelect }: FileMentionAutocompleteProps) => {
    const [selectedIndex, setSelectedIndex] = React.useState(0);

    // Combine files and functions for search
    const allItems: MentionItem[] = React.useMemo(() => {
      const fileItems = files.filter((f) => f.type === "file");
      const funcItems = functions.map((f) => ({ ...f, type: "function" as const }));
      return [...fileItems, ...funcItems];
    }, [files, functions]);

    // Fuzzy search with fuse.js
    const fuse = React.useMemo(
      () =>
        new Fuse(allItems, {
          keys: [
            { name: "name", weight: 2 },
            { name: "path", weight: 1 },
            { name: "file", weight: 1 },
          ],
          threshold: 0.4,
          includeScore: true,
        }),
      [allItems]
    );

    const results = React.useMemo(() => {
      if (!query) {
        return allItems.slice(0, 15);
      }
      return fuse
        .search(query)
        .map((result) => result.item)
        .slice(0, 15);
    }, [query, fuse, allItems]);

    // Handle keyboard navigation - only when visible
    React.useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Only handle if target is textarea
        const target = e.target as HTMLElement;
        if (target.tagName !== "TEXTAREA") return;

        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter" && results[selectedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(results[selectedIndex]);
        }
      };

      window.addEventListener("keydown", handleKeyDown, true);
      return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [results, selectedIndex, onSelect]);

    // Reset selected index when results change
    React.useEffect(() => {
      setSelectedIndex(0);
    }, [results]);

    if (results.length === 0) {
      return (
        <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-md shadow-2xl p-2">
          <p className="text-[11px] text-zinc-500">No matches found</p>
        </div>
      );
    }

    return (
      <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/50 rounded-md shadow-2xl overflow-hidden max-h-[280px] overflow-y-auto scrollbar-thin">
        {results.map((item, index) => {
          const isFile = "path" in item && item.type === "file";
          const isFunction = item.type === "function";
          
          const key = isFile 
            ? (item as FileItem).path 
            : `${(item as FunctionItem).file}:${item.name}`;
          
          const subtitle = isFile 
            ? (item as FileItem).path 
            : `${(item as FunctionItem).file}:${(item as FunctionItem).line}`;
          
          return (
            <button
              key={key}
              onClick={() => onSelect(item)}
              className={`w-full px-2 py-1.5 flex items-center gap-2 text-left transition-all ${
                index === selectedIndex
                  ? "bg-emerald-500/15 border-l-2 border-emerald-500"
                  : "hover:bg-zinc-800/50"
              }`}
            >
              {isFile ? (
                <File className="h-3 w-3 text-zinc-500 shrink-0" />
              ) : (
                <Code2 className="h-3 w-3 text-purple-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-zinc-200 truncate">
                  {item.name}
                </div>
                <div className="text-[10px] text-zinc-600 truncate">
                  {subtitle}
                </div>
              </div>
              {index === selectedIndex && (
                <ChevronRight className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
              )}
            </button>
          );
        })}
        <div className="px-2 py-1 bg-zinc-950/50 border-t border-zinc-800/50">
          <p className="text-[9px] text-zinc-600 font-mono">
            ↑↓ navigate • ⏎ select • esc cancel
          </p>
        </div>
      </div>
    );
  }
);

FileMentionAutocomplete.displayName = "FileMentionAutocomplete";

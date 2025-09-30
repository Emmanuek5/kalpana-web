"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { FileCode, Search, Folder, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileItem {
  path: string;
  name: string;
  type: "file" | "directory";
}

interface FileMentionPickerProps {
  workspaceId: string;
  onSelect: (file: FileItem) => void;
  onClose: () => void;
  position: { top: number; left: number };
  searchQuery: string;
}

export function FileMentionPicker({
  workspaceId,
  onSelect,
  onClose,
  position,
  searchQuery,
}: FileMentionPickerProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch all files from workspace
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true);
        // We'll use the listFiles tool through the agent bridge
        // For now, let's create a new API endpoint to get all files
        const response = await fetch(`/api/workspaces/${workspaceId}/files`);
        if (response.ok) {
          const data = await response.json();
          setFiles(data.files || []);
        }
      } catch (error) {
        console.error("Error fetching files:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [workspaceId]);

  // Fuzzy search files
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;

    const query = searchQuery.toLowerCase();
    return files
      .filter((file) => {
        const path = file.path.toLowerCase();
        const name = file.name.toLowerCase();

        // Simple fuzzy match: check if all characters appear in order
        let queryIndex = 0;
        for (let i = 0; i < path.length && queryIndex < query.length; i++) {
          if (path[i] === query[queryIndex]) {
            queryIndex++;
          }
        }

        return (
          queryIndex === query.length ||
          name.includes(query) ||
          path.includes(query)
        );
      })
      .slice(0, 10); // Limit to 10 results
  }, [files, searchQuery]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredFiles.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredFiles[selectedIndex]) {
          onSelect(filteredFiles[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredFiles, selectedIndex, onSelect, onClose]);

  // Reset selected index when filtered files change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = containerRef.current?.children[selectedIndex];
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-[420px] max-h-[200px] overflow-y-auto bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/50 rounded-md shadow-xl"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {/* Compact file list */}
      <div>
        {loading ? (
          <div className="px-3 py-4 text-center text-zinc-500 text-xs">
            <div className="animate-pulse">Loading...</div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="px-3 py-4 text-center text-zinc-500 text-xs">
            No files found
          </div>
        ) : (
          filteredFiles.map((file, index) => (
            <button
              key={file.path}
              onClick={() => onSelect(file)}
              className={cn(
                "w-full px-3 py-1.5 text-left flex items-center gap-2 transition-colors",
                "hover:bg-emerald-950/30",
                selectedIndex === index &&
                  "bg-emerald-950/40 border-l-2 border-emerald-500"
              )}
            >
              {file.type === "directory" ? (
                <Folder className="h-3 w-3 text-blue-400 flex-shrink-0" />
              ) : (
                <FileCode className="h-3 w-3 text-emerald-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-200 truncate font-medium">
                  {file.name}
                </div>
                <div className="text-[10px] text-zinc-600 truncate">
                  {file.path}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

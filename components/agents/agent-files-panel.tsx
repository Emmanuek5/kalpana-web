"use client";

import { Badge } from "@/components/ui/badge";
import { FileCode } from "lucide-react";
import { useState } from "react";

interface EditedFile {
  path: string;
  operation: "created" | "modified" | "deleted";
  timestamp: string;
  diff?: string;
}

interface AgentFilesPanelProps {
  files: EditedFile[];
}

export function AgentFilesPanel({ files }: AgentFilesPanelProps) {
  const [selectedFile, setSelectedFile] = useState<EditedFile | null>(
    files[0] || null
  );

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <FileCode className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
          <p className="text-sm">No files edited yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            Changes will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* File List */}
      <div className="w-64 border-r border-zinc-800/50 bg-zinc-900/20 overflow-y-auto">
        {files.map((file, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedFile(file)}
            className={`w-full text-left px-4 py-3 text-sm border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-all duration-200 ${
              selectedFile?.path === file.path
                ? "bg-zinc-800/50 text-emerald-400 border-l-2 border-l-emerald-500"
                : "text-zinc-400 border-l-2 border-l-transparent"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full shrink-0 ${
                  file.operation === "created"
                    ? "bg-emerald-500 animate-pulse"
                    : file.operation === "deleted"
                    ? "bg-red-500"
                    : "bg-blue-500"
                }`}
              />
              <FileCode className="h-4 w-4 shrink-0" />
              <span className="truncate text-xs">{file.path}</span>
            </div>
            <div className="text-[10px] text-zinc-600 mt-1 ml-6">
              {file.operation === "created"
                ? "+ Created"
                : file.operation === "deleted"
                ? "- Deleted"
                : "~ Modified"}
            </div>
          </button>
        ))}
      </div>

      {/* Diff Display */}
      <div className="flex-1 overflow-y-auto bg-zinc-950/50">
        {selectedFile && (
          <div className="p-4">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium text-zinc-300 font-mono">
                  {selectedFile.path}
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Badge
                  className={`${
                    selectedFile.operation === "created"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : selectedFile.operation === "deleted"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  } text-xs px-2 py-0.5`}
                >
                  {selectedFile.operation === "created"
                    ? "+ Created"
                    : selectedFile.operation === "deleted"
                    ? "- Deleted"
                    : "~ Modified"}
                </Badge>
                <span className="text-zinc-600">
                  {new Date(selectedFile.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
              {selectedFile.diff ? (
                <div className="font-mono text-xs">
                  {selectedFile.diff.split("\n").map((line, idx) => {
                    const isAddition = line.startsWith("+ ");
                    const isDeletion = line.startsWith("- ");

                    return (
                      <div
                        key={idx}
                        className={`px-4 py-0.5 ${
                          isAddition
                            ? "bg-emerald-500/10 text-emerald-300"
                            : isDeletion
                            ? "bg-red-500/10 text-red-300"
                            : "text-zinc-400"
                        }`}
                      >
                        <span className="select-none text-zinc-600 mr-2 inline-block w-8 text-right">
                          {idx + 1}
                        </span>
                        <span className="select-none mr-1 text-zinc-600">
                          {isAddition ? "+" : isDeletion ? "-" : " "}
                        </span>
                        {line.substring(2) || " "}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-xs text-zinc-500 text-center">
                  No diff available
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

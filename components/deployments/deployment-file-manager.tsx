"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Loader2,
  Save,
  X,
  RefreshCw,
  FileText,
} from "lucide-react";

interface DeploymentFileManagerProps {
  deploymentId: string;
  deploymentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FileNode {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: FileNode[];
  expanded?: boolean;
}

export function DeploymentFileManager({
  deploymentId,
  deploymentName,
  open,
  onOpenChange,
}: DeploymentFileManagerProps) {
  const [currentPath, setCurrentPath] = useState("/");
  const [files, setFiles] = useState<string[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    if (open) {
      loadDirectory(currentPath);
    }
  }, [open, currentPath]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/deployments/${deploymentId}/files?path=${encodeURIComponent(
          path
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
        setDirectories(data.directories || []);
      } else {
        console.error("Failed to load directory");
      }
    } catch (error) {
      console.error("Error loading directory:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadFile = async (filePath: string) => {
    setLoadingFile(true);
    setSelectedFile(filePath);
    try {
      const res = await fetch(`/api/deployments/${deploymentId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "read",
          path: filePath,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content);
        setEditedContent(data.content);
      } else {
        const error = await res.json();
        alert(`Failed to read file: ${error.error}`);
        setSelectedFile(null);
      }
    } catch (error) {
      console.error("Error reading file:", error);
      alert("Failed to read file");
      setSelectedFile(null);
    } finally {
      setLoadingFile(false);
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/deployments/${deploymentId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "write",
          path: selectedFile,
          content: editedContent,
        }),
      });

      if (res.ok) {
        setFileContent(editedContent);
        alert("File saved successfully!");
      } else {
        const error = await res.json();
        alert(`Failed to save file: ${error.error}`);
      }
    } catch (error) {
      console.error("Error saving file:", error);
      alert("Failed to save file");
    } finally {
      setSaving(false);
    }
  };

  const navigateToDirectory = (dirName: string) => {
    const newPath =
      currentPath === "/" ? `/${dirName}` : `${currentPath}/${dirName}`;
    setCurrentPath(newPath);
    setSelectedFile(null);
  };

  const navigateUp = () => {
    if (currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length === 0 ? "/" : `/${parts.join("/")}`);
    setSelectedFile(null);
  };

  const closeFileEditor = () => {
    if (editedContent !== fileContent) {
      if (
        !confirm("You have unsaved changes. Are you sure you want to close?")
      ) {
        return;
      }
    }
    setSelectedFile(null);
    setFileContent("");
    setEditedContent("");
  };

  const hasUnsavedChanges = editedContent !== fileContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-7xl h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-emerald-400" />
            File Manager - {deploymentName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* File Browser */}
          <div className="w-1/3 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
            <div className="bg-zinc-900 border-b border-zinc-800 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={navigateUp}
                  disabled={currentPath === "/" || loading}
                  className="text-zinc-400 hover:text-zinc-100"
                >
                  ←
                </Button>
                <span className="text-sm text-zinc-400 truncate">
                  {currentPath}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => loadDirectory(currentPath)}
                disabled={loading}
                className="text-zinc-400 hover:text-zinc-100"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Directories */}
                  {directories.map((dir) => (
                    <button
                      key={dir}
                      onClick={() => navigateToDirectory(dir)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-zinc-800 text-left text-sm"
                    >
                      <Folder className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <span className="truncate">{dir}</span>
                    </button>
                  ))}

                  {/* Files */}
                  {files.map((file) => {
                    const filePath =
                      currentPath === "/"
                        ? `/${file}`
                        : `${currentPath}/${file}`;
                    const isSelected = selectedFile === filePath;

                    return (
                      <button
                        key={file}
                        onClick={() => loadFile(filePath)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-sm ${
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "hover:bg-zinc-800"
                        }`}
                      >
                        <File className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                        <span className="truncate">{file}</span>
                      </button>
                    );
                  })}

                  {directories.length === 0 && files.length === 0 && (
                    <div className="text-center py-8 text-zinc-600 text-sm">
                      Empty directory
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* File Editor */}
          <div className="flex-1 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
            {selectedFile ? (
              <>
                <div className="bg-zinc-900 border-b border-zinc-800 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-zinc-300 truncate">
                      {selectedFile}
                    </span>
                    {hasUnsavedChanges && (
                      <span className="text-xs text-amber-400">●</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={saveFile}
                      disabled={saving || !hasUnsavedChanges}
                      className="bg-emerald-600 hover:bg-emerald-500"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={closeFileEditor}
                      className="text-zinc-400 hover:text-zinc-100"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {loadingFile ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
                  </div>
                ) : (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="flex-1 bg-black text-zinc-300 font-mono text-sm p-4 resize-none focus:outline-none"
                    spellCheck={false}
                  />
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-600">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a file to view and edit</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-zinc-600 mt-2">
          Browse and edit files in your deployment container
        </p>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Folder,
  File,
  Loader2,
  Save,
  X,
  RefreshCw,
  FileText,
  ChevronLeft,
  Trash2,
  Image as ImageIcon,
  FileCode,
  FileJson,
  FileType,
} from "lucide-react";

interface DeploymentFileManagerInlineProps {
  deploymentId: string;
  deploymentName: string;
}

export function DeploymentFileManagerInline({
  deploymentId,
  deploymentName,
}: DeploymentFileManagerInlineProps) {
  const [currentPath, setCurrentPath] = useState("/");
  const [files, setFiles] = useState<string[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadDirectory(currentPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

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

  const deleteFile = async () => {
    if (!selectedFile) return;

    if (
      !confirm(
        `Are you sure you want to delete "${selectedFile}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/deployments/${deploymentId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          path: selectedFile,
        }),
      });

      if (res.ok) {
        alert("File deleted successfully!");
        setSelectedFile(null);
        setFileContent("");
        setEditedContent("");
        // Reload directory to refresh file list
        loadDirectory(currentPath);
      } else {
        const error = await res.json();
        alert(`Failed to delete file: ${error.error}`);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Failed to delete file");
    } finally {
      setDeleting(false);
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

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (
      ["jpg", "jpeg", "png", "gif", "svg", "webp", "ico"].includes(ext || "")
    ) {
      return <ImageIcon className="h-4 w-4 text-purple-400 flex-shrink-0" />;
    }
    if (
      ["js", "jsx", "ts", "tsx", "py", "java", "cpp", "c", "go", "rs"].includes(
        ext || ""
      )
    ) {
      return <FileCode className="h-4 w-4 text-green-400 flex-shrink-0" />;
    }
    if (["json", "yaml", "yml", "toml"].includes(ext || "")) {
      return <FileJson className="h-4 w-4 text-yellow-400 flex-shrink-0" />;
    }
    if (["md", "txt", "log"].includes(ext || "")) {
      return <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />;
    }
    return <File className="h-4 w-4 text-zinc-400 flex-shrink-0" />;
  };

  const isImageFile = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "svg", "webp", "ico"].includes(
      ext || ""
    );
  };

  const isBinaryFile = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    return [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "ico",
      "pdf",
      "zip",
      "tar",
      "gz",
      "exe",
      "dll",
      "so",
      "bin",
    ].includes(ext || "");
  };

  const hasUnsavedChanges = editedContent !== fileContent;
  const selectedFileName = selectedFile?.split("/").pop() || "";
  const isImage = selectedFile ? isImageFile(selectedFileName) : false;
  const isBinary = selectedFile ? isBinaryFile(selectedFileName) : false;

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-4">
          <Folder className="h-5 w-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-zinc-100">
            File Manager - {deploymentName}
          </h3>
        </div>

        <div className="flex gap-4 h-[600px]">
          {/* File Browser */}
          <div className="w-1/3 border border-zinc-800 rounded-lg overflow-hidden flex flex-col bg-zinc-950/50">
            <div className="bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={navigateUp}
                  disabled={currentPath === "/" || loading}
                  className="text-zinc-400 hover:text-zinc-100 h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-zinc-400 truncate font-mono">
                  {currentPath}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => loadDirectory(currentPath)}
                disabled={loading}
                className="text-zinc-400 hover:text-zinc-100 h-8 w-8 p-0"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-0.5">
                  {/* Directories */}
                  {directories.map((dir) => (
                    <button
                      key={dir}
                      onClick={() => navigateToDirectory(dir)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800/50 text-left text-sm transition-colors group"
                    >
                      <Folder className="h-4 w-4 text-blue-400 flex-shrink-0 group-hover:text-blue-300" />
                      <span className="truncate text-zinc-300 text-xs">
                        {dir}
                      </span>
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
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-all ${
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-300 shadow-sm shadow-emerald-500/10"
                            : "hover:bg-zinc-800/50 text-zinc-300"
                        }`}
                      >
                        {getFileIcon(file)}
                        <span className="truncate text-xs">{file}</span>
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

          {/* File Editor/Viewer */}
          <div className="flex-1 border border-zinc-800 rounded-lg overflow-hidden flex flex-col bg-zinc-950/50">
            {selectedFile ? (
              <>
                <div className="bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getFileIcon(selectedFileName)}
                    <span className="text-xs text-zinc-300 truncate font-mono">
                      {selectedFileName}
                    </span>
                    {hasUnsavedChanges && !isImage && (
                      <span className="text-xs text-amber-400 font-bold px-2 py-0.5 bg-amber-500/10 rounded">
                        Modified
                      </span>
                    )}
                    {isImage && (
                      <span className="text-xs text-purple-400 font-bold px-2 py-0.5 bg-purple-500/10 rounded">
                        Image
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isImage && !isBinary && (
                      <Button
                        size="sm"
                        onClick={saveFile}
                        disabled={saving || !hasUnsavedChanges}
                        className="bg-emerald-600 hover:bg-emerald-500 h-8 text-xs"
                      >
                        {saving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={deleteFile}
                      disabled={deleting}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-xs"
                    >
                      {deleting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={closeFileEditor}
                      className="text-zinc-400 hover:text-zinc-100 h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {loadingFile ? (
                  <div className="flex-1 flex items-center justify-center bg-black/30">
                    <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
                  </div>
                ) : isImage ? (
                  <div className="flex-1 overflow-auto bg-gradient-to-br from-zinc-950 to-black p-8">
                    <div className="flex flex-col items-center justify-center min-h-full">
                      <div className="bg-zinc-900/50 backdrop-blur-sm rounded-lg p-6 border border-zinc-800/50 shadow-2xl max-w-2xl">
                        <div className="text-center mb-4">
                          <ImageIcon className="h-12 w-12 text-purple-400 mx-auto mb-3" />
                          <p className="text-zinc-300 text-sm font-mono mb-1">
                            {selectedFileName}
                          </p>
                          <p className="text-zinc-500 text-xs">
                            Image file detected
                          </p>
                        </div>
                        <div className="bg-zinc-950/50 rounded-lg p-4 border border-zinc-800/30">
                          <p className="text-zinc-400 text-xs text-center">
                            📷 Image preview coming soon
                          </p>
                          <p className="text-zinc-600 text-xs text-center mt-2">
                            File size: {fileContent.length} bytes
                          </p>
                        </div>
                        <div className="text-center text-xs text-zinc-600 mt-4">
                          <p>
                            Supported formats: JPG, PNG, GIF, SVG, WebP, ICO
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : isBinary ? (
                  <div className="flex-1 flex items-center justify-center bg-black/30 text-zinc-500">
                    <div className="text-center">
                      <FileType className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Binary file</p>
                      <p className="text-xs text-zinc-600 mt-2">
                        Cannot display binary content
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col bg-black/30">
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="flex-1 bg-transparent text-zinc-300 font-mono text-xs leading-relaxed p-4 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-inset"
                      spellCheck={false}
                      placeholder="File content will appear here..."
                      style={{
                        tabSize: 2,
                        WebkitFontSmoothing: "antialiased",
                        MozOsxFontSmoothing: "grayscale",
                      }}
                    />
                    {/* Line count indicator */}
                    <div className="border-t border-zinc-800 bg-zinc-900/50 px-4 py-2 flex items-center justify-between text-xs text-zinc-500">
                      <span>
                        {editedContent.split("\n").length} lines ·{" "}
                        {editedContent.length} characters
                      </span>
                      {hasUnsavedChanges && (
                        <span className="text-amber-400">Unsaved changes</span>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-black/30 text-zinc-600">
                <div className="text-center">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-sm font-medium">
                    Select a file to view and edit
                  </p>
                  <p className="text-xs text-zinc-700 mt-2">
                    Click on any file from the left panel
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-zinc-600">
            💡 Browse and edit files directly in your deployment container
          </p>
          <div className="flex items-center gap-3 text-xs text-zinc-600">
            <div className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3 text-purple-400" />
              <span>Images</span>
            </div>
            <div className="flex items-center gap-1">
              <FileCode className="h-3 w-3 text-green-400" />
              <span>Code</span>
            </div>
            <div className="flex items-center gap-1">
              <Folder className="h-3 w-3 text-blue-400" />
              <span>Folders</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  FolderOpen,
  Plus,
  Play,
  Square,
  Trash2,
  Copy,
  Check,
  Upload,
  Download,
  Eye,
  EyeOff,
  ChevronDown,
  Loader2,
  HardDrive,
  File,
  Folder,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Bucket {
  id: string;
  name: string;
  description?: string;
  status: string;
  host: string;
  port: number;
  consolePort?: number;
  accessKey: string;
  secretKey: string;
  region: string;
  versioning: boolean;
  encryption: boolean;
  publicAccess: boolean;
  maxSizeGB?: number;
  objectCount: number;
  totalSizeBytes: bigint;
  endpoint: string;
  consoleEndpoint?: string;
  workspaceId?: string;
}

interface BucketObject {
  key: string;
  size: bigint;
  contentType?: string;
  etag?: string;
  lastModified: Date;
  isPublic: boolean;
}

interface BucketsPanelProps {
  workspaceId: string;
}

export function BucketsPanel({ workspaceId }: BucketsPanelProps) {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>("");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copiedStrings, setCopiedStrings] = useState<Record<string, boolean>>({});
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState<Record<string, boolean>>({});
  const [stopping, setStopping] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [uploadingTo, setUploadingTo] = useState<string | null>(null);
  const [bucketObjects, setBucketObjects] = useState<Record<string, BucketObject[]>>({});
  const [loadingObjects, setLoadingObjects] = useState<Record<string, boolean>>({});

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    versioning: false,
    encryption: false,
    publicAccess: false,
    maxSizeGB: "",
  });

  // Load buckets
  const loadBuckets = async () => {
    try {
      const response = await fetch(`/api/buckets?workspaceId=${workspaceId}`);
      if (!response.ok) throw new Error("Failed to load buckets");
      const data = await response.json();
      setBuckets(data.buckets || []);
    } catch (error: any) {
      console.error("Error loading buckets:", error);
      toast.error("Failed to load buckets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuckets();
    const interval = setInterval(loadBuckets, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [workspaceId]);

  // Load objects for a bucket
  const loadObjects = async (bucketId: string) => {
    setLoadingObjects((prev) => ({ ...prev, [bucketId]: true }));
    try {
      const response = await fetch(`/api/buckets/${bucketId}/objects`);
      if (!response.ok) throw new Error("Failed to load objects");
      const data = await response.json();
      setBucketObjects((prev) => ({ ...prev, [bucketId]: data.objects || [] }));
    } catch (error: any) {
      console.error("Error loading objects:", error);
      toast.error("Failed to load objects");
    } finally {
      setLoadingObjects((prev) => ({ ...prev, [bucketId]: false }));
    }
  };

  // Create bucket
  const handleCreate = async () => {
    if (!formData.name) {
      toast.error("Bucket name is required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/buckets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          workspaceId: workspaceId,
          versioning: formData.versioning,
          encryption: formData.encryption,
          publicAccess: formData.publicAccess,
          maxSizeGB: formData.maxSizeGB ? parseInt(formData.maxSizeGB) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create bucket");
      }

      toast.success("Bucket created successfully!");
      setShowCreateDialog(false);
      setFormData({
        name: "",
        description: "",
        versioning: false,
        encryption: false,
        publicAccess: false,
        maxSizeGB: "",
      });
      loadBuckets();
    } catch (error: any) {
      console.error("Error creating bucket:", error);
      toast.error(error.message || "Failed to create bucket");
    } finally {
      setCreating(false);
    }
  };

  // Start bucket
  const handleStart = async (bucketId: string) => {
    setStarting((prev) => ({ ...prev, [bucketId]: true }));
    try {
      const response = await fetch(`/api/buckets/${bucketId}/start`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to start bucket");

      toast.success("Bucket started");
      loadBuckets();
    } catch (error: any) {
      console.error("Error starting bucket:", error);
      toast.error(error.message || "Failed to start bucket");
    } finally {
      setStarting((prev) => ({ ...prev, [bucketId]: false }));
    }
  };

  // Stop bucket
  const handleStop = async (bucketId: string) => {
    setStopping((prev) => ({ ...prev, [bucketId]: true }));
    try {
      const response = await fetch(`/api/buckets/${bucketId}/stop`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to stop bucket");

      toast.success("Bucket stopped");
      loadBuckets();
    } catch (error: any) {
      console.error("Error stopping bucket:", error);
      toast.error(error.message || "Failed to stop bucket");
    } finally {
      setStopping((prev) => ({ ...prev, [bucketId]: false }));
    }
  };

  // Delete bucket click
  const handleDeleteClick = (id: string, name: string) => {
    setDeletingId(id);
    setDeletingName(name);
    setShowDeleteDialog(true);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    setDeleting((prev) => ({ ...prev, [deletingId]: true }));
    try {
      const response = await fetch(
        `/api/buckets/${deletingId}?deleteVolume=true`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to delete bucket");

      toast.success("Bucket deleted");
      loadBuckets();
    } catch (error: any) {
      console.error("Error deleting bucket:", error);
      toast.error(error.message || "Failed to delete bucket");
    } finally {
      setDeleting((prev) => ({ ...prev, [deletingId]: false }));
      setShowDeleteDialog(false);
      setDeletingId(null);
      setDeletingName("");
    }
  };

  // Copy to clipboard
  const copyToClipboard = (bucketId: string, text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStrings((prev) => ({ ...prev, [bucketId]: true }));
    toast.success(`${label} copied!`);
    setTimeout(() => {
      setCopiedStrings((prev) => ({ ...prev, [bucketId]: false }));
    }, 2000);
  };

  // Toggle secret visibility
  const toggleSecretVisibility = (bucketId: string) => {
    setShowSecrets((prev) => ({ ...prev, [bucketId]: !prev[bucketId] }));
  };

  // Toggle expanded
  const toggleExpanded = useCallback((id: string) => {
    setExpandedBuckets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Upload file
  const handleUpload = async (bucketId: string, file: File) => {
    setUploadingTo(bucketId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", file.name);
      formData.append("contentType", file.type);

      const response = await fetch(`/api/buckets/${bucketId}/objects`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload file");

      toast.success(`File "${file.name}" uploaded successfully!`);
      loadObjects(bucketId);
      loadBuckets(); // Refresh to update object count
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setUploadingTo(null);
    }
  };

  // Download file
  const handleDownload = async (bucketId: string, key: string) => {
    try {
      const response = await fetch(
        `/api/buckets/${bucketId}/objects/${encodeURIComponent(key)}`
      );

      if (!response.ok) throw new Error("Failed to download file");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = key.split("/").pop() || key;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`File "${key}" downloaded!`);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      toast.error(error.message || "Failed to download file");
    }
  };

  // Delete file
  const handleDeleteFile = async (bucketId: string, key: string) => {
    if (!confirm(`Delete "${key}"?`)) return;

    try {
      const response = await fetch(
        `/api/buckets/${bucketId}/objects?key=${encodeURIComponent(key)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to delete file");

      toast.success(`File "${key}" deleted!`);
      loadObjects(bucketId);
      loadBuckets(); // Refresh to update object count
    } catch (error: any) {
      console.error("Error deleting file:", error);
      toast.error(error.message || "Failed to delete file");
    }
  };

  // Format bytes
  const formatBytes = (bytes: bigint | number) => {
    const num = typeof bytes === "bigint" ? Number(bytes) : bytes;
    if (num === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return Math.round((num / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "RUNNING":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "STOPPED":
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
      case "CREATING":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "ERROR":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full flex-col">
         <HardDrive className="h-12 w-12 text-zinc-600 mb-4 animate-pulse" />
         <p className="text-zinc-400">Loading buckets...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-zinc-100">Buckets</h2>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Bucket
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-zinc-100">
                  Create Bucket
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Create a new S3-compatible object storage bucket for this
                  workspace.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name" className="text-zinc-300">
                    Bucket Name *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="my-app-assets"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    3-63 characters, lowercase, numbers, and hyphens only
                  </p>
                </div>
                <div>
                  <Label htmlFor="description" className="text-zinc-300">
                    Description
                  </Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Static assets for my app"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                </div>
                <div>
                  <Label htmlFor="maxSizeGB" className="text-zinc-300">
                    Max Size (GB)
                  </Label>
                  <Input
                    id="maxSizeGB"
                    type="number"
                    value={formData.maxSizeGB}
                    onChange={(e) =>
                      setFormData({ ...formData, maxSizeGB: e.target.value })
                    }
                    placeholder="10"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Leave empty for unlimited
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={formData.versioning}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          versioning: e.target.checked,
                        })
                      }
                      className="rounded border-zinc-700"
                    />
                    Enable versioning
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={formData.encryption}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          encryption: e.target.checked,
                        })
                      }
                      className="rounded border-zinc-700"
                    />
                    Enable encryption
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={formData.publicAccess}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          publicAccess: e.target.checked,
                        })
                      }
                      className="rounded border-zinc-700"
                    />
                    Allow public access
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  className="border-zinc-700 text-zinc-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Bucket"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-sm text-zinc-500">
          {buckets.length} bucket{buckets.length !== 1 ? "s" : ""} in this
          workspace
        </p>
      </div>

      {/* Buckets List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {buckets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <HardDrive className="h-12 w-12 text-zinc-600 mb-4" />
            <h3 className="text-lg font-medium text-zinc-400 mb-2">
              No buckets yet
            </h3>
            <p className="text-sm text-zinc-600 mb-4">
              Create your first bucket to store files
            </p>
          </div>
        ) : (
          buckets.map((bucket) => {
            const isExpanded = expandedBuckets.has(bucket.id);
            const objects = bucketObjects[bucket.id] || [];
            const isLoadingObjects = loadingObjects[bucket.id];

            return (
              <div
                key={bucket.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden"
              >
                {/* Bucket Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-zinc-100">
                          {bucket.name}
                        </h3>
                        <Badge
                          className={`text-xs ${getStatusColor(bucket.status)}`}
                        >
                          {bucket.status}
                        </Badge>
                      </div>
                      {bucket.description && (
                        <p className="text-xs text-zinc-500">
                          {bucket.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                        <span>{bucket.objectCount} objects</span>
                        <span>{formatBytes(bucket.totalSizeBytes)}</span>
                        {bucket.maxSizeGB && (
                          <span>Max: {bucket.maxSizeGB} GB</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {bucket.status === "STOPPED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStart(bucket.id)}
                          disabled={starting[bucket.id]}
                          className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-400"
                        >
                          {starting[bucket.id] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {bucket.status === "RUNNING" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStop(bucket.id)}
                          disabled={stopping[bucket.id]}
                          className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-300"
                        >
                          {stopping[bucket.id] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteClick(bucket.id, bucket.name)}
                        disabled={deleting[bucket.id]}
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                      >
                        {deleting[bucket.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          toggleExpanded(bucket.id);
                          if (!isExpanded && bucket.status === "RUNNING") {
                            loadObjects(bucket.id);
                          }
                        }}
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-300"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 p-4 space-y-3 bg-zinc-900/30">
                    {/* Connection Details */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Endpoint:</span>
                        <div className="flex items-center gap-1">
                          <code className="text-xs text-zinc-300 bg-zinc-800 px-2 py-1 rounded">
                            {bucket.endpoint}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              copyToClipboard(bucket.id, bucket.endpoint, "Endpoint")
                            }
                            className="h-6 w-6 p-0"
                          >
                            {copiedStrings[bucket.id] ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Access Key:</span>
                        <div className="flex items-center gap-1">
                          <code className="text-xs text-zinc-300 bg-zinc-800 px-2 py-1 rounded">
                            {bucket.accessKey}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              copyToClipboard(
                                bucket.id,
                                bucket.accessKey,
                                "Access key"
                              )
                            }
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Secret Key:</span>
                        <div className="flex items-center gap-1">
                          <code className="text-xs text-zinc-300 bg-zinc-800 px-2 py-1 rounded">
                            {showSecrets[bucket.id]
                              ? bucket.secretKey
                              : "••••••••••••••••"}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleSecretVisibility(bucket.id)}
                            className="h-6 w-6 p-0"
                          >
                            {showSecrets[bucket.id] ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              copyToClipboard(
                                bucket.id,
                                bucket.secretKey,
                                "Secret key"
                              )
                            }
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* File Upload */}
                    {bucket.status === "RUNNING" && (
                      <div className="pt-2 border-t border-zinc-800">
                        <label className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded cursor-pointer transition-colors">
                          <Upload className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm text-zinc-300">
                            {uploadingTo === bucket.id
                              ? "Uploading..."
                              : "Upload File"}
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(bucket.id, file);
                            }}
                            disabled={uploadingTo === bucket.id}
                          />
                        </label>
                      </div>
                    )}

                    {/* Objects List */}
                    {bucket.status === "RUNNING" && (
                      <div className="pt-2 border-t border-zinc-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-zinc-400">
                            Files ({objects.length})
                          </span>
                          {isLoadingObjects && (
                            <Loader2 className="h-3 w-3 text-emerald-500 animate-spin" />
                          )}
                        </div>
                        {objects.length === 0 ? (
                          <p className="text-xs text-zinc-600 text-center py-4">
                            No files yet
                          </p>
                        ) : (
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {objects.map((obj) => (
                              <div
                                key={obj.key}
                                className="flex items-center justify-between p-2 bg-zinc-800/50 rounded hover:bg-zinc-800 transition-colors"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <File className="h-3 w-3 text-zinc-500 flex-shrink-0" />
                                  <span className="text-xs text-zinc-300 truncate">
                                    {obj.key}
                                  </span>
                                  <span className="text-xs text-zinc-600">
                                    {formatBytes(obj.size)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDownload(bucket.id, obj.key)}
                                    className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-300"
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      handleDeleteFile(bucket.id, obj.key)
                                    }
                                    className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Delete Bucket</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete "{deletingName}"? This will delete
              all files and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deletingId ? deleting[deletingId] : false}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingId && deleting[deletingId] ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Bucket"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

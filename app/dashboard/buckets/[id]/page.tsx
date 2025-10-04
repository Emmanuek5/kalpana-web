"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sidebar } from "@/components/sidebar";
import {
  HardDrive,
  ArrowLeft,
  Play,
  StopCircle,
  Trash2,
  Loader2,
  Settings,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Upload,
  Download,
  File,
  Folder,
  X,
  Copy,
  Check,
  Eye,
  EyeOff,
  Clock,
  Database,
  FolderOpen,
  Globe,
} from "lucide-react";

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
  publicUrl?: string;
  maxSizeGB?: number;
  objectCount: number;
  totalSizeBytes: bigint;
  endpoint: string;
  consoleEndpoint?: string;
  domainEndpoint?: string;
  subdomain?: string;
  domainId?: string;
  domain?: {
    id: string;
    domain: string;
    verified: boolean;
  };
  workspaceId?: string;
  workspace?: {
    id: string;
    name: string;
    status: string;
  };
  createdAt: string;
}

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
}

interface BucketObject {
  key: string;
  size: bigint;
  contentType?: string;
  etag?: string;
  lastModified: Date;
  isPublic: boolean;
}

interface BucketStats {
  objectCount: number;
  totalSizeBytes: bigint;
  totalSizeMB: number;
  totalSizeGB: number;
  largestObject?: {
    key: string;
    size: bigint;
  };
  recentObjects: BucketObject[];
}

export default function BucketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const bucketId = params.id as string;

  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [objects, setObjects] = useState<BucketObject[]>([]);
  const [stats, setStats] = useState<BucketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "files" | "settings" | "stats"
  >("overview");
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings form state
  const [editedDescription, setEditedDescription] = useState("");
  const [editedVersioning, setEditedVersioning] = useState(false);
  const [editedEncryption, setEditedEncryption] = useState(false);
  const [editedPublicAccess, setEditedPublicAccess] = useState(false);
  const [editedMaxSizeGB, setEditedMaxSizeGB] = useState("");
  const [saving, setSaving] = useState(false);

  // Domain configuration state
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [customSubdomain, setCustomSubdomain] = useState("");
  const [linkingDomain, setLinkingDomain] = useState(false);

  useEffect(() => {
    fetchBucket();
    fetchObjects();
    fetchStats();
    fetchDomains();
  }, [bucketId]);

  useEffect(() => {
    if (bucket) {
      setEditedDescription(bucket.description || "");
      setEditedVersioning(bucket.versioning);
      setEditedEncryption(bucket.encryption);
      setEditedPublicAccess(bucket.publicAccess);
      setEditedMaxSizeGB(bucket.maxSizeGB?.toString() || "");
      setSelectedDomainId(bucket.domainId || "");
      setCustomSubdomain(bucket.subdomain || "");
    }
  }, [bucket]);

  const fetchBucket = async () => {
    try {
      const res = await fetch(`/api/buckets/${bucketId}`);
      if (res.ok) {
        const data = await res.json();
        // Parse totalSizeBytes from string to bigint
        const bucket = {
          ...data.bucket,
          totalSizeBytes: BigInt(data.bucket.totalSizeBytes || "0"),
        };
        setBucket(bucket);
      } else {
        router.push("/dashboard/buckets");
      }
    } catch (error) {
      console.error("Error fetching bucket:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchObjects = async () => {
    try {
      const res = await fetch(`/api/buckets/${bucketId}/objects`);
      if (res.ok) {
        const data = await res.json();
        // Parse size from string to bigint
        const objects = (data.objects || []).map((obj: any) => ({
          ...obj,
          size: BigInt(obj.size || "0"),
          lastModified: new Date(obj.lastModified),
        }));
        setObjects(objects);
      }
    } catch (error) {
      console.error("Error fetching objects:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/buckets/${bucketId}/stats`);
      if (res.ok) {
        const data = await res.json();
        // Parse bigint fields from strings
        const stats = {
          ...data.stats,
          totalSizeBytes: BigInt(data.stats.totalSizeBytes || "0"),
          largestObject: data.stats.largestObject
            ? {
                ...data.stats.largestObject,
                size: BigInt(data.stats.largestObject.size || "0"),
              }
            : undefined,
          recentObjects: (data.stats.recentObjects || []).map((obj: any) => ({
            ...obj,
            size: BigInt(obj.size || "0"),
            lastModified: new Date(obj.lastModified),
          })),
        };
        setStats(stats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchDomains = async () => {
    try {
      const res = await fetch("/api/domains");
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains || []);
      }
    } catch (error) {
      console.error("Error fetching domains:", error);
    }
  };

  const handleLinkDomain = async () => {
    if (!selectedDomainId) {
      alert("Please select a domain");
      return;
    }

    setLinkingDomain(true);
    try {
      const res = await fetch(`/api/buckets/${bucketId}/link-domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainId: selectedDomainId,
          subdomain: customSubdomain || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBucket({
          ...data.bucket,
          totalSizeBytes: BigInt(data.bucket.totalSizeBytes || "0"),
        });
        alert("Domain linked successfully! Bucket will be accessible via domain.");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to link domain");
      }
    } catch (error) {
      console.error("Error linking domain:", error);
      alert("Failed to link domain");
    } finally {
      setLinkingDomain(false);
    }
  };

  const handleUnlinkDomain = async () => {
    if (!confirm("Are you sure you want to unlink the domain?")) return;

    setLinkingDomain(true);
    try {
      const res = await fetch(`/api/buckets/${bucketId}/link-domain`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        setBucket({
          ...data.bucket,
          totalSizeBytes: BigInt(data.bucket.totalSizeBytes || "0"),
        });
        setSelectedDomainId("");
        setCustomSubdomain("");
        alert("Domain unlinked successfully");
      } else {
        alert("Failed to unlink domain");
      }
    } catch (error) {
      console.error("Error unlinking domain:", error);
      alert("Failed to unlink domain");
    } finally {
      setLinkingDomain(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await fetch(`/api/buckets/${bucketId}/start`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchBucket();
      } else {
        alert("Failed to start bucket");
      }
    } catch (error) {
      console.error("Error starting:", error);
      alert("Failed to start bucket");
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      const res = await fetch(`/api/buckets/${bucketId}/stop`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchBucket();
      } else {
        alert("Failed to stop bucket");
      }
    } catch (error) {
      console.error("Error stopping:", error);
      alert("Failed to stop bucket");
    } finally {
      setStopping(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this bucket? All files will be permanently deleted."
      )
    )
      return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/buckets/${bucketId}?deleteVolume=true`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/dashboard/buckets");
      } else {
        alert("Failed to delete bucket");
      }
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Failed to delete bucket");
    } finally {
      setDeleting(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
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

      alert(`File "${file.name}" uploaded successfully!`);
      await fetchObjects();
      await fetchBucket();
      await fetchStats();
    } catch (error: any) {
      console.error("Error uploading file:", error);
      alert(error.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (key: string) => {
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
    } catch (error: any) {
      console.error("Error downloading file:", error);
      alert(error.message || "Failed to download file");
    }
  };

  const handleDeleteFile = async (key: string) => {
    if (!confirm(`Delete "${key}"?`)) return;

    try {
      const response = await fetch(
        `/api/buckets/${bucketId}/objects?key=${encodeURIComponent(key)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to delete file");

      alert(`File "${key}" deleted!`);
      await fetchObjects();
      await fetchBucket();
      await fetchStats();
    } catch (error: any) {
      console.error("Error deleting file:", error);
      alert(error.message || "Failed to delete file");
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/buckets/${bucketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editedDescription,
          versioning: editedVersioning,
          encryption: editedEncryption,
          publicAccess: editedPublicAccess,
          maxSizeGB: editedMaxSizeGB ? parseInt(editedMaxSizeGB) : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBucket(data.bucket);
        alert("Settings saved successfully");
      } else {
        alert("Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "RUNNING":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "CREATING":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "STOPPED":
        return "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
      case "ERROR":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      default:
        return "bg-zinc-800/80 text-zinc-400 border-zinc-700/50";
    }
  };

  const formatBytes = (bytes: bigint | number) => {
    const num = typeof bytes === "bigint" ? Number(bytes) : bytes;
    if (num === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return Math.round((num / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  if (loading || !bucket) {
    return (
      <div className="flex h-screen bg-zinc-950 items-center justify-center">
        <Loader2 className="h-12 w-12 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden relative">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none -z-10" />

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Header */}
        <div className="border-b border-zinc-800/50 px-6 py-4 bg-zinc-950/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/buckets")}
                className="border-zinc-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <HardDrive className="h-5 w-5 text-emerald-400" />
              <h1 className="text-lg font-medium text-zinc-100">
                {bucket.name}
              </h1>
              <Badge className={`${getStatusColor(bucket.status)} text-xs`}>
                {bucket.status}
              </Badge>
              {bucket.workspace && (
                <Badge
                  variant="outline"
                  className="bg-zinc-900/50 border-zinc-800 text-zinc-400 text-xs"
                >
                  Workspace: {bucket.workspace.name}
                </Badge>
              )}
              {!bucket.workspace && (
                <Badge
                  variant="outline"
                  className="bg-zinc-900/50 border-zinc-800 text-zinc-400 text-xs"
                >
                  Standalone
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {bucket.status === "STOPPED" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStart}
                  disabled={starting}
                  className="border-zinc-800"
                >
                  {starting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Start
                </Button>
              )}
              {bucket.status === "RUNNING" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStop}
                  disabled={stopping}
                  className="border-zinc-800"
                >
                  {stopping ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <StopCircle className="h-4 w-4 mr-2" />
                  )}
                  Stop
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                disabled={deleting}
                className="border-zinc-800 hover:bg-red-500/20 hover:border-red-500/40 text-zinc-500 hover:text-red-400"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "overview"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Activity className="h-4 w-4 inline mr-2" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab("files")}
              disabled={bucket.status !== "RUNNING"}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                bucket.status !== "RUNNING"
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              } ${
                activeTab === "files"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
              title={
                bucket.status !== "RUNNING"
                  ? "Start bucket to manage files"
                  : ""
              }
            >
              <FolderOpen className="h-4 w-4 inline mr-2" />
              Files ({bucket.objectCount})
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "stats"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Database className="h-4 w-4 inline mr-2" />
              Statistics
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "settings"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Settings className="h-4 w-4 inline mr-2" />
              Settings
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Bucket Info */}
                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                    Bucket Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-zinc-500 mb-1">Status</p>
                      <Badge className={getStatusColor(bucket.status)}>
                        {bucket.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500 mb-1">Region</p>
                      <p className="text-sm text-zinc-300">{bucket.region}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500 mb-1">Objects</p>
                      <p className="text-sm text-zinc-300">
                        {bucket.objectCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500 mb-1">Total Size</p>
                      <p className="text-sm text-zinc-300">
                        {formatBytes(bucket.totalSizeBytes)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500 mb-1">Created</p>
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <Clock className="h-4 w-4" />
                        {new Date(bucket.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {bucket.maxSizeGB && (
                      <div>
                        <p className="text-sm text-zinc-500 mb-1">
                          Max Size
                        </p>
                        <p className="text-sm text-zinc-300">
                          {bucket.maxSizeGB} GB
                        </p>
                      </div>
                    )}
                  </div>
                  {bucket.description && (
                    <div className="mt-4">
                      <p className="text-sm text-zinc-500 mb-1">Description</p>
                      <p className="text-sm text-zinc-300">
                        {bucket.description}
                      </p>
                    </div>
                  )}
                </Card>

                {/* Connection Details */}
                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                    Connection Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Endpoint</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-zinc-300 bg-zinc-900/80 px-3 py-2 rounded block flex-1">
                          {bucket.endpoint}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(bucket.endpoint, "endpoint")
                          }
                          className="h-9 w-9 p-0"
                        >
                          {copied === "endpoint" ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Access Key</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-zinc-300 bg-zinc-900/80 px-3 py-2 rounded block flex-1">
                          {bucket.accessKey}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(bucket.accessKey, "accessKey")
                          }
                          className="h-9 w-9 p-0"
                        >
                          {copied === "accessKey" ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Secret Key</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-zinc-300 bg-zinc-900/80 px-3 py-2 rounded block flex-1">
                          {showSecret ? bucket.secretKey : "••••••••••••••••"}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowSecret(!showSecret)}
                          className="h-9 w-9 p-0"
                        >
                          {showSecret ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(bucket.secretKey, "secretKey")
                          }
                          className="h-9 w-9 p-0"
                        >
                          {copied === "secretKey" ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {bucket.publicAccess && (
                      <div className="space-y-3">
                        {bucket.domainEndpoint && (
                          <div>
                            <p className="text-xs text-zinc-500 mb-1">
                              Public URL (HTTPS)
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="text-sm text-emerald-400 bg-zinc-900/80 px-3 py-2 rounded block flex-1">
                                {bucket.domainEndpoint}/{bucket.name}/
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  copyToClipboard(
                                    `${bucket.domainEndpoint}/${bucket.name}/`,
                                    "publicDomainUrl"
                                  )
                                }
                                className="h-9 w-9 p-0"
                              >
                                {copied === "publicDomainUrl" ? (
                                  <Check className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-zinc-500 mt-2">
                              Access files via domain with HTTPS:{" "}
                              <code className="text-emerald-400">
                                {bucket.domainEndpoint}/{bucket.name}/your-file-key
                              </code>
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">
                            Public URL (Direct Port Access)
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="text-sm text-zinc-400 bg-zinc-900/80 px-3 py-2 rounded block flex-1">
                              http://localhost:{bucket.port}/{bucket.name}/
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyToClipboard(
                                  `http://localhost:${bucket.port}/${bucket.name}/`,
                                  "publicPortUrl"
                                )
                              }
                              className="h-9 w-9 p-0"
                            >
                              {copied === "publicPortUrl" ? (
                                <Check className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-xs text-zinc-500 mt-2">
                            Local access only (not exposed to internet)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Features */}
                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                    Features
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      {bucket.versioning ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-zinc-600" />
                      )}
                      <span className="text-sm text-zinc-300">Versioning</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {bucket.encryption ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-zinc-600" />
                      )}
                      <span className="text-sm text-zinc-300">Encryption</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {bucket.publicAccess ? (
                        <AlertCircle className="h-4 w-4 text-amber-400" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      )}
                      <span className="text-sm text-zinc-300">
                        {bucket.publicAccess ? "Public" : "Private"}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Files Tab */}
            {activeTab === "files" && bucket.status === "RUNNING" && (
              <div className="space-y-6">
                {/* Upload Section */}
                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                    Upload Files
                  </h3>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                    disabled={uploading}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload File
                      </>
                    )}
                  </Button>
                </Card>

                {/* Files List */}
                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                    Files ({objects.length})
                  </h3>
                  {objects.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-8">
                      No files yet. Upload your first file to get started.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {objects.map((obj) => (
                        <div
                          key={obj.key}
                          className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg hover:bg-zinc-900 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <File className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-zinc-300 truncate">
                                {obj.key}
                              </p>
                              <p className="text-xs text-zinc-600">
                                {formatBytes(obj.size)} •{" "}
                                {new Date(obj.lastModified).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownload(obj.key)}
                              className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-300"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteFile(obj.key)}
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* Statistics Tab */}
            {activeTab === "stats" && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                    <h3 className="text-sm text-zinc-500 mb-2">
                      Total Objects
                    </h3>
                    <p className="text-3xl font-bold text-zinc-100">
                      {stats.objectCount}
                    </p>
                  </Card>
                  <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                    <h3 className="text-sm text-zinc-500 mb-2">Total Size</h3>
                    <p className="text-3xl font-bold text-zinc-100">
                      {stats.totalSizeGB.toFixed(2)} GB
                    </p>
                  </Card>
                </div>

                {stats.largestObject && (
                  <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                      Largest Object
                    </h3>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-zinc-300">
                        {stats.largestObject.key}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {formatBytes(stats.largestObject.size)}
                      </p>
                    </div>
                  </Card>
                )}

                {stats.recentObjects.length > 0 && (
                  <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                    <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                      Recent Objects
                    </h3>
                    <div className="space-y-2">
                      {stats.recentObjects.map((obj) => (
                        <div
                          key={obj.key}
                          className="flex items-center justify-between p-2 bg-zinc-900/50 rounded"
                        >
                          <p className="text-sm text-zinc-300">{obj.key}</p>
                          <p className="text-xs text-zinc-600">
                            {formatBytes(obj.size)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                {/* Domain Configuration */}
                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-emerald-400" />
                    Domain Configuration
                  </h3>
                  
                  {bucket.domain ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm text-zinc-400">Current Domain</p>
                            <p className="text-lg font-semibold text-emerald-400">
                              {bucket.subdomain}.{bucket.domain.domain}
                            </p>
                          </div>
                          {bucket.domain.verified && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              Verified
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">
                          Bucket accessible at: https://{bucket.subdomain}.{bucket.domain.domain}/{bucket.name}/
                        </p>
                      </div>
                      <Button
                        onClick={handleUnlinkDomain}
                        disabled={linkingDomain}
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        {linkingDomain ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Unlinking...
                          </>
                        ) : (
                          "Unlink Domain"
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {process.env.NEXT_PUBLIC_BASE_DOMAIN && (
                        <div className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                          <p className="text-sm text-zinc-400 mb-1">Base Domain (Automatic)</p>
                          <p className="text-emerald-400 font-mono text-sm">
                            https://{bucket.id}.{process.env.NEXT_PUBLIC_BASE_DOMAIN}/{bucket.name}/
                          </p>
                          <p className="text-xs text-zinc-500 mt-2">
                            ✓ Automatically configured when KALPANA_BASE_DOMAIN is set
                          </p>
                        </div>
                      )}
                      
                      <div>
                        <Label htmlFor="domain" className="text-zinc-300">
                          Custom Domain
                        </Label>
                        <select
                          id="domain"
                          value={selectedDomainId}
                          onChange={(e) => setSelectedDomainId(e.target.value)}
                          className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                        >
                          <option value="">Select a domain...</option>
                          {domains.filter(d => d.verified).map((domain) => (
                            <option key={domain.id} value={domain.id}>
                              {domain.domain}
                            </option>
                          ))}
                        </select>
                        {domains.filter(d => d.verified).length === 0 && (
                          <p className="text-xs text-zinc-500 mt-2">
                            No verified domains available. Add a domain in{" "}
                            <a href="/dashboard/settings/domains" className="text-emerald-400 hover:underline">
                              Settings
                            </a>
                          </p>
                        )}
                      </div>

                      {selectedDomainId && (
                        <div>
                          <Label htmlFor="subdomain" className="text-zinc-300">
                            Subdomain (optional)
                          </Label>
                          <Input
                            id="subdomain"
                            value={customSubdomain}
                            onChange={(e) => setCustomSubdomain(e.target.value)}
                            placeholder="storage (leave empty for auto-generated)"
                            className="bg-zinc-800 border-zinc-700 text-zinc-100"
                          />
                          <p className="text-xs text-zinc-500 mt-1">
                            If empty, a subdomain will be auto-generated
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={handleLinkDomain}
                        disabled={!selectedDomainId || linkingDomain}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        {linkingDomain ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Linking...
                          </>
                        ) : (
                          "Link Domain"
                        )}
                      </Button>
                    </div>
                  )}
                </Card>

                {/* Bucket Settings */}
                <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                    Bucket Settings
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="description" className="text-zinc-300">
                        Description
                      </Label>
                      <Input
                        id="description"
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
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
                        value={editedMaxSizeGB}
                        onChange={(e) => setEditedMaxSizeGB(e.target.value)}
                        className="bg-zinc-800 border-zinc-700 text-zinc-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={editedVersioning}
                          onChange={(e) =>
                            setEditedVersioning(e.target.checked)
                          }
                          className="rounded border-zinc-700"
                        />
                        Enable versioning
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={editedEncryption}
                          onChange={(e) =>
                            setEditedEncryption(e.target.checked)
                          }
                          className="rounded border-zinc-700"
                        />
                        Enable encryption
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={editedPublicAccess}
                          onChange={(e) =>
                            setEditedPublicAccess(e.target.checked)
                          }
                          className="rounded border-zinc-700"
                        />
                        Allow public access
                      </label>
                    </div>
                    <Button
                      onClick={handleSaveSettings}
                      disabled={saving}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Settings"
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

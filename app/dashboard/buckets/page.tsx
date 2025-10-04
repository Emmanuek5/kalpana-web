"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HardDrive,
  Loader2,
  Play,
  Square,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileCode,
  Plus,
  FolderOpen,
  Database,
} from "lucide-react";
import { NewBucketDialog } from "@/components/buckets/new-bucket-dialog";
import { useTeam } from "@/lib/team-context";
import { NotificationBell } from "@/components/workspace/notification-bell";

interface Workspace {
  id: string;
  name: string;
  status: string;
}

interface Bucket {
  id: string;
  name: string;
  description?: string;
  status: "CREATING" | "RUNNING" | "STOPPED" | "ERROR";
  host: string;
  port: number;
  consolePort?: number;
  objectCount: number;
  totalSizeBytes: bigint;
  endpoint: string;
  consoleEndpoint?: string;
  workspaceId?: string;
  workspace?: Workspace;
  versioning: boolean;
  encryption: boolean;
  publicAccess: boolean;
  publicUrl?: string;
  maxSizeGB?: number;
  createdAt: string;
}

export default function BucketsPage() {
  const router = useRouter();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningBucket, setActioningBucket] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { currentTeam } = useTeam();

  useEffect(() => {
    fetchAllBuckets();
  }, [currentTeam]);

  const fetchAllBuckets = async () => {
    try {
      // Fetch all buckets (standalone + workspace-based)
      const url = currentTeam
        ? `/api/buckets?teamId=${currentTeam.id}`
        : "/api/buckets";
      const bucketsRes = await fetch(url);
      if (!bucketsRes.ok) throw new Error("Failed to fetch buckets");

      const data = await bucketsRes.json();
      // Parse totalSizeBytes from string to bigint
      const buckets = (data.buckets || []).map((bucket: any) => ({
        ...bucket,
        totalSizeBytes: BigInt(bucket.totalSizeBytes || "0"),
      }));
      setBuckets(buckets);
    } catch (error) {
      console.error("Error fetching buckets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBucketAction = async (
    bucketId: string,
    action: "start" | "stop"
  ) => {
    setActioningBucket(bucketId);
    try {
      const res = await fetch(`/api/buckets/${bucketId}/${action}`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchAllBuckets();
      } else {
        const error = await res.json();
        alert(error.error || `Failed to ${action} bucket`);
      }
    } catch (error) {
      console.error(`Error ${action}ing bucket:`, error);
      alert(`Failed to ${action} bucket`);
    } finally {
      setActioningBucket(null);
    }
  };

  const handleDeleteBucket = async (bucketId: string) => {
    if (!confirm("Are you sure you want to delete this bucket? All files will be permanently deleted.")) return;

    try {
      const res = await fetch(`/api/buckets/${bucketId}?deleteVolume=true`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchAllBuckets();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to delete bucket");
      }
    } catch (error) {
      console.error("Error deleting bucket:", error);
      alert("Failed to delete bucket");
    }
  };

  const getStatusIcon = (status: Bucket["status"]) => {
    switch (status) {
      case "RUNNING":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "CREATING":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "ERROR":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "STOPPED":
        return <AlertCircle className="h-4 w-4 text-zinc-500" />;
    }
  };

  const getStatusColor = (status: Bucket["status"]) => {
    switch (status) {
      case "RUNNING":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "CREATING":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "ERROR":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "STOPPED":
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
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

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none -z-10" />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="border-b border-zinc-800/50 flex items-center justify-between px-6 py-4 bg-zinc-950/50 backdrop-blur-sm relative z-50">
          <div>
            <h1 className="text-lg font-medium text-zinc-100">Buckets</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Manage S3-compatible object storage buckets
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700">
              {buckets.length} {buckets.length === 1 ? "bucket" : "buckets"}
            </Badge>
            <NotificationBell />
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Bucket
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {buckets.length === 0 && !loading ? (
              <Card className="bg-zinc-900/50 border-zinc-800 p-12">
                <div className="text-center">
                  <HardDrive className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                    No buckets yet
                  </h3>
                  <p className="text-zinc-500 mb-6">
                    Create a bucket to store and manage files
                  </p>
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Bucket
                  </Button>
                </div>
              </Card>
            ) : loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="bg-zinc-900/50 border-zinc-800 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Skeleton className="h-6 w-48 bg-zinc-800" />
                          <Skeleton className="h-6 w-20 bg-zinc-800" />
                        </div>
                        <Skeleton className="h-4 w-32 mb-4 bg-zinc-800" />
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <Skeleton className="h-16 bg-zinc-800" />
                          <Skeleton className="h-16 bg-zinc-800" />
                          <Skeleton className="h-16 bg-zinc-800" />
                        </div>
                        <Skeleton className="h-4 w-full bg-zinc-800" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-9 w-24 bg-zinc-800" />
                        <Skeleton className="h-9 w-9 bg-zinc-800" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {buckets.map((bucket) => {
                  return (
                    <Card
                      key={bucket.id}
                      onClick={() =>
                        router.push(`/dashboard/buckets/${bucket.id}`)
                      }
                      className="bg-zinc-900/50 border-zinc-800 p-6 hover:border-zinc-700 transition-all cursor-pointer hover:scale-[1.01]"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-zinc-100">
                              {bucket.name}
                            </h3>
                            <Badge className={getStatusColor(bucket.status)}>
                              {getStatusIcon(bucket.status)}
                              <span className="ml-1.5">{bucket.status}</span>
                            </Badge>
                            {bucket.workspace && (
                              <Badge
                                variant="secondary"
                                className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs"
                              >
                                Workspace
                              </Badge>
                            )}
                            {!bucket.workspace && (
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                                Standalone
                              </Badge>
                            )}
                          </div>

                          {bucket.description && (
                            <p className="text-sm text-zinc-400 mb-3">
                              {bucket.description}
                            </p>
                          )}

                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div className="bg-zinc-900/80 rounded-lg p-3 border border-zinc-800/50">
                              <div className="flex items-center gap-2 mb-1">
                                <FolderOpen className="h-4 w-4 text-emerald-400" />
                                <span className="text-xs text-zinc-500">
                                  Objects
                                </span>
                              </div>
                              <p className="text-lg font-semibold text-zinc-100">
                                {bucket.objectCount}
                              </p>
                            </div>
                            <div className="bg-zinc-900/80 rounded-lg p-3 border border-zinc-800/50">
                              <div className="flex items-center gap-2 mb-1">
                                <Database className="h-4 w-4 text-blue-400" />
                                <span className="text-xs text-zinc-500">
                                  Size
                                </span>
                              </div>
                              <p className="text-lg font-semibold text-zinc-100">
                                {formatBytes(bucket.totalSizeBytes)}
                              </p>
                            </div>
                            <div className="bg-zinc-900/80 rounded-lg p-3 border border-zinc-800/50">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="h-4 w-4 text-purple-400" />
                                <span className="text-xs text-zinc-500">
                                  Created
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-zinc-100">
                                {bucket.createdAt
                                  ? new Date(bucket.createdAt).toLocaleDateString()
                                  : "N/A"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-zinc-500">
                            {bucket.workspace && (
                              <div className="flex items-center gap-1.5">
                                <FileCode className="h-3.5 w-3.5" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(
                                      `/workspace/${bucket.workspace!.id}`
                                    );
                                  }}
                                  className="hover:text-zinc-300 transition-colors"
                                >
                                  {bucket.workspace.name}
                                </button>
                              </div>
                            )}
                            {bucket.versioning && (
                              <span className="text-xs">Versioning enabled</span>
                            )}
                            {bucket.encryption && (
                              <span className="text-xs">Encrypted</span>
                            )}
                            {bucket.publicAccess && (
                              <span className="text-xs text-amber-400">
                                Public access
                              </span>
                            )}
                            {bucket.maxSizeGB && (
                              <span className="text-xs">
                                Max: {bucket.maxSizeGB} GB
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          {bucket.status === "RUNNING" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBucketAction(bucket.id, "stop");
                              }}
                              disabled={actioningBucket === bucket.id}
                              className="border-zinc-700 hover:bg-zinc-800"
                            >
                              {actioningBucket === bucket.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </Button>
                          ) : bucket.status === "STOPPED" ? (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBucketAction(bucket.id, "start");
                              }}
                              disabled={actioningBucket === bucket.id}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              {actioningBucket === bucket.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          ) : null}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/buckets/${bucket.id}`);
                            }}
                            className="text-zinc-400 hover:text-zinc-100"
                          >
                            View Details
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBucket(bucket.id);
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Bucket Dialog */}
      <NewBucketDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={fetchAllBuckets}
      />
    </div>
  );
}

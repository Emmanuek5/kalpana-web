"use client";

import React, { useEffect, useState } from "react";
import {
  Database as DatabaseIcon,
  Plus,
  Play,
  Square,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { NotificationBell } from "@/components/workspace/notification-bell";
import { useTeam } from "@/lib/team-context";

interface Database {
  id: string;
  name: string;
  type: string;
  status: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  connectionString: string;
  internalConnectionString?: string;
  workspaceId?: string;
  workspace?: {
    id: string;
    name: string;
  };
}

export default function DatabasesPage() {
  const router = useRouter();
  const { currentTeam } = useTeam();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [actioningDatabase, setActioningDatabase] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "POSTGRES",
    username: "admin",
    password: "",
    database: "",
    version: "",
  });

  // Load databases
  const loadDatabases = async () => {
    try {
      const response = await fetch("/api/databases");
      if (!response.ok) throw new Error("Failed to load databases");
      const data = await response.json();
      setDatabases(data.databases || []);
    } catch (error: any) {
      console.error("Error loading databases:", error);
      toast.error("Failed to load databases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabases();
    const interval = setInterval(loadDatabases, 10000);
    return () => clearInterval(interval);
  }, [currentTeam]);

  // Create database
  const handleCreate = async () => {
    if (!formData.name || !formData.type) {
      toast.error("Name and type are required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          username: formData.username || undefined,
          password: formData.password || undefined,
          database: formData.database || undefined,
          version: formData.version || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create database");
      }

      toast.success("Database created successfully!");
      setShowCreateDialog(false);
      setFormData({
        name: "",
        type: "POSTGRES",
        username: "admin",
        password: "",
        database: "",
        version: "",
      });
      loadDatabases();
    } catch (error: any) {
      console.error("Error creating database:", error);
      toast.error(error.message || "Failed to create database");
    } finally {
      setCreating(false);
    }
  };

  // Start database
  const handleStart = async (databaseId: string) => {
    setActioningDatabase(databaseId);
    try {
      const response = await fetch(`/api/databases/${databaseId}/start`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to start database");

      toast.success("Database started");
      loadDatabases();
    } catch (error: any) {
      console.error("Error starting database:", error);
      toast.error(error.message || "Failed to start database");
    } finally {
      setActioningDatabase(null);
    }
  };

  // Stop database
  const handleStop = async (databaseId: string) => {
    setActioningDatabase(databaseId);
    try {
      const response = await fetch(`/api/databases/${databaseId}/stop`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to stop database");

      toast.success("Database stopped");
      loadDatabases();
    } catch (error: any) {
      console.error("Error stopping database:", error);
      toast.error(error.message || "Failed to stop database");
    } finally {
      setActioningDatabase(null);
    }
  };

  // Delete database
  const handleDelete = async (databaseId: string, name: string) => {
    if (!confirm(`Delete database "${name}"? This will remove all data.`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/databases/${databaseId}?deleteVolume=true`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to delete database");

      toast.success("Database deleted");
      loadDatabases();
    } catch (error: any) {
      console.error("Error deleting database:", error);
      toast.error(error.message || "Failed to delete database");
    }
  };

  // Generate random password
  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
  };

  // Get database icon
  const getDatabaseIcon = (type: string) => {
    const icons: Record<string, string> = {
      POSTGRES: "🐘",
      MYSQL: "🐬",
      MONGODB: "🍃",
      REDIS: "🔴",
      SQLITE: "📦",
    };
    return icons[type] || "💾";
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "RUNNING":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "CREATING":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "ERROR":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "STOPPED":
        return <AlertCircle className="h-4 w-4 text-zinc-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-zinc-500" />;
    }
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "RUNNING":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "CREATING":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "ERROR":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "STOPPED":
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
      default:
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
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
            <h1 className="text-lg font-medium text-zinc-100">Databases</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Manage all your databases
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700">
              {databases.length} {databases.length === 1 ? "database" : "databases"}
            </Badge>
            <NotificationBell />
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Database
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {databases.length === 0 && !loading ? (
              <Card className="bg-zinc-900/50 border-zinc-800 p-12">
                <div className="text-center">
                  <DatabaseIcon className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                    No databases yet
                  </h3>
                  <p className="text-zinc-500 mb-6">
                    Create a database to get started
                  </p>
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Database
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
                {databases.map((db) => {
                  const dbIcon = getDatabaseIcon(db.type);
                  const isRunning = db.status === "RUNNING";
                  const isStopped = db.status === "STOPPED";

                  return (
                    <Card
                      key={db.id}
                      onClick={() => router.push(`/dashboard/databases/${db.id}`)}
                      className="bg-zinc-900/50 border-zinc-800 p-6 hover:border-zinc-700 transition-all cursor-pointer hover:scale-[1.01]"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{dbIcon}</span>
                            <h3 className="text-lg font-semibold text-zinc-100">
                              {db.name}
                            </h3>
                            <Badge className={getStatusColor(db.status)}>
                              {getStatusIcon(db.status)}
                              <span className="ml-1.5">{db.status}</span>
                            </Badge>
                            {db.workspaceId && db.workspace ? (
                              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                                Linked to {db.workspace.name}
                              </Badge>
                            ) : (
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                                Standalone
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-zinc-500">
                            <div className="flex items-center gap-1.5">
                              <DatabaseIcon className="h-3.5 w-3.5" />
                              <span>{db.type}</span>
                            </div>
                            {isRunning && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-zinc-600">Port:</span>
                                <span className="text-zinc-400">{db.port}</span>
                              </div>
                            )}
                            {db.workspace && (
                              <div className="flex items-center gap-1.5">
                                <FileCode className="h-3.5 w-3.5" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/workspace/${db.workspace!.id}`);
                                  }}
                                  className="hover:text-zinc-300 transition-colors"
                                >
                                  {db.workspace.name}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          {isRunning ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStop(db.id);
                              }}
                              disabled={actioningDatabase === db.id}
                              className="border-zinc-700 hover:bg-zinc-800"
                            >
                              {actioningDatabase === db.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </Button>
                          ) : isStopped ? (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStart(db.id);
                              }}
                              disabled={actioningDatabase === db.id}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              {actioningDatabase === db.id ? (
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
                              router.push(`/dashboard/databases/${db.id}`);
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
                              handleDelete(db.id, db.name);
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

      {/* Create Database Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Create Database</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Deploy a new standalone database
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Database Type */}
            <div>
              <Label className="text-zinc-300">Database Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="POSTGRES">🐘 PostgreSQL</SelectItem>
                  <SelectItem value="MYSQL">🐬 MySQL</SelectItem>
                  <SelectItem value="MONGODB">🍃 MongoDB</SelectItem>
                  <SelectItem value="REDIS">🔴 Redis</SelectItem>
                  <SelectItem value="SQLITE">📦 SQLite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Database Name */}
            <div>
              <Label className="text-zinc-300">Database Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  // Only allow alphanumeric, underscore, hyphen
                  const sanitized = e.target.value.replace(/[^a-zA-Z0-9_-]/g, "");
                  setFormData({ ...formData, name: sanitized });
                }}
                placeholder="production_db"
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Only letters, numbers, underscores, and hyphens allowed
              </p>
            </div>

            {/* Username */}
            {!["REDIS", "SQLITE"].includes(formData.type) && (
              <div>
                <Label className="text-zinc-300">Username</Label>
                <Input
                  value={formData.username}
                  onChange={(e) => {
                    // Only allow alphanumeric and underscore
                    const sanitized = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                    setFormData({ ...formData, username: sanitized });
                  }}
                  placeholder="admin"
                  className="bg-zinc-800 border-zinc-700 text-zinc-200"
                />
                <p className="text-xs text-zinc-600 mt-1">
                  Only letters, numbers, and underscores allowed
                </p>
              </div>
            )}

            {/* Password */}
            {formData.type !== "SQLITE" && (
              <div>
                <Label className="text-zinc-300">Password</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        password: e.target.value,
                      })
                    }
                    placeholder="Leave empty for auto-generated"
                    className="bg-zinc-800 border-zinc-700 text-zinc-200"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generatePassword}
                    className="border-zinc-700 text-zinc-300"
                  >
                    Generate
                  </Button>
                </div>
              </div>
            )}

            {/* Database Name (within server) */}
            {!["REDIS", "SQLITE"].includes(formData.type) && (
              <div>
                <Label className="text-zinc-300">
                  Database Name (within server)
                </Label>
                <Input
                  value={formData.database}
                  onChange={(e) => {
                    // Only allow alphanumeric and underscore
                    const sanitized = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                    setFormData({ ...formData, database: sanitized });
                  }}
                  placeholder="Leave empty to use database name"
                  className="bg-zinc-800 border-zinc-700 text-zinc-200"
                />
                <p className="text-xs text-zinc-600 mt-1">
                  Only letters, numbers, and underscores allowed
                </p>
              </div>
            )}

            {/* Version */}
            <div>
              <Label className="text-zinc-300">Version (optional)</Label>
              <Input
                value={formData.version}
                onChange={(e) =>
                  setFormData({ ...formData, version: e.target.value })
                }
                placeholder={
                  formData.type === "POSTGRES"
                    ? "16"
                    : formData.type === "MYSQL"
                    ? "8"
                    : formData.type === "MONGODB"
                    ? "7"
                    : formData.type === "REDIS"
                    ? "7"
                    : ""
                }
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="border-zinc-700 text-zinc-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !formData.name}
                className="bg-emerald-600/90 hover:bg-emerald-500 text-white"
              >
                {creating ? "Creating..." : "Create Database"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

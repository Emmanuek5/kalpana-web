"use client";

import React, { useEffect, useState, use } from "react";
import {
  Database as DatabaseIcon,
  ArrowLeft,
  Play,
  Square,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  FileText,
  Settings as SettingsIcon,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Edit,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

interface Database {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  connectionString: string;
  internalConnectionString?: string;
  version?: string;
  createdAt: string;
  workspaceId?: string;
  workspace?: {
    id: string;
    name: string;
  };
}

export default function DatabaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [database, setDatabase] = useState<Database | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "settings">(
    "overview"
  );
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false);
  const [copiedStrings, setCopiedStrings] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedPassword, setEditedPassword] = useState("");

  // Load database details
  const loadDatabase = async () => {
    try {
      const response = await fetch(`/api/databases/${resolvedParams.id}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Database not found");
          router.push("/dashboard/databases");
          return;
        }
        throw new Error("Failed to load database");
      }
      const data = await response.json();
      setDatabase(data.database);
      setEditedName(data.database.name);
      setEditedDescription(data.database.description || "");
      setEditedPassword("");
    } catch (error: any) {
      console.error("Error loading database:", error);
      toast.error("Failed to load database");
    } finally {
      setLoading(false);
    }
  };

  // Load logs
  const loadLogs = async () => {
    if (!database || database.type === "SQLITE") return;

    setLoadingLogs(true);
    try {
      const response = await fetch(
        `/api/databases/${resolvedParams.id}/logs?tail=200`
      );
      if (!response.ok) throw new Error("Failed to load logs");
      const data = await response.json();
      setLogs(data.logs || "No logs available");
    } catch (error: any) {
      console.error("Error loading logs:", error);
      toast.error("Failed to load logs");
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, [resolvedParams.id]);

  useEffect(() => {
    if (activeTab === "logs" && database) {
      loadLogs();
    }
  }, [activeTab, database]);

  // Start database
  const handleStart = async () => {
    if (!database) return;
    try {
      const response = await fetch(`/api/databases/${database.id}/start`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to start database");
      toast.success("Database started");
      loadDatabase();
    } catch (error: any) {
      toast.error(error.message || "Failed to start database");
    }
  };

  // Stop database
  const handleStop = async () => {
    if (!database) return;
    try {
      const response = await fetch(`/api/databases/${database.id}/stop`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to stop database");
      toast.success("Database stopped");
      loadDatabase();
    } catch (error: any) {
      toast.error(error.message || "Failed to stop database");
    }
  };

  // Delete database
  const handleDelete = async () => {
    if (!database) return;
    if (
      !confirm(`Delete database "${database.name}"? This will remove all data.`)
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/databases/${database.id}?deleteVolume=true`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to delete database");
      toast.success("Database deleted");
      router.push("/dashboard/databases");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete database");
    }
  };

  // Save database changes
  const handleSave = async () => {
    if (!database) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/databases/${database.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedName,
          description: editedDescription,
          password: editedPassword || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update database");
      }

      toast.success("Database updated successfully!");
      setEditMode(false);
      setEditedPassword("");
      loadDatabase();
    } catch (error: any) {
      console.error("Error updating database:", error);
      toast.error(error.message || "Failed to update database");
    } finally {
      setSaving(false);
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    if (!database) return;
    setEditedName(database.name);
    setEditedDescription(database.description || "");
    setEditedPassword("");
    setEditMode(false);
  };

  // Copy connection string
  const copyConnectionString = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedStrings({ ...copiedStrings, [key]: true });
    toast.success("Copied to clipboard!");
    setTimeout(() => {
      setCopiedStrings({ ...copiedStrings, [key]: false });
    }, 2000);
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

  if (loading) {
    return (
      <div className="flex h-screen bg-zinc-950 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-emerald-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-zinc-500">Loading database...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!database) {
    return null;
  }

  const dbIcon = getDatabaseIcon(database.type);
  const isRunning = database.status === "RUNNING";
  const isStopped = database.status === "STOPPED";

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none -z-10" />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="border-b border-zinc-800/50 px-6 py-4 bg-zinc-950/50 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/databases")}
            className="text-zinc-400 hover:text-zinc-200 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Databases
          </Button>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">{dbIcon}</div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-100 mb-1">
                  {database.name}
                </h1>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                    {database.type}
                  </Badge>
                  <Badge className={getStatusColor(database.status)}>
                    {getStatusIcon(database.status)}
                    <span className="ml-1.5">{database.status}</span>
                  </Badge>
                  {database.workspaceId && database.workspace ? (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      Linked to {database.workspace.name}
                    </Badge>
                  ) : (
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      Standalone
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {isStopped && (
                <Button
                  onClick={handleStart}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              )}
              {isRunning && (
                <Button
                  onClick={handleStop}
                  variant="outline"
                  className="border-zinc-700 hover:bg-zinc-800"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
              <Button
                onClick={handleDelete}
                variant="outline"
                className="border-red-700/50 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-6">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "overview"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "logs"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <FileText className="h-4 w-4 inline mr-1" />
              Logs
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "settings"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <SettingsIcon className="h-4 w-4 inline mr-1" />
              Settings
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Connection Information */}
                <Card className="bg-zinc-900/50 border-zinc-800 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-zinc-200">
                      Connection Information
                    </h2>
                    {isRunning && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowSensitiveInfo(!showSensitiveInfo)}
                        className="border-zinc-700 text-zinc-300"
                      >
                        {showSensitiveInfo ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Hide Credentials
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Show Credentials
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {isRunning ? (
                    showSensitiveInfo ? (
                      <div className="space-y-4">
                        {/* External Connection */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm text-zinc-400">
                              External Connection String
                            </Label>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyConnectionString(
                                  "external",
                                  database.connectionString
                                )
                              }
                              className="h-8 text-xs text-zinc-400 hover:text-zinc-200"
                            >
                              {copiedStrings["external"] ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </>
                              )}
                            </Button>
                          </div>
                          <div className="p-3 rounded bg-zinc-950/50 border border-zinc-800/50">
                            <code className="text-sm text-zinc-300 break-all">
                              {database.connectionString}
                            </code>
                          </div>
                          <p className="text-xs text-zinc-600 mt-1">
                            Use this to connect from your local machine or external
                            services
                          </p>
                        </div>

                        {/* Internal Connection */}
                        {database.internalConnectionString && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-sm text-zinc-400">
                                Internal Connection String (Docker Network)
                              </Label>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  copyConnectionString(
                                    "internal",
                                    database.internalConnectionString!
                                  )
                                }
                                className="h-8 text-xs text-zinc-400 hover:text-zinc-200"
                              >
                                {copiedStrings["internal"] ? (
                                  <>
                                    <Check className="h-3 w-3 mr-1" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>
                            <div className="p-3 rounded bg-zinc-950/50 border border-zinc-800/50">
                              <code className="text-sm text-zinc-300 break-all">
                                {database.internalConnectionString}
                              </code>
                            </div>
                            <p className="text-xs text-zinc-600 mt-1">
                              Use this from within your workspace containers
                            </p>
                          </div>
                        )}

                        {/* Credentials Grid */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                          <div>
                            <Label className="text-xs text-zinc-500">Host</Label>
                            <p className="text-sm text-zinc-300 mt-1">
                              {database.host}
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-zinc-500">Port</Label>
                            <p className="text-sm text-zinc-300 mt-1">
                              {database.port}
                            </p>
                          </div>
                          {database.username && (
                            <div>
                              <Label className="text-xs text-zinc-500">
                                Username
                              </Label>
                              <p className="text-sm text-zinc-300 mt-1">
                                {database.username}
                              </p>
                            </div>
                          )}
                          {database.password && (
                            <div>
                              <Label className="text-xs text-zinc-500">
                                Password
                              </Label>
                              <p className="text-sm text-zinc-300 mt-1 font-mono">
                                {database.password}
                              </p>
                            </div>
                          )}
                          {database.database && (
                            <div>
                              <Label className="text-xs text-zinc-500">
                                Database Name
                              </Label>
                              <p className="text-sm text-zinc-300 mt-1">
                                {database.database}
                              </p>
                            </div>
                          )}
                          {database.version && (
                            <div>
                              <Label className="text-xs text-zinc-500">
                                Version
                              </Label>
                              <p className="text-sm text-zinc-300 mt-1">
                                {database.version}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Eye className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                        <p className="text-sm text-zinc-500 mb-4">
                          Connection credentials are hidden for security
                        </p>
                        <Button
                          onClick={() => setShowSensitiveInfo(true)}
                          variant="outline"
                          className="border-zinc-700 text-zinc-300"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Show Credentials
                        </Button>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                      <p className="text-sm text-zinc-500">
                        Database is not running. Start it to view connection details.
                      </p>
                    </div>
                  )}
                </Card>

                {/* Metadata */}
                <Card className="bg-zinc-900/50 border-zinc-800 p-6">
                  <h2 className="text-lg font-semibold text-zinc-200 mb-4">
                    Metadata
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-zinc-500">Database ID</Label>
                      <p className="text-sm text-zinc-300 mt-1 font-mono">
                        {database.id}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500">Created</Label>
                      <p className="text-sm text-zinc-300 mt-1">
                        {new Date(database.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500">Type</Label>
                      <p className="text-sm text-zinc-300 mt-1">{database.type}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500">Status</Label>
                      <Badge className={getStatusColor(database.status)}>
                        {getStatusIcon(database.status)}
                        <span className="ml-1.5">{database.status}</span>
                      </Badge>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Logs Tab */}
            {activeTab === "logs" && (
              <Card className="bg-zinc-900/50 border-zinc-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-zinc-200">
                    Database Logs
                  </h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={loadLogs}
                    disabled={loadingLogs}
                    className="border-zinc-700 text-zinc-300"
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-2 ${
                        loadingLogs ? "animate-spin" : ""
                      }`}
                    />
                    Refresh
                  </Button>
                </div>

                {database.type === "SQLITE" ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500">
                      SQLite is file-based and doesn't produce container logs
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/50 font-mono text-xs max-h-[600px] overflow-y-auto">
                    <pre className="text-zinc-400 whitespace-pre-wrap">
                      {loadingLogs
                        ? "Loading logs..."
                        : logs || "No logs available"}
                    </pre>
                  </div>
                )}
              </Card>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                {/* Edit Settings */}
                <Card className="bg-zinc-900/50 border-zinc-800 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-zinc-200">
                      Database Settings
                    </h2>
                    {!editMode && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditMode(true)}
                        className="border-zinc-700 text-zinc-300"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Database Name */}
                    <div>
                      <Label className="text-sm text-zinc-400">Database Name</Label>
                      {editMode ? (
                        <>
                          <Input
                            value={editedName}
                            onChange={(e) => {
                              // Only allow alphanumeric, underscore, hyphen
                              const sanitized = e.target.value.replace(/[^a-zA-Z0-9_-]/g, "");
                              setEditedName(sanitized);
                            }}
                            className="mt-1 bg-zinc-800 border-zinc-700 text-zinc-200"
                          />
                          <p className="text-xs text-zinc-600 mt-1">
                            Only letters, numbers, underscores, and hyphens allowed
                          </p>
                        </>
                      ) : (
                        <p className="text-base text-zinc-200 mt-1">
                          {database.name}
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <Label className="text-sm text-zinc-400">Description</Label>
                      {editMode ? (
                        <Input
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          placeholder="Optional description"
                          className="mt-1 bg-zinc-800 border-zinc-700 text-zinc-200"
                        />
                      ) : (
                        <p className="text-base text-zinc-200 mt-1">
                          {database.description || (
                            <span className="text-zinc-600 italic">
                              No description
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Password (only in edit mode) */}
                    {editMode && database.type !== "SQLITE" && (
                      <div>
                        <Label className="text-sm text-zinc-400">
                          New Password (optional)
                        </Label>
                        <Input
                          type="password"
                          value={editedPassword}
                          onChange={(e) => setEditedPassword(e.target.value)}
                          placeholder="Leave empty to keep current password"
                          className="mt-1 bg-zinc-800 border-zinc-700 text-zinc-200"
                        />
                        <p className="text-xs text-zinc-600 mt-1">
                          Changing the password will require updating all connections
                        </p>
                      </div>
                    )}

                    {/* Read-only fields */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                      <div>
                        <Label className="text-sm text-zinc-400">Type</Label>
                        <p className="text-base text-zinc-200 mt-1">
                          {database.type}
                        </p>
                      </div>
                      {database.version && (
                        <div>
                          <Label className="text-sm text-zinc-400">Version</Label>
                          <p className="text-base text-zinc-200 mt-1">
                            {database.version}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Save/Cancel buttons */}
                    {editMode && (
                      <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800/50">
                        <Button
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="border-zinc-700 text-zinc-300"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSave}
                          disabled={saving || !editedName}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save Changes
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Danger Zone */}
                <Card className="bg-zinc-900/50 border-red-900/20 p-6">
                  <h2 className="text-lg font-semibold text-red-400 mb-4">
                    Danger Zone
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <Button
                        onClick={handleDelete}
                        variant="outline"
                        className="border-red-700/50 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Database
                      </Button>
                      <p className="text-xs text-zinc-600 mt-2">
                        This will permanently delete the database and all its data.
                        This action cannot be undone.
                      </p>
                    </div>
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

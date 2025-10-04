"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Database as DatabaseIcon,
  Plus,
  Play,
  Square,
  Trash2,
  Copy,
  Check,
  Circle,
  Eye,
  EyeOff,
  FileText,
  AlertCircle,
  ChevronDown,
  Loader2,
  Globe,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

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
  domainConnectionString?: string;
  domain?: {
    id: string;
    domain: string;
    verified: boolean;
  };
  subdomain?: string;
}

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
}

interface DatabasesPanelProps {
  workspaceId: string;
}

export function DatabasesPanel({ workspaceId }: DatabasesPanelProps) {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLinkDomainDialog, setShowLinkDomainDialog] = useState(false);
  const [linkingDatabaseId, setLinkingDatabaseId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>("");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [copiedStrings, setCopiedStrings] = useState<Record<string, boolean>>({});
  const [expandedDatabases, setExpandedDatabases] = useState<Set<string>>(new Set());
  const [showConnections, setShowConnections] = useState<Record<string, boolean>>({});
  const [starting, setStarting] = useState<Record<string, boolean>>({});
  const [stopping, setStopping] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<Record<string, boolean>>({});

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "POSTGRES",
    username: "admin",
    password: "",
    database: "",
    version: "",
    domainId: "",
    subdomain: "",
  });

  // Link domain form state
  const [linkDomainData, setLinkDomainData] = useState({
    domainId: "",
    subdomain: "",
  });

  // Load databases
  const loadDatabases = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/databases`);
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

  // Load user domains
  const loadDomains = async () => {
    try {
      const response = await fetch("/api/domains");
      if (!response.ok) throw new Error("Failed to load domains");
      const data = await response.json();
      setDomains(data.domains || []);
    } catch (error: any) {
      console.error("Error loading domains:", error);
    }
  };

  useEffect(() => {
    loadDatabases();
    loadDomains();
    const interval = setInterval(loadDatabases, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [workspaceId]);

  // Create database
  const handleCreate = async () => {
    if (!formData.name || !formData.type) {
      toast.error("Name and type are required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/databases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          username: formData.username || undefined,
          password: formData.password || undefined,
          database: formData.database || undefined,
          version: formData.version || undefined,
          domainId: formData.domainId || undefined,
          subdomain: formData.subdomain || undefined,
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
        domainId: "",
        subdomain: "",
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
    setStarting((prev) => ({ ...prev, [databaseId]: true }));
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
      setStarting((prev) => ({ ...prev, [databaseId]: false }));
    }
  };

  // Stop database
  const handleStop = async (databaseId: string) => {
    setStopping((prev) => ({ ...prev, [databaseId]: true }));
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
      setStopping((prev) => ({ ...prev, [databaseId]: false }));
    }
  };

  // Delete database click
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
        `/api/databases/${deletingId}?deleteVolume=true`,
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
    } finally {
      setDeleting((prev) => ({ ...prev, [deletingId]: false }));
      setShowDeleteDialog(false);
      setDeletingId(null);
      setDeletingName("");
    }
  };

  // Copy connection string
  const copyConnectionString = (dbId: string, connectionString: string) => {
    navigator.clipboard.writeText(connectionString);
    setCopiedStrings((prev) => ({ ...prev, [dbId]: true }));
    toast.success("Connection string copied!");
    setTimeout(() => {
      setCopiedStrings((prev) => ({ ...prev, [dbId]: false }));
    }, 2000);
  };

  // Toggle password visibility
  const togglePasswordVisibility = (dbId: string) => {
    setShowPasswords((prev) => ({ ...prev, [dbId]: !prev[dbId] }));
  };

  // Toggle expanded
  const toggleExpanded = useCallback((id: string) => {
    setExpandedDatabases((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Toggle show connections
  const toggleShowConnection = useCallback((id: string) => {
    setShowConnections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Link domain to database
  const handleLinkDomain = async () => {
    if (!linkingDatabaseId || !linkDomainData.domainId) {
      toast.error("Please select a domain");
      return;
    }

    setLinking(true);
    try {
      const response = await fetch(
        `/api/databases/${linkingDatabaseId}/link-domain`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domainId: linkDomainData.domainId,
            subdomain: linkDomainData.subdomain || undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to link domain");
      }

      toast.success("Domain linked successfully!");
      setShowLinkDomainDialog(false);
      setLinkingDatabaseId(null);
      setLinkDomainData({ domainId: "", subdomain: "" });
      loadDatabases();
    } catch (error: any) {
      console.error("Error linking domain:", error);
      toast.error(error.message || "Failed to link domain");
    } finally {
      setLinking(false);
    }
  };

  // Unlink domain from database
  const handleUnlinkDomain = async (databaseId: string) => {
    setUnlinking((prev) => ({ ...prev, [databaseId]: true }));
    try {
      const response = await fetch(
        `/api/databases/${databaseId}/link-domain`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unlink domain");
      }

      toast.success("Domain unlinked successfully!");
      loadDatabases();
    } catch (error: any) {
      console.error("Error unlinking domain:", error);
      toast.error(error.message || "Failed to unlink domain");
    } finally {
      setUnlinking((prev) => ({ ...prev, [databaseId]: false }));
    }
  };

  // Open link domain dialog
  const openLinkDomainDialog = (databaseId: string) => {
    setLinkingDatabaseId(databaseId);
    setShowLinkDomainDialog(true);
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

  // Get database icon and color
  const getDatabaseIcon = (type: string) => {
    const icons: Record<string, { icon: string; color: string }> = {
      POSTGRES: { icon: "🐘", color: "#336791" },
      MYSQL: { icon: "🐬", color: "#4479A1" },
      MONGODB: { icon: "🍃", color: "#47A248" },
      REDIS: { icon: "🔴", color: "#DC382D" },
      SQLITE: { icon: "📦", color: "#003B57" },
    };
    return icons[type] || { icon: "💾", color: "#666" };
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "RUNNING":
        return "text-emerald-500";
      case "STOPPED":
        return "text-zinc-500";
      case "CREATING":
        return "text-blue-500";
      case "ERROR":
        return "text-red-500";
      default:
        return "text-zinc-500";
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <DatabaseIcon className="h-12 w-12 text-zinc-700 animate-pulse mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Loading databases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DatabaseIcon className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-zinc-200">Databases</h2>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="bg-emerald-600/90 hover:bg-emerald-500 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Database
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <DialogHeader>
                <DialogTitle>Create Database</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Deploy a new database for this workspace
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
                      <SelectItem value="POSTGRES">
                        🐘 PostgreSQL
                      </SelectItem>
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
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="myapp_db"
                    className="bg-zinc-800 border-zinc-700 text-zinc-200"
                  />
                </div>

                {/* Username (not for Redis/SQLite) */}
                {!["REDIS", "SQLITE"].includes(formData.type) && (
                  <div>
                    <Label className="text-zinc-300">Username</Label>
                    <Input
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      placeholder="admin"
                      className="bg-zinc-800 border-zinc-700 text-zinc-200"
                    />
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
                          setFormData({ ...formData, password: e.target.value })
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
                      onChange={(e) =>
                        setFormData({ ...formData, database: e.target.value })
                      }
                      placeholder="Leave empty to use database name"
                      className="bg-zinc-800 border-zinc-700 text-zinc-200"
                    />
                  </div>
                )}

                {/* Version */}
                <div>
                  <Label className="text-zinc-300">
                    Version (optional)
                  </Label>
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

                {/* Domain Selection (optional, not for SQLite) */}
                {formData.type !== "SQLITE" && (
                  <>
                    <div className="border-t border-zinc-800 pt-4">
                      <Label className="text-zinc-300 flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Domain (Optional)
                      </Label>
                      <p className="text-xs text-zinc-500 mb-2">
                        Link a domain for SSL-enabled access
                      </p>
                      <Select
                        value={formData.domainId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, domainId: value })
                        }
                      >
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                          <SelectValue placeholder="No domain (port-based access)" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          <SelectItem value="">
                            No domain (port-based access)
                          </SelectItem>
                          {domains
                            .filter((d) => d.verified)
                            .map((domain) => (
                              <SelectItem key={domain.id} value={domain.id}>
                                {domain.domain} ✓
                              </SelectItem>
                            ))}
                          {domains.filter((d) => d.verified).length === 0 && (
                            <SelectItem value="none" disabled>
                              No verified domains available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Subdomain (optional, shown when domain is selected) */}
                    {formData.domainId && (
                      <div>
                        <Label className="text-zinc-300">
                          Subdomain (optional)
                        </Label>
                        <Input
                          value={formData.subdomain}
                          onChange={(e) =>
                            setFormData({ ...formData, subdomain: e.target.value })
                          }
                          placeholder="Auto-generated if empty"
                          className="bg-zinc-800 border-zinc-700 text-zinc-200"
                        />
                        {formData.subdomain && (
                          <p className="text-xs text-zinc-500 mt-1">
                            Will be accessible at:{" "}
                            <span className="text-emerald-400">
                              {formData.subdomain}.
                              {
                                domains.find((d) => d.id === formData.domainId)
                                  ?.domain
                              }
                            </span>
                          </p>
                        )}
                        {!formData.subdomain && formData.name && (
                          <p className="text-xs text-zinc-500 mt-1">
                            Auto-generated subdomain:{" "}
                            <span className="text-zinc-400">
                              {formData.type.toLowerCase()}-
                              {formData.name
                                .toLowerCase()
                                .replace(/[^a-z0-9]/g, "-")}
                              .
                              {
                                domains.find((d) => d.id === formData.domainId)
                                  ?.domain
                              }
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

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
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Database"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Delete Database</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete "{deletingName}"? This action cannot be undone and will remove all data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={!!deleting[deletingId || ""]}
              className="bg-red-600/90 hover:bg-red-500 text-white"
            >
              {deleting[deletingId || ""] ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Database"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Domain Dialog */}
      <Dialog open={showLinkDomainDialog} onOpenChange={setShowLinkDomainDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Link Domain to Database</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Connect a verified domain for SSL-enabled access to your database
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Domain Selection */}
            <div>
              <Label className="text-zinc-300">Select Domain</Label>
              <Select
                value={linkDomainData.domainId}
                onValueChange={(value) =>
                  setLinkDomainData({ ...linkDomainData, domainId: value })
                }
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  <SelectValue placeholder="Choose a domain" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {domains
                    .filter((d) => d.verified)
                    .map((domain) => (
                      <SelectItem key={domain.id} value={domain.id}>
                        {domain.domain} ✓
                      </SelectItem>
                    ))}
                  {domains.filter((d) => d.verified).length === 0 && (
                    <SelectItem value="none" disabled>
                      No verified domains available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Subdomain (optional) */}
            {linkDomainData.domainId && (
              <div>
                <Label className="text-zinc-300">Subdomain (optional)</Label>
                <Input
                  value={linkDomainData.subdomain}
                  onChange={(e) =>
                    setLinkDomainData({
                      ...linkDomainData,
                      subdomain: e.target.value,
                    })
                  }
                  placeholder="Auto-generated if empty"
                  className="bg-zinc-800 border-zinc-700 text-zinc-200"
                />
                {linkDomainData.subdomain && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Will be accessible at:{" "}
                    <span className="text-emerald-400">
                      {linkDomainData.subdomain}.
                      {
                        domains.find((d) => d.id === linkDomainData.domainId)
                          ?.domain
                      }
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowLinkDomainDialog(false);
                  setLinkDomainData({ domainId: "", subdomain: "" });
                }}
                className="border-zinc-700 text-zinc-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleLinkDomain}
                disabled={linking || !linkDomainData.domainId}
                className="bg-emerald-600/90 hover:bg-emerald-500 text-white"
              >
                {linking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Linking...
                  </>
                ) : (
                  <>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Link Domain
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Database List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {databases.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <DatabaseIcon className="h-16 w-16 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-400 mb-2">
                No Databases Yet
              </h3>
              <p className="text-sm text-zinc-600 mb-6">
                Deploy PostgreSQL, MySQL, MongoDB, Redis, or SQLite databases
                for your workspace
              </p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-emerald-600/90 hover:bg-emerald-500 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Database
              </Button>
            </div>
          </div>
        ) : (
          databases.map((db) => {
            const dbIcon = getDatabaseIcon(db.type);
            const statusColor = getStatusColor(db.status);
            const isRunning = db.status === "RUNNING";
            const isStopped = db.status === "STOPPED";
            const expanded = expandedDatabases.has(db.id);
            const showConn = showConnections[db.id];

            return (
              <div
                key={db.id}
                className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors"
              >
                {/* Header */}
                <div 
                  className="flex items-start justify-between mb-3"
                  onClick={() => toggleExpanded(db.id)}
                >
                  <div className="flex items-center gap-3 flex-1 cursor-pointer">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${dbIcon.color}20` }}
                    >
                      {dbIcon.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-zinc-200">
                          {db.name}
                        </h3>
                        {db.domain && db.subdomain && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                            <Globe className="h-3 w-3 text-emerald-400" />
                            <span className="text-xs text-emerald-400">
                              SSL
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-zinc-500">
                          {db.type}
                        </span>
                        <Circle
                          className={`h-2 w-2 ${statusColor} ${
                            isRunning ? "fill-current" : ""
                          }`}
                        />
                        <span className={`text-xs ${statusColor}`}>
                          {db.status}
                        </span>
                      </div>
                      {db.domain && db.subdomain && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-zinc-500">
                            {db.subdomain}.{db.domain.domain}
                          </span>
                        </div>
                      )}
                    </div>
                    <ChevronDown 
                      className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-4">
                    {/* Link/Unlink Domain Button (only for non-SQLite) */}
                    {db.type !== "SQLITE" && (
                      <>
                        {!db.domain ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLinkDomainDialog(db.id);
                            }}
                            className="h-8 w-8 p-0 text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
                            title="Link Domain"
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlinkDomain(db.id);
                            }}
                            className="h-8 w-8 p-0 text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                            disabled={unlinking[db.id]}
                            title="Unlink Domain"
                          >
                            {unlinking[db.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Unlink className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </>
                    )}
                    {isStopped && !starting[db.id] && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStart(db.id);
                        }}
                        className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                        disabled={starting[db.id]}
                      >
                        {starting[db.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {isRunning && !stopping[db.id] && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStop(db.id);
                        }}
                        className="h-8 w-8 p-0 text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                        disabled={stopping[db.id]}
                      >
                        {stopping[db.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(db.id, db.name);
                      }}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                      disabled={deleting[db.id]}
                    >
                      {deleting[db.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded Content */}
                {expanded && (
                  <div className="space-y-3 border-t border-zinc-800/50 pt-3">
                    {db.status !== "RUNNING" && db.status !== "ERROR" && (
                      <div className="p-3 rounded bg-zinc-950/50 border border-zinc-800/50 text-center">
                        <p className="text-sm text-zinc-400">
                          Database is {db.status.toLowerCase()}. Start it to view connection details.
                        </p>
                      </div>
                    )}
                    {isRunning && (
                      <div className="space-y-4">
                        {/* Connection Strings */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-medium text-zinc-300">
                              Connection Strings
                            </Label>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleShowConnection(db.id)}
                              className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                            >
                              {showConn ? (
                                <>
                                  <EyeOff className="h-3 w-3 mr-1" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3 w-3 mr-1" />
                                  Show
                                </>
                              )}
                            </Button>
                          </div>
                          {showConn && (
                            <div className="space-y-3">
                              {/* External */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-zinc-500">External</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      copyConnectionString(db.id, db.connectionString)
                                    }
                                    className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                                  >
                                    {copiedStrings[db.id] ? (
                                      <Check className="h-3 w-3 mr-1" />
                                    ) : (
                                      <Copy className="h-3 w-3 mr-1" />
                                    )}
                                    Copy
                                  </Button>
                                </div>
                                <div className="p-2 rounded bg-zinc-950/50 border border-zinc-800/50">
                                  <code className="text-xs text-zinc-400 break-all">
                                    {db.connectionString}
                                  </code>
                                </div>
                              </div>
                              {/* Internal */}
                              {db.internalConnectionString && (
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-zinc-500">
                                      Internal (Docker)
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        copyConnectionString(
                                          `${db.id}-internal`,
                                          db.internalConnectionString!
                                        )
                                      }
                                      className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                                    >
                                      {copiedStrings[`${db.id}-internal`] ? (
                                        <Check className="h-3 w-3 mr-1" />
                                      ) : (
                                        <Copy className="h-3 w-3 mr-1" />
                                      )}
                                      Copy
                                    </Button>
                                  </div>
                                  <div className="p-2 rounded bg-zinc-950/50 border border-zinc-800/50">
                                    <code className="text-xs text-zinc-400 break-all">
                                      {db.internalConnectionString}
                                    </code>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Server Details */}
                        <div>
                          <Label className="text-sm font-medium text-zinc-300 mb-2">
                            Server Details
                          </Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-zinc-500">Host</Label>
                              <p className="text-xs text-zinc-300">{db.host}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-zinc-500">Port</Label>
                              <p className="text-xs text-zinc-300">{db.port}</p>
                            </div>
                            {db.username && (
                              <div>
                                <Label className="text-xs text-zinc-500">
                                  Username
                                </Label>
                                <p className="text-xs text-zinc-300">{db.username}</p>
                              </div>
                            )}
                            {db.password && (
                              <div>
                                <Label className="text-xs text-zinc-500">
                                  Password
                                </Label>
                                <div className="flex items-center gap-1">
                                  <p className="text-xs text-zinc-300">
                                    {showPasswords[db.id] ? db.password : "••••••••"}
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => togglePasswordVisibility(db.id)}
                                    className="h-5 w-5 p-0 text-zinc-500 hover:text-zinc-300"
                                  >
                                    {showPasswords[db.id] ? (
                                      <EyeOff className="h-3 w-3" />
                                    ) : (
                                      <Eye className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {db.status === "ERROR" && (
                      <div className="p-2 rounded bg-red-950/20 border border-red-900/30 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-red-400">
                            Database failed to start. Check logs for details.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
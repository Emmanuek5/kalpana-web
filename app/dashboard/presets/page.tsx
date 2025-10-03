"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Sidebar } from "@/components/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Settings2,
  Trash2,
  Pencil,
  Check,
  Copy,
  Search,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { NotificationBell } from "@/components/workspace/notification-bell";

interface Preset {
  id: string;
  name: string;
  description?: string;
  settings: string;
  extensions: string[];
  createdAt: string;
  updatedAt: string;
}

const defaultPresets = [
  {
    id: "default",
    name: "Default",
    description: "One Dark Pro theme with essential extensions",
    isBuiltIn: true,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Lightweight setup with only core tools",
    isBuiltIn: true,
  },
  {
    id: "fullstack",
    name: "Full Stack",
    description: "Complete setup for full-stack development",
    isBuiltIn: true,
  },
];

export default function PresetsPage() {
  const router = useRouter();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    settings: "{}",
    extensions: [] as string[],
  });
  const [extensionInput, setExtensionInput] = useState("");
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [marketQuery, setMarketQuery] = useState("");
  const [marketResults, setMarketResults] = useState<any[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketTyping, setMarketTyping] = useState(false);
  const [marketDebounceId, setMarketDebounceId] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<Preset | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await fetch("/api/presets");
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (error) {
      console.error("Error fetching presets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    try {
      const url = editingPreset
        ? `/api/presets/${editingPreset.id}`
        : "/api/presets";
      const method = editingPreset ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        fetchPresets();
        setShowDialog(false);
        resetForm();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to save preset");
      }
    } catch (error) {
      console.error("Error saving preset:", error);
      alert("Failed to save preset");
    }
  };

  const handleOpenDelete = (preset: Preset) => {
    setPresetToDelete(preset);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!presetToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/presets/${presetToDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchPresets();
        setDeleteDialogOpen(false);
        setPresetToDelete(null);
      } else {
        alert("Failed to delete preset");
      }
    } catch (error) {
      console.error("Error deleting preset:", error);
      alert("Failed to delete preset");
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (preset: Preset) => {
    setEditingPreset(preset);
    setFormData({
      name: preset.name,
      description: preset.description || "",
      settings: preset.settings,
      extensions: preset.extensions,
    });
    setShowDialog(true);
  };

  const handleDuplicate = (preset: Preset) => {
    setEditingPreset(null);
    setFormData({
      name: `${preset.name} (Copy)`,
      description: preset.description || "",
      settings: preset.settings,
      extensions: preset.extensions,
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingPreset(null);
    setFormData({
      name: "",
      description: "",
      settings: "{}",
      extensions: [],
    });
    setExtensionInput("");
  };

  const addExtension = () => {
    if (extensionInput.trim()) {
      setFormData({
        ...formData,
        extensions: [...formData.extensions, extensionInput.trim()],
      });
      setExtensionInput("");
    }
  };

  const addExtensionId = (id: string) => {
    const trimmed = (id || "").trim();
    if (!trimmed) return;
    if (formData.extensions.includes(trimmed)) return;
    setFormData({ ...formData, extensions: [...formData.extensions, trimmed] });
  };

  const searchMarketplace = async (override?: string) => {
    const q = (override ?? marketQuery).trim();
    if (!q) {
      setMarketResults([]);
      setMarketError(null);
      return;
    }
    try {
      setMarketLoading(true);
      setMarketError(null);
      const res = await fetch(
        `/api/extensions/search?q=${encodeURIComponent(q)}&size=24`
      );
      if (!res.ok) {
        setMarketError("Search failed");
        setMarketResults([]);
        return;
      }
      const data = await res.json();
      setMarketResults(Array.isArray(data.results) ? data.results : []);
    } catch (_e) {
      setMarketError("Search failed");
      setMarketResults([]);
    } finally {
      setMarketLoading(false);
    }
  };

  const removeExtension = (index: number) => {
    setFormData({
      ...formData,
      extensions: formData.extensions.filter((_, i) => i !== index),
    });
  };

  const filteredPresets = presets.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none" />

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-medium text-zinc-100">Presets</h1>
              <Badge
                variant="outline"
                className="bg-zinc-900/50 border-zinc-800 text-zinc-400 text-xs"
              >
                {presets.length}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <Button
                onClick={() => {
                  resetForm();
                  setShowDialog(true);
                }}
                className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Preset
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h2 className="text-sm font-medium text-zinc-400 mb-3">
                Built-in Presets
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {defaultPresets.map((preset) => (
                  <Card
                    key={preset.id}
                    className="p-5 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Settings2 className="h-5 w-5 text-emerald-400" />
                      <Badge
                        variant="outline"
                        className="border-zinc-800/60 bg-zinc-900/60 text-zinc-400"
                      >
                        Built-in
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-zinc-200 mb-1">
                      {preset.name}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {preset.description}
                    </p>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-medium text-zinc-400">
                  Custom Presets
                </h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="h-4 w-4 text-zinc-600 absolute left-2 top-1/2 -translate-y-1/2" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search presets"
                      className="pl-8 bg-zinc-950 border-zinc-800 h-9 w-56"
                    />
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="relative">
                    <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 animate-pulse" />
                    <Loader2 className="h-10 w-10 text-emerald-400 animate-spin relative z-10" />
                  </div>
                </div>
              ) : presets.length === 0 ? (
                <Card className="p-20 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 text-center backdrop-blur-xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="max-w-md mx-auto relative z-10">
                    <div className="relative mb-8 inline-block">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 blur-2xl animate-pulse" />
                      <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 border-zinc-700/50 flex items-center justify-center relative overflow-hidden">
                        <Settings2 className="h-12 w-12 text-zinc-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                      No presets yet
                    </h3>
                    <p className="text-zinc-500 mb-10 leading-relaxed text-base">
                      Create your first preset to quickly bootstrap VS Code
                      environments.
                    </p>
                    <Button
                      className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-2xl shadow-emerald-600/40 hover:shadow-emerald-600/60 hover:scale-105 px-8 py-6 text-base"
                      onClick={() => {
                        resetForm();
                        setShowDialog(true);
                      }}
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Create Your First Preset
                    </Button>
                  </div>
                </Card>
              ) : filteredPresets.length === 0 ? (
                <Card className="p-10 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 border-zinc-700/50 flex items-center justify-center mx-auto mb-4">
                      <Search className="h-7 w-7 text-zinc-600" />
                    </div>
                    <p className="text-zinc-400">
                      No presets match your search.
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPresets.map((preset) => (
                    <Card
                      key={preset.id}
                      className="p-5 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 hover:border-zinc-700/80 transition-all cursor-pointer backdrop-blur-xl relative overflow-hidden group hover:scale-[1.02] hover:shadow-2xl"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Settings2 className="h-5 w-5 text-emerald-400" />
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(preset)}
                            className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(preset)}
                            className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDelete(preset)}
                            className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <h3 className="font-semibold text-zinc-200 mb-1">
                        {preset.name}
                      </h3>
                      <p className="text-sm text-zinc-500 mb-3">
                        {preset.description || "No description"}
                      </p>
                      <Badge
                        variant="outline"
                        className="border-zinc-800/60 bg-zinc-900/60 text-zinc-400 text-xs"
                      >
                        {preset.extensions.length} extensions
                      </Badge>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800 !max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {editingPreset ? "Edit Preset" : "Create New Preset"}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Configure VS Code settings and extensions for this preset.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Preset Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="My Custom Preset"
                className="bg-zinc-950 border-zinc-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Description
              </label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of this preset"
                className="bg-zinc-950 border-zinc-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                VS Code Settings (JSON) *
              </label>
              <textarea
                value={formData.settings}
                onChange={(e) =>
                  setFormData({ ...formData, settings: e.target.value })
                }
                placeholder='{"workbench.colorTheme": "One Dark Pro", "editor.fontSize": 14}'
                className="w-full h-48 p-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none font-mono text-sm text-zinc-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Extensions
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={extensionInput}
                  onChange={(e) => setExtensionInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addExtension()}
                  placeholder="publisher.extension-name"
                  className="bg-zinc-950 border-zinc-800 flex-1"
                />
                <Button
                  type="button"
                  onClick={addExtension}
                  variant="outline"
                  className="border-zinc-700"
                >
                  Add
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowMarketplace(true)}
                  variant="outline"
                  className="border-zinc-700"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search Marketplace
                </Button>
              </div>
              {formData.extensions.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {formData.extensions.map((ext, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-zinc-950 rounded border border-zinc-800"
                    >
                      <span className="text-sm text-zinc-300 font-mono">
                        {ext}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExtension(index)}
                        className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleCreateOrUpdate}
                disabled={!formData.name || !formData.settings}
                className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500"
              >
                <Check className="h-4 w-4 mr-2" />
                {editingPreset ? "Update Preset" : "Create Preset"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
                className="border-zinc-700 hover:bg-zinc-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-zinc-100">
              Delete Preset
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Are you sure you want to delete "{presetToDelete?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-zinc-400">
                    This will permanently remove the preset and its
                    configuration.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-zinc-700/50 hover:bg-zinc-800/50 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/20"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Preset
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Marketplace Dialog */}
      <Dialog open={showMarketplace} onOpenChange={setShowMarketplace}>
        <DialogContent className="bg-zinc-900 border-zinc-800 !max-w-[60vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Search Extensions
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Results are powered by Open VSX. Click Add to include an extension
              id.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex gap-2">
              <Input
                value={marketQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setMarketQuery(val);
                  setMarketTyping(true);
                  if (marketDebounceId) clearTimeout(marketDebounceId);
                  const id = setTimeout(() => {
                    setMarketTyping(false);
                    searchMarketplace(val);
                  }, 450);
                  setMarketDebounceId(id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchMarketplace();
                }}
                placeholder="Search VS Marketplace (e.g. prettier, eslint, tailwind)"
                className="bg-zinc-950 border-zinc-800"
              />
              <Button
                type="button"
                onClick={() => searchMarketplace()}
                className="bg-emerald-500 text-white hover:bg-emerald-400"
                disabled={marketLoading}
              >
                {marketLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
            {marketError && (
              <div className="text-sm text-red-400">{marketError}</div>
            )}
            {marketLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Card
                    key={i}
                    className="p-4 bg-zinc-900/40 border-zinc-800/50"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {!marketLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {marketResults.map((item) => {
                  const isAdded = formData.extensions.includes(item.id);
                  return (
                    <Card
                      key={item.id}
                      className="p-4 bg-zinc-900/40 border-zinc-800/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-zinc-200 font-medium truncate">
                              {item.name}
                            </div>
                            {isAdded && (
                              <Badge
                                variant="outline"
                                className="border-zinc-700 text-zinc-400"
                              >
                                Added
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 truncate">
                            {item.id}
                          </div>
                          {item.description && (
                            <div className="text-xs text-zinc-500 mt-1 line-clamp-2">
                              {item.description}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-600">
                            <Badge
                              variant="outline"
                              className="border-zinc-800/60 bg-zinc-900/60 text-zinc-400"
                            >
                              {(item.downloadCount ?? 0).toLocaleString()}{" "}
                              downloads
                            </Badge>
                            {item.averageRating != null && (
                              <Badge
                                variant="outline"
                                className="border-zinc-800/60 bg-zinc-900/60 text-zinc-400"
                              >
                                {item.averageRating.toFixed(1)}★ rating
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => addExtensionId(item.id)}
                            disabled={isAdded}
                            className={
                              isAdded
                                ? "h-8 px-3 bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                : "h-8 px-3 bg-emerald-500 text-white hover:bg-emerald-400"
                            }
                          >
                            {isAdded ? "Added" : "Add"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
            {marketResults.length === 0 && !marketLoading && !marketError && (
              <div className="text-sm text-zinc-500">
                No results yet. Try a search.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

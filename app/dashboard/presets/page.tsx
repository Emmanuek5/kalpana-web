"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sidebar } from "@/components/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Settings2, Trash2, Pencil, Check, Copy } from "lucide-react";

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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this preset?")) return;

    try {
      const res = await fetch(`/api/presets/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchPresets();
      }
    } catch (error) {
      console.error("Error deleting preset:", error);
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

  const removeExtension = (index: number) => {
    setFormData({
      ...formData,
      extensions: formData.extensions.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none" />

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-medium text-zinc-100">
                VS Code Presets
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                Manage your custom VS Code configurations
              </p>
            </div>
            <Button
              onClick={() => {
                resetForm();
                setShowDialog(true);
              }}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Preset
            </Button>
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
                    className="p-5 bg-zinc-900/40 border-zinc-800/50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Settings2 className="h-5 w-5 text-emerald-500" />
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
              <h2 className="text-sm font-medium text-zinc-400 mb-3">
                Custom Presets
              </h2>
              {loading ? (
                <p className="text-zinc-500 text-sm">Loading presets...</p>
              ) : presets.length === 0 ? (
                <Card className="p-8 bg-zinc-900/40 border-zinc-800/50 text-center">
                  <Settings2 className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500 mb-4">No custom presets yet</p>
                  <Button
                    onClick={() => {
                      resetForm();
                      setShowDialog(true);
                    }}
                    variant="outline"
                    className="border-zinc-700 hover:bg-zinc-800"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Preset
                  </Button>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {presets.map((preset) => (
                    <Card
                      key={preset.id}
                      className="p-5 bg-zinc-900/40 border-zinc-800/50 group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Settings2 className="h-5 w-5 text-blue-500" />
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
                            onClick={() => handleDelete(preset.id)}
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
                      <div className="text-xs text-zinc-600">
                        {preset.extensions.length} extensions
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {editingPreset ? "Edit Preset" : "Create New Preset"}
            </DialogTitle>
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
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Save,
  Eye,
  EyeOff,
  Loader2,
  Star,
  Search,
  Check,
  ExternalLink,
  Sparkles,
  Github,
  Link as LinkIcon,
  Unlink,
  AlertCircle,
} from "lucide-react";

interface Model {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  pricing: {
    prompt: string;
    completion: string;
  };
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hasExistingApiKey, setHasExistingApiKey] = useState(false);
  const [favoriteModels, setFavoriteModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [filteredModels, setFilteredModels] = useState<Model[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUser, setGithubUser] = useState<{
    username: string;
    avatarUrl?: string;
    name?: string;
  } | null>(null);
  const [loadingGithub, setLoadingGithub] = useState(true);
  const [disconnectingGithub, setDisconnectingGithub] = useState(false);
  const [reconnectingGithub, setReconnectingGithub] = useState(false);
  const [githubError, setGithubError] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchModels();
    fetchGithubStatus();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = models.filter(
        (model) =>
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredModels(filtered);
    } else {
      setFilteredModels(models);
    }
  }, [searchQuery, models]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/user/settings");
      if (res.ok) {
        const data = await res.json();
        setFavoriteModels(data.favoriteModels || []);
        setDefaultModel(data.defaultModel || "");
        setHasExistingApiKey(data.hasApiKey || false);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch("/api/models");
      if (res.ok) {
        const data = await res.json();
        setModels(data.data || []);
        setFilteredModels(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching models:", error);
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchGithubStatus = async () => {
    setLoadingGithub(true);
    setGithubError(false);
    try {
      const res = await fetch("/api/user/github");
      if (res.ok) {
        const data = await res.json();
        setGithubConnected(data.connected);
        if (data.connected) {
          setGithubUser({
            username: data.username,
            avatarUrl: data.avatarUrl,
            name: data.name,
          });
        }
      } else {
        setGithubError(true);
      }
    } catch (error) {
      console.error("Error fetching GitHub status:", error);
      setGithubError(true);
    } finally {
      setLoadingGithub(false);
    }
  };

  const handleReconnectGithub = async () => {
    setReconnectingGithub(true);
    // Disconnect first
    try {
      await fetch("/api/user/github", { method: "DELETE" });
    } catch (error) {
      console.error("Error during reconnect:", error);
    }
    setReconnectingGithub(false);
    // Redirect to GitHub OAuth
    window.location.href =
      "/api/auth/signin/github?callbackURL=/dashboard/settings";
  };

  const handleDisconnectGithub = async () => {
    if (!confirm("Are you sure you want to disconnect your GitHub account?")) {
      return;
    }

    setDisconnectingGithub(true);
    try {
      const res = await fetch("/api/user/github", {
        method: "DELETE",
      });

      if (res.ok) {
        setGithubConnected(false);
        setGithubUser(null);
        alert("GitHub account disconnected successfully!");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to disconnect GitHub");
      }
    } catch (error) {
      console.error("Error disconnecting GitHub:", error);
      alert("Failed to disconnect GitHub");
    } finally {
      setDisconnectingGithub(false);
    }
  };

  const handleConnectGithub = () => {
    // Redirect to GitHub OAuth
    window.location.href =
      "/api/auth/signin/github?callbackURL=/dashboard/settings";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only include fields that should be updated
      const updateData: any = {
        favoriteModels,
        defaultModel,
      };

      // Only update API key if user entered something
      if (apiKey.trim()) {
        updateData.openrouterApiKey = apiKey;
      }

      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        const data = await res.json();
        setHasExistingApiKey(data.hasApiKey || false);
        setApiKey(""); // Clear input after save
        alert("Settings saved successfully!");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleFavorite = (modelId: string) => {
    if (favoriteModels.includes(modelId)) {
      setFavoriteModels(favoriteModels.filter((id) => id !== modelId));
      if (defaultModel === modelId) {
        setDefaultModel("");
      }
    } else {
      if (favoriteModels.length >= 10) {
        alert("Maximum 10 favorite models allowed");
        return;
      }
      setFavoriteModels([...favoriteModels, modelId]);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-zinc-950 overflow-hidden">
        {/* Background */}
        <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none" />

        <Sidebar />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar Skeleton */}
          <div className="border-b border-zinc-800/50 flex items-center justify-between px-6 py-4 bg-zinc-950/50 backdrop-blur-sm">
            <Skeleton className="h-6 w-32 bg-zinc-800/50" />
            <Skeleton className="h-9 w-24 bg-zinc-800/50" />
          </div>

          {/* Content Skeleton */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* API Key Card Skeleton */}
              <Card className="p-6 bg-zinc-900/40 border-zinc-800/50">
                <Skeleton className="h-6 w-48 mb-4 bg-zinc-800/50" />
                <div className="space-y-4">
                  <div>
                    <Skeleton className="h-4 w-32 mb-2 bg-zinc-800/50" />
                    <Skeleton className="h-10 w-full bg-zinc-800/50" />
                  </div>
                  <Skeleton className="h-4 w-64 bg-zinc-800/50" />
                </div>
              </Card>

              {/* Favorite Models Card Skeleton */}
              <Card className="p-6 bg-zinc-900/40 border-zinc-800/50">
                <Skeleton className="h-6 w-56 mb-2 bg-zinc-800/50" />
                <Skeleton className="h-4 w-96 mb-4 bg-zinc-800/50" />

                {/* Search Skeleton */}
                <Skeleton className="h-10 w-full mb-4 bg-zinc-800/50" />

                {/* Model Cards Skeleton */}
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="p-4 rounded-lg border border-zinc-800/50 bg-zinc-900/30"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Skeleton className="h-5 w-48 bg-zinc-800/50" />
                        <Skeleton className="h-8 w-20 bg-zinc-800/50" />
                      </div>
                      <Skeleton className="h-4 w-full mb-2 bg-zinc-800/50" />
                      <div className="flex gap-4">
                        <Skeleton className="h-4 w-32 bg-zinc-800/50" />
                        <Skeleton className="h-4 w-32 bg-zinc-800/50" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none" />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Minimal Top Bar */}
        <div className="border-b border-zinc-800/50 flex items-center justify-between px-6 py-4 bg-zinc-950/50 backdrop-blur-sm">
          <h1 className="text-lg font-medium text-zinc-100">Settings</h1>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-8 space-y-8">
            {/* API Key Section */}
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-medium text-zinc-100 mb-1">
                  OpenRouter API Key
                </h2>
                <p className="text-sm text-zinc-500">
                  Add your personal OpenRouter API key to use your own credits
                </p>
              </div>
              <Card className="p-6 bg-zinc-900/30 border-zinc-800/50 backdrop-blur-sm">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={hasExistingApiKey ? "Enter new key to update..." : "sk-or-v1-..."}
                        className="bg-zinc-900 border-zinc-800 focus:border-zinc-600 focus:ring-0 text-sm h-11"
                      />
                      {hasExistingApiKey && !apiKey && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-emerald-500 pointer-events-none">
                          ✓ API key saved
                        </div>
                      )}
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
                  >
                    Get your API key at OpenRouter
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </Card>
            </div>

            {/* GitHub Integration Section */}
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-medium text-zinc-100 mb-1">
                  GitHub Integration
                </h2>
                <p className="text-sm text-zinc-500">
                  Connect your GitHub account to clone private repos and push
                  changes from containers
                </p>
              </div>
              <Card className="p-6 bg-zinc-900/30 border-zinc-800/50 backdrop-blur-sm">
                {loadingGithub ? (
                  <div className="flex items-center gap-4">
                    <Loader2 className="h-5 w-5 text-zinc-600 animate-spin" />
                    <span className="text-sm text-zinc-500">
                      Loading GitHub status...
                    </span>
                  </div>
                ) : githubConnected && githubUser ? (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        {githubUser.avatarUrl && (
                          <img
                            src={githubUser.avatarUrl}
                            alt={githubUser.username}
                            className="w-12 h-12 rounded-full border-2 border-zinc-700"
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-zinc-200">
                              {githubUser.name || githubUser.username}
                            </span>
                            <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30 text-xs">
                              Connected
                            </Badge>
                          </div>
                          <a
                            href={`https://github.com/${githubUser.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zinc-500 hover:text-zinc-400 inline-flex items-center gap-1"
                          >
                            @{githubUser.username}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleReconnectGithub}
                          disabled={reconnectingGithub}
                          variant="outline"
                          size="sm"
                          className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                        >
                          {reconnectingGithub ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Reconnecting...
                            </>
                          ) : (
                            <>
                              <Github className="h-4 w-4 mr-2" />
                              Reconnect
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleDisconnectGithub}
                          disabled={disconnectingGithub}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
                        >
                          {disconnectingGithub ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Disconnecting...
                            </>
                          ) : (
                            <>
                              <Unlink className="h-4 w-4 mr-2" />
                              Disconnect
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {githubError && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-xs text-amber-400">
                          Having trouble accessing your GitHub account. Try
                          reconnecting.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
                      <AlertCircle className="h-5 w-5 text-zinc-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 text-sm text-zinc-400">
                        <p className="mb-2">
                          Connect your GitHub account to enable:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-xs text-zinc-500">
                          <li>Clone private repositories</li>
                          <li>Push changes from your workspaces</li>
                          <li>Seamless Git authentication in containers</li>
                        </ul>
                      </div>
                    </div>
                    <Button
                      onClick={handleConnectGithub}
                      className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    >
                      <Github className="h-4 w-4 mr-2" />
                      Connect GitHub Account
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            {/* Favorite Models Section */}
            <div>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-medium text-zinc-100 mb-1">
                    Favorite Models
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Select up to 10 models for quick access
                  </p>
                </div>
                <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700">
                  {favoriteModels.length}/10
                </Badge>
              </div>

              <Card className="p-6 bg-zinc-900/30 border-zinc-800/50 backdrop-blur-sm">
                {/* Search */}
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search models by name or ID..."
                      className="bg-zinc-900 border-zinc-800 focus:border-zinc-600 focus:ring-0 pl-10 text-sm h-11"
                    />
                  </div>
                </div>

                {/* Favorites List */}
                {favoriteModels.length > 0 && (
                  <div className="mb-6 pb-6 border-b border-zinc-800">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="h-4 w-4 text-zinc-500" />
                      <h3 className="text-sm font-medium text-zinc-400">
                        Your Favorites
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {favoriteModels.map((modelId) => {
                        const model = models.find((m) => m.id === modelId);
                        if (!model) return null;
                        return (
                          <div
                            key={modelId}
                            className="flex items-center gap-3 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors group"
                          >
                            <Star className="h-4 w-4 text-zinc-400 fill-zinc-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-zinc-200">
                                {model.name}
                              </div>
                              <div className="text-xs text-zinc-600 truncate">
                                {model.id}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (defaultModel === modelId) {
                                    setDefaultModel("");
                                  } else {
                                    setDefaultModel(modelId);
                                  }
                                }}
                                className={`text-xs h-8 ${
                                  defaultModel === modelId
                                    ? "bg-zinc-800 text-zinc-300"
                                    : "text-zinc-500 hover:text-zinc-300"
                                }`}
                              >
                                {defaultModel === modelId && (
                                  <Check className="h-3 w-3 mr-1" />
                                )}
                                {defaultModel === modelId
                                  ? "Default"
                                  : "Set Default"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleFavorite(modelId)}
                                className="text-xs h-8 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Models List */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-500 mb-4">
                    Available Models
                  </h3>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {loadingModels ? (
                      <div className="text-center py-16">
                        <Loader2 className="h-6 w-6 text-zinc-600 animate-spin mx-auto mb-3" />
                        <p className="text-sm text-zinc-600">
                          Loading models...
                        </p>
                      </div>
                    ) : filteredModels.length === 0 ? (
                      <div className="text-center py-16 text-zinc-600">
                        <p className="text-sm">No models found</p>
                      </div>
                    ) : (
                      filteredModels.map((model) => {
                        const isFavorite = favoriteModels.includes(model.id);
                        if (isFavorite) return null;

                        return (
                          <div
                            key={model.id}
                            className="group flex items-start gap-3 p-4 rounded-lg border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900/30 transition-all"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-zinc-300 truncate">
                                {model.name}
                              </div>
                              <div className="text-xs text-zinc-600 truncate mb-2">
                                {model.id}
                              </div>
                              {model.description && (
                                <div className="text-xs text-zinc-600 leading-relaxed line-clamp-2 mb-3">
                                  {model.description}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Badge className="bg-zinc-900 text-zinc-500 border-zinc-800 text-xs font-normal">
                                  {model.contextLength.toLocaleString()} tokens
                                </Badge>
                                <Badge className="bg-zinc-900 text-zinc-500 border-zinc-800 text-xs font-normal">
                                  ${model.pricing.prompt}/1M
                                </Badge>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleFavorite(model.id)}
                              className="text-zinc-600 hover:text-zinc-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </div>
  );
}

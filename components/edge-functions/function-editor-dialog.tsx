"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Globe, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
}

interface EdgeFunction {
  id: string;
  name: string;
  description?: string;
  code?: string;
  handler?: string;
  runtime: string;
  timeout: number;
  memory: number;
  subdomain?: string;
  path?: string;
  domainId?: string;
  triggerType: string;
  envVars?: Record<string, string>;
}

interface FunctionEditorDialogProps {
  function?: EdgeFunction | null;
  onClose: () => void;
}

const DEFAULT_CODE = `// Edge function handler
async function handler(request) {
  const { method, url, headers, body, query } = request;
  
  // Your code here
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Hello from edge function!',
      method,
      url,
    }),
  };
}`;

export function FunctionEditorDialog({
  function: editFunction,
  onClose,
}: FunctionEditorDialogProps) {
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [formData, setFormData] = useState({
    name: editFunction?.name || "",
    description: editFunction?.description || "",
    code: editFunction?.code || DEFAULT_CODE,
    handler: editFunction?.handler || "handler",
    runtime: editFunction?.runtime || "JAVASCRIPT",
    timeout: editFunction?.timeout || 10000,
    memory: editFunction?.memory || 128,
    subdomain: editFunction?.subdomain || "",
    path: editFunction?.path || "",
    domainId: editFunction?.domainId || "",
    triggerType: editFunction?.triggerType || "HTTP",
  });
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
    editFunction?.envVars
      ? Object.entries(editFunction.envVars).map(([key, value]) => ({
          key,
          value,
        }))
      : []
  );

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      const response = await fetch("/api/domains");
      if (!response.ok) throw new Error("Failed to load domains");
      const data = await response.json();
      setDomains(data.domains || []);
    } catch (error) {
      console.error("Error loading domains:", error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.code) {
      toast.error("Name and code are required");
      return;
    }

    setLoading(true);
    try {
      // Convert env vars array to object
      const envVarsObj = envVars.reduce((acc, { key, value }) => {
        if (key) acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      const payload = {
        ...formData,
        domainId: formData.domainId || undefined,
        envVars: Object.keys(envVarsObj).length > 0 ? envVarsObj : undefined,
      };

      const url = editFunction
        ? `/api/edge-functions/${editFunction.id}`
        : "/api/edge-functions";
      const method = editFunction ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save function");
      }

      toast.success(
        editFunction
          ? "Function updated successfully"
          : "Function created successfully"
      );
      onClose();
    } catch (error: any) {
      console.error("Error saving function:", error);
      toast.error(error.message || "Failed to save function");
    } finally {
      setLoading(false);
    }
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "" }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">
              {editFunction ? "Edit Function" : "Create Edge Function"}
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              Serverless function with instant execution
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-300"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Info Banner */}
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-400">
              💡 Configure your serverless function with custom domains, environment variables, and resource limits.
            </p>
          </div>
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-300">Function Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="my-function"
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Handler Function</Label>
              <Input
                value={formData.handler}
                onChange={(e) =>
                  setFormData({ ...formData, handler: e.target.value })
                }
                placeholder="handler"
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              />
            </div>
          </div>

          <div>
            <Label className="text-zinc-300">Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="What does this function do?"
              className="bg-zinc-800 border-zinc-700 text-zinc-200"
              rows={2}
            />
          </div>

          {/* Code Editor */}
          <div>
            <Label className="text-zinc-300 mb-2 block">Function Code *</Label>
            <div className="border border-zinc-700 rounded-lg overflow-hidden">
              <Editor
                height="400px"
                defaultLanguage="javascript"
                value={formData.code}
                onChange={(value) =>
                  setFormData({ ...formData, code: value || "" })
                }
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>

          {/* Configuration */}
          <div className="border-t border-zinc-800 pt-6">
            <h3 className="text-sm font-medium text-zinc-200 mb-4">⚙️ Runtime Configuration</h3>
            <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-zinc-300">Runtime</Label>
              <Select
                value={formData.runtime}
                onValueChange={(value) =>
                  setFormData({ ...formData, runtime: value })
                }
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="JAVASCRIPT">JavaScript</SelectItem>
                  <SelectItem value="TYPESCRIPT">TypeScript</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-300">Timeout (ms)</Label>
              <Input
                type="number"
                value={formData.timeout}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    timeout: parseInt(e.target.value) || 10000,
                  })
                }
                min={1000}
                max={30000}
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Memory (MB)</Label>
              <Input
                type="number"
                value={formData.memory}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    memory: parseInt(e.target.value) || 128,
                  })
                }
                min={64}
                max={512}
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              />
            </div>
            </div>
            <div className="mt-4">
              <Label className="text-zinc-300">Trigger Type</Label>
              <Select
                value={formData.triggerType}
                onValueChange={(value) =>
                  setFormData({ ...formData, triggerType: value })
                }
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="HTTP">HTTP Request</SelectItem>
                  <SelectItem value="CRON">Scheduled (CRON)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Domain Configuration */}
          <div className="border-t border-zinc-800 pt-6">
            <h3 className="text-sm font-medium text-zinc-200 mb-4">🌐 Domain Configuration</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Link this function to a custom domain. Leave empty to use the default endpoint.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-zinc-300">Domain</Label>
                <Select
                  value={formData.domainId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, domainId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                    <SelectValue placeholder="No domain" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="none">No domain (use default endpoint)</SelectItem>
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
              {formData.domainId && formData.domainId !== "none" && (
                <>
                  <div>
                    <Label className="text-zinc-300">Subdomain</Label>
                    <Input
                      value={formData.subdomain}
                      onChange={(e) =>
                        setFormData({ ...formData, subdomain: e.target.value })
                      }
                      placeholder="api"
                      className="bg-zinc-800 border-zinc-700 text-zinc-200"
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Path</Label>
                    <Input
                      value={formData.path}
                      onChange={(e) =>
                        setFormData({ ...formData, path: e.target.value })
                      }
                      placeholder="/webhook"
                      className="bg-zinc-800 border-zinc-700 text-zinc-200"
                    />
                  </div>
                </>
              )}
            </div>
            {formData.domainId && formData.subdomain && (
              <div className="mt-2 text-sm text-zinc-500">
                Will be accessible at:{" "}
                <span className="text-emerald-400">
                  https://{formData.subdomain}.
                  {domains.find((d) => d.id === formData.domainId)?.domain}
                  {formData.path || "/"}
                </span>
              </div>
            )}
          </div>

          {/* Environment Variables */}
          <div className="border-t border-zinc-800 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-zinc-200">🔐 Environment Variables</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Securely store API keys, secrets, and configuration values
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addEnvVar}
                className="border-zinc-700 text-zinc-300"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Variable
              </Button>
            </div>
            {envVars.length === 0 ? (
              <div className="p-8 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-center">
                <p className="text-sm text-zinc-500">No environment variables added yet</p>
                <p className="text-xs text-zinc-600 mt-1">Click "Add Variable" to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {envVars.map((envVar, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={envVar.key}
                      onChange={(e) =>
                        updateEnvVar(index, "key", e.target.value)
                      }
                      placeholder="KEY"
                      className="bg-zinc-800 border-zinc-700 text-zinc-200"
                    />
                    <Input
                      value={envVar.value}
                      onChange={(e) =>
                        updateEnvVar(index, "value", e.target.value)
                      }
                      placeholder="value"
                      type="password"
                      className="bg-zinc-800 border-zinc-700 text-zinc-200"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeEnvVar(index)}
                      className="text-red-500 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-zinc-700 text-zinc-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.name || !formData.code}
            className="bg-emerald-600/90 hover:bg-emerald-500 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {editFunction ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>{editFunction ? "Update Function" : "Create Function"}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

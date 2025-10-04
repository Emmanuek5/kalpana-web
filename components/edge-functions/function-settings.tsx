"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, Eye, EyeOff, Save, Globe, Settings } from "lucide-react";
import { toast } from "sonner";
import { DomainManagerDialog } from "./domain-manager-dialog";

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
}

interface FunctionSettingsProps {
  functionId: string;
  initialData: any;
  onUpdate: () => void;
}

export function FunctionSettings({ functionId, initialData, onUpdate }: FunctionSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [showEnvValues, setShowEnvValues] = useState<Record<number, boolean>>({});
  const [showDomainManager, setShowDomainManager] = useState(false);
  
  const [formData, setFormData] = useState({
    name: initialData.name || "",
    description: initialData.description || "",
    handler: initialData.handler || "handler",
    runtime: initialData.runtime || "JAVASCRIPT",
    timeout: initialData.timeout || 10000,
    memory: initialData.memory || 128,
    triggerType: initialData.triggerType || "HTTP",
    subdomain: initialData.subdomain || "",
    path: initialData.path || "",
    domainId: initialData.domainId || "",
  });

  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
    initialData.envVars
      ? Object.entries(initialData.envVars).map(([key, value]) => ({
          key,
          value: value as string,
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

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "" }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, field: "key" | "value", value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  const toggleShowEnvValue = (index: number) => {
    setShowEnvValues((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    setLoading(true);
    try {
      const envVarsObj = envVars.reduce((acc, { key, value }) => {
        if (key) acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      const payload = {
        ...formData,
        domainId: formData.domainId || undefined,
        envVars: Object.keys(envVarsObj).length > 0 ? envVarsObj : undefined,
      };

      const response = await fetch(`/api/edge-functions/${functionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update function");
      }

      toast.success("Settings updated successfully!");
      onUpdate();
    } catch (error: any) {
      console.error("Error updating function:", error);
      toast.error(error.message || "Failed to update function");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card className="p-6 bg-zinc-900/50 border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-200 mb-4">Basic Information</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-zinc-300">Function Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="my-function"
              className="bg-zinc-800 border-zinc-700 text-zinc-200 mt-2"
            />
          </div>

          <div>
            <Label className="text-zinc-300">Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What does this function do?"
              className="bg-zinc-800 border-zinc-700 text-zinc-200 mt-2"
              rows={3}
            />
          </div>

          <div>
            <Label className="text-zinc-300">Handler Function</Label>
            <Input
              value={formData.handler}
              onChange={(e) => setFormData({ ...formData, handler: e.target.value })}
              placeholder="handler"
              className="bg-zinc-800 border-zinc-700 text-zinc-200 mt-2"
            />
            <p className="text-xs text-zinc-500 mt-1">
              The exported function name in your code
            </p>
          </div>
        </div>
      </Card>

      {/* Runtime Configuration */}
      <Card className="p-6 bg-zinc-900/50 border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-200 mb-4">Runtime Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-zinc-300">Runtime</Label>
            <Select
              value={formData.runtime}
              onValueChange={(value) => setFormData({ ...formData, runtime: value })}
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="JAVASCRIPT">JavaScript</SelectItem>
                <SelectItem value="TYPESCRIPT">TypeScript</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-zinc-300">Trigger Type</Label>
            <Select
              value={formData.triggerType}
              onValueChange={(value) => setFormData({ ...formData, triggerType: value })}
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="HTTP">HTTP Request</SelectItem>
                <SelectItem value="CRON">Scheduled (CRON)</SelectItem>
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
              className="bg-zinc-800 border-zinc-700 text-zinc-200 mt-2"
            />
            <p className="text-xs text-zinc-500 mt-1">Between 1,000ms and 30,000ms</p>
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
              className="bg-zinc-800 border-zinc-700 text-zinc-200 mt-2"
            />
            <p className="text-xs text-zinc-500 mt-1">Between 64MB and 512MB</p>
          </div>
        </div>
      </Card>

      {/* Domain Configuration */}
      <Card className="p-6 bg-zinc-900/50 border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-medium text-zinc-200">Domain Configuration</h3>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowDomainManager(true)}
            className="border-zinc-700 text-zinc-300"
          >
            <Settings className="h-4 w-4 mr-1" />
            Manage Domains
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-zinc-300">Domain</Label>
            <Select
              value={formData.domainId || "none"}
              onValueChange={(value) =>
                setFormData({ ...formData, domainId: value === "none" ? "" : value })
              }
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200 mt-2">
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
              </SelectContent>
            </Select>
          </div>

          {formData.domainId && formData.domainId !== "none" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-300">Subdomain</Label>
                <Input
                  value={formData.subdomain}
                  onChange={(e) =>
                    setFormData({ ...formData, subdomain: e.target.value })
                  }
                  placeholder="api"
                  className="bg-zinc-800 border-zinc-700 text-zinc-200 mt-2"
                />
              </div>

              <div>
                <Label className="text-zinc-300">Path</Label>
                <Input
                  value={formData.path}
                  onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                  placeholder="/webhook"
                  className="bg-zinc-800 border-zinc-700 text-zinc-200 mt-2"
                />
              </div>
            </div>
          )}

          {formData.domainId && formData.subdomain && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-zinc-400">Accessible at:</p>
              <code className="text-sm text-emerald-400">
                https://{formData.subdomain}.
                {domains.find((d) => d.id === formData.domainId)?.domain}
                {formData.path || "/"}
              </code>
            </div>
          )}
        </div>
      </Card>

      {/* Environment Variables */}
      <Card className="p-6 bg-zinc-900/50 border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-200">Environment Variables</h3>
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
            <p className="text-sm text-zinc-500">No environment variables configured</p>
          </div>
        ) : (
          <div className="space-y-3">
            {envVars.map((envVar, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Input
                    value={envVar.key}
                    onChange={(e) => updateEnvVar(index, "key", e.target.value)}
                    placeholder="KEY"
                    className="bg-zinc-800 border-zinc-700 text-zinc-200"
                  />
                </div>
                <div className="flex-1 relative">
                  <Input
                    value={envVar.value}
                    onChange={(e) => updateEnvVar(index, "value", e.target.value)}
                    placeholder="value"
                    type={showEnvValues[index] ? "text" : "password"}
                    className="bg-zinc-800 border-zinc-700 text-zinc-200 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowEnvValue(index)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showEnvValues[index] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
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
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={loading || !formData.name}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {loading ? (
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

      {/* Domain Manager Dialog */}
      <DomainManagerDialog
        open={showDomainManager}
        onOpenChange={setShowDomainManager}
        onDomainAdded={loadDomains}
      />
    </div>
  );
}

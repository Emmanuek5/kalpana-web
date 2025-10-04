"use client";

import { useState } from "react";
import { X, ArrowRight, ArrowLeft, Check, Code, Settings, Globe, Lock } from "lucide-react";
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

interface CreateFunctionWizardProps {
  onClose: () => void;
  domains: Domain[];
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

const STEPS = [
  { id: 1, name: "Basic Info", icon: Code },
  { id: 2, name: "Configuration", icon: Settings },
  { id: 3, name: "Domain & Routing", icon: Globe },
  { id: 4, name: "Environment", icon: Lock },
];

export function CreateFunctionWizard({ onClose, domains }: CreateFunctionWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    code: DEFAULT_CODE,
    handler: "handler",
    runtime: "JAVASCRIPT",
    timeout: 10000,
    memory: 128,
    triggerType: "HTTP",
    subdomain: "",
    path: "",
    domainId: "",
  });

  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);

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

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name && formData.code;
      case 2:
        return true; // Configuration is optional
      case 3:
        return true; // Domain is optional
      case 4:
        return true; // Env vars are optional
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.code) {
      toast.error("Name and code are required");
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

      const response = await fetch("/api/edge-functions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create function");
      }

      toast.success("Function created successfully!");
      onClose();
    } catch (error: any) {
      console.error("Error creating function:", error);
      toast.error(error.message || "Failed to create function");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Create Edge Function</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].name}
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

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        isCompleted
                          ? "bg-emerald-500 border-emerald-500"
                          : isActive
                          ? "bg-emerald-500/20 border-emerald-500"
                          : "bg-zinc-800 border-zinc-700"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5 text-white" />
                      ) : (
                        <Icon
                          className={`h-5 w-5 ${
                            isActive ? "text-emerald-400" : "text-zinc-500"
                          }`}
                        />
                      )}
                    </div>
                    <div className="hidden md:block">
                      <div
                        className={`text-sm font-medium ${
                          isActive ? "text-zinc-100" : "text-zinc-500"
                        }`}
                      >
                        {step.name}
                      </div>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-4 ${
                        isCompleted ? "bg-emerald-500" : "bg-zinc-800"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div>
                <Label className="text-zinc-300">Function Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="my-function"
                  className="bg-zinc-800 border-zinc-700 text-zinc-200 mt-2"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Use lowercase letters, numbers, hyphens, and underscores
                </p>
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
                <Label className="text-zinc-300 mb-2 block">Function Code *</Label>
                <div className="border border-zinc-700 rounded-lg overflow-hidden">
                  <Editor
                    height="400px"
                    defaultLanguage="javascript"
                    value={formData.code}
                    onChange={(value) => setFormData({ ...formData, code: value || "" })}
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
          )}

          {/* Step 2: Configuration */}
          {currentStep === 2 && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="grid grid-cols-2 gap-6">
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
              </div>

              <div className="grid grid-cols-2 gap-6">
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

              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-400">
                  💡 These settings control how your function executes. Higher values may increase costs.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Domain & Routing */}
          {currentStep === 3 && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div>
                <Label className="text-zinc-300">Domain</Label>
                <Select
                  value={formData.domainId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, domainId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200 mt-2">
                    <SelectValue placeholder="No domain (use default endpoint)" />
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
                <p className="text-xs text-zinc-500 mt-1">
                  Link this function to a custom domain or skip to use the default endpoint
                </p>
              </div>

              {formData.domainId && formData.domainId !== "none" && (
                <>
                  <div className="grid grid-cols-2 gap-6">
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

                  {formData.subdomain && (
                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-sm text-zinc-400">
                        Your function will be accessible at:
                      </p>
                      <code className="text-sm text-emerald-400 mt-1 block">
                        https://{formData.subdomain}.
                        {domains.find((d) => d.id === formData.domainId)?.domain}
                        {formData.path || "/"}
                      </code>
                    </div>
                  )}
                </>
              )}

              {(!formData.domainId || formData.domainId === "none") && (
                <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                  <p className="text-sm text-zinc-400">
                    Without a custom domain, your function will be accessible via the default endpoint after creation.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Environment Variables */}
          {currentStep === 4 && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-zinc-200">Environment Variables</h3>
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
                  <Lock className="h-4 w-4 mr-1" />
                  Add Variable
                </Button>
              </div>

              {envVars.length === 0 ? (
                <div className="p-12 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-center">
                  <Lock className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
                  <p className="text-sm text-zinc-500">No environment variables added yet</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Click "Add Variable" to securely store secrets
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {envVars.map((envVar, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <Input
                          value={envVar.key}
                          onChange={(e) => updateEnvVar(index, "key", e.target.value)}
                          placeholder="KEY"
                          className="bg-zinc-800 border-zinc-700 text-zinc-200"
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          value={envVar.value}
                          onChange={(e) => updateEnvVar(index, "value", e.target.value)}
                          placeholder="value"
                          type="password"
                          className="bg-zinc-800 border-zinc-700 text-zinc-200"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeEnvVar(index)}
                        className="text-red-500 hover:text-red-400 mt-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-400">
                  🔒 Environment variables are encrypted and stored securely. They can be edited later in the function settings.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? onClose : handleBack}
            className="border-zinc-700 text-zinc-300"
            disabled={loading}
          >
            {currentStep === 1 ? (
              <>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </>
            )}
          </Button>

          <div className="text-sm text-zinc-500">
            Step {currentStep} of {STEPS.length}
          </div>

          {currentStep < STEPS.length ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className="bg-emerald-600/90 hover:bg-emerald-500 text-white"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || loading}
              className="bg-emerald-600/90 hover:bg-emerald-500 text-white"
            >
              {loading ? "Creating..." : "Create Function"}
              <Check className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

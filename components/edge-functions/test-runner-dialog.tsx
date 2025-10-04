"use client";

import { useState } from "react";
import { X, Play, Loader2, Clock, AlertCircle, CheckCircle } from "lucide-react";
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

interface EdgeFunction {
  id: string;
  name: string;
}

interface TestRunnerDialogProps {
  function: EdgeFunction;
  onClose: () => void;
}

interface TestResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  duration: number;
  error?: string;
  errorStack?: string;
}

export function TestRunnerDialog({ function: func, onClose }: TestRunnerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/");
  const [headers, setHeaders] = useState("{}");
  const [body, setBody] = useState("");
  const [queryParams, setQueryParams] = useState("{}");

  const handleTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Parse JSON inputs
      let parsedHeaders = {};
      let parsedQuery = {};

      try {
        parsedHeaders = JSON.parse(headers || "{}");
      } catch (e) {
        throw new Error("Invalid JSON in headers");
      }

      try {
        parsedQuery = JSON.parse(queryParams || "{}");
      } catch (e) {
        throw new Error("Invalid JSON in query parameters");
      }

      const response = await fetch(`/api/edge-functions/${func.id}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          path,
          headers: parsedHeaders,
          body: body || undefined,
          queryParams: parsedQuery,
        }),
      });

      const data = await response.json();
      setResult(data);

      if (data.error) {
        toast.error("Function execution failed");
      } else {
        toast.success("Function executed successfully");
      }
    } catch (error: any) {
      console.error("Error testing function:", error);
      toast.error(error.message || "Failed to test function");
      setResult({
        statusCode: 500,
        headers: {},
        body: JSON.stringify({ error: error.message }),
        duration: 0,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatJSON = (str: string) => {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch (e) {
      return str;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">
              Test Function: {func.name}
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              Execute your function with custom inputs
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
          {/* Request Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-zinc-300">Request Configuration</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-300">HTTP Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-zinc-300">Path</Label>
                <Input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/"
                  className="bg-zinc-800 border-zinc-700 text-zinc-200"
                />
              </div>
            </div>

            <div>
              <Label className="text-zinc-300">Headers (JSON)</Label>
              <Textarea
                value={headers}
                onChange={(e) => setHeaders(e.target.value)}
                placeholder='{"Content-Type": "application/json"}'
                className="bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-sm"
                rows={3}
              />
            </div>

            <div>
              <Label className="text-zinc-300">Query Parameters (JSON)</Label>
              <Textarea
                value={queryParams}
                onChange={(e) => setQueryParams(e.target.value)}
                placeholder='{"key": "value"}'
                className="bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-sm"
                rows={3}
              />
            </div>

            {method !== "GET" && method !== "HEAD" && (
              <div>
                <Label className="text-zinc-300">Request Body</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder='{"data": "example"}'
                  className="bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-sm"
                  rows={5}
                />
              </div>
            )}

            <Button
              onClick={handleTest}
              disabled={loading}
              className="w-full bg-emerald-600/90 hover:bg-emerald-500 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Test
                </>
              )}
            </Button>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4 border-t border-zinc-800 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-300">Response</h3>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-zinc-400">
                    <Clock className="h-4 w-4" />
                    {result.duration}ms
                  </div>
                  {result.error ? (
                    <div className="flex items-center gap-1 text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      Error
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="h-4 w-4" />
                      Success
                    </div>
                  )}
                </div>
              </div>

              {/* Status Code */}
              <div>
                <Label className="text-zinc-300">Status Code</Label>
                <div
                  className={`mt-1 p-3 rounded-lg font-mono text-sm ${
                    result.statusCode >= 200 && result.statusCode < 300
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {result.statusCode}
                </div>
              </div>

              {/* Headers */}
              {Object.keys(result.headers).length > 0 && (
                <div>
                  <Label className="text-zinc-300">Response Headers</Label>
                  <pre className="mt-1 p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-xs overflow-x-auto">
                    {formatJSON(JSON.stringify(result.headers))}
                  </pre>
                </div>
              )}

              {/* Body */}
              <div>
                <Label className="text-zinc-300">Response Body</Label>
                <pre className="mt-1 p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-xs overflow-x-auto max-h-64 overflow-y-auto">
                  {formatJSON(result.body)}
                </pre>
              </div>

              {/* Error Stack */}
              {result.errorStack && (
                <div>
                  <Label className="text-zinc-300">Error Stack Trace</Label>
                  <pre className="mt-1 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-xs overflow-x-auto max-h-64 overflow-y-auto">
                    {result.errorStack}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-zinc-700 text-zinc-300"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

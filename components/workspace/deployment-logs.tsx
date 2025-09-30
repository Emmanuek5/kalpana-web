"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Loader2, RefreshCw, Pause, Play } from "lucide-react";

interface DeploymentLogsProps {
  deploymentId: string;
  deploymentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeploymentLogs({
  deploymentId,
  deploymentName,
  open,
  onOpenChange,
}: DeploymentLogsProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [paused, setPaused] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (open) {
      fetchLogs();
    } else {
      stopStreaming();
    }

    return () => {
      stopStreaming();
    };
  }, [open]);

  useEffect(() => {
    if (logsRef.current && !paused) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs, paused]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/deployments/${deploymentId}/logs?tail=200`);
      if (res.ok) {
        const data = await res.json();
        const logLines = data.logs.split("\n").filter((l: string) => l.trim());
        setLogs(logLines);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const startStreaming = () => {
    stopStreaming();
    setStreaming(true);

    const eventSource = new EventSource(
      `/api/deployments/${deploymentId}/logs?follow=true&tail=50`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.log) {
          const logLines = data.log.split("\n").filter((l: string) => l.trim());
          setLogs((prev) => [...prev, ...logLines]);
        }
      } catch (e) {
        console.error("Error parsing log event:", e);
      }
    };

    eventSource.onerror = () => {
      console.error("EventSource error");
      stopStreaming();
    };

    eventSourceRef.current = eventSource;
  };

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStreaming(false);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const togglePause = () => {
    setPaused(!paused);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-6xl h-[700px] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-400" />
              Logs - {deploymentName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={togglePause}
                className="text-zinc-400 hover:text-zinc-100"
              >
                {paused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearLogs}
                className="text-zinc-400 hover:text-zinc-100"
              >
                Clear
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={fetchLogs}
                disabled={loading}
                className="text-zinc-400 hover:text-zinc-100"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              {streaming ? (
                <Button
                  size="sm"
                  onClick={stopStreaming}
                  className="bg-red-600 hover:bg-red-500"
                >
                  Stop Stream
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={startStreaming}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  Live Stream
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Logs Display */}
        <div
          ref={logsRef}
          className="flex-1 bg-black border border-zinc-800 rounded-lg p-4 overflow-auto font-mono text-xs"
        >
          {logs.length === 0 ? (
            <div className="text-zinc-600 text-sm">
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading logs...</span>
                </div>
              ) : (
                <p>No logs available. Click "Live Stream" to watch in real-time.</p>
              )}
            </div>
          ) : (
            logs.map((line, i) => (
              <div
                key={i}
                className={
                  line.toLowerCase().includes("error") ||
                  line.toLowerCase().includes("fail")
                    ? "text-red-400"
                    : line.toLowerCase().includes("warn")
                    ? "text-yellow-400"
                    : "text-zinc-300"
                }
              >
                {line}
              </div>
            ))
          )}
          {streaming && (
            <div className="flex items-center gap-2 text-emerald-500 mt-2 animate-pulse">
              <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
              <span className="text-xs">Streaming live...</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-600 pt-2">
          <span>
            {logs.length} {logs.length === 1 ? "line" : "lines"}
          </span>
          {streaming && <span className="text-emerald-500">Live streaming enabled</span>}
          {paused && <span className="text-yellow-500">Auto-scroll paused</span>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
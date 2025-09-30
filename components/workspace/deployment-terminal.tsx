"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Terminal, Loader2, X } from "lucide-react";

interface DeploymentTerminalProps {
  deploymentId: string;
  deploymentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeploymentTerminal({
  deploymentId,
  deploymentName,
  open,
  onOpenChange,
}: DeploymentTerminalProps) {
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<
    Array<{ type: "command" | "output" | "error"; text: string }>
  >([]);
  const [executing, setExecuting] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const executeCommand = async () => {
    if (!command.trim() || executing) return;

    const cmd = command;
    setCommand("");
    setOutput((prev) => [...prev, { type: "command", text: `$ ${cmd}` }]);
    setExecuting(true);

    try {
      const res = await fetch(`/api/deployments/${deploymentId}/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.stdout) {
          setOutput((prev) => [
            ...prev,
            { type: "output", text: data.stdout.trim() },
          ]);
        }
        
        if (data.stderr) {
          setOutput((prev) => [
            ...prev,
            { type: "error", text: data.stderr.trim() },
          ]);
        }

        if (data.exitCode !== 0) {
          setOutput((prev) => [
            ...prev,
            { type: "error", text: `Exit code: ${data.exitCode}` },
          ]);
        }
      } else {
        const error = await res.json();
        setOutput((prev) => [
          ...prev,
          { type: "error", text: `Error: ${error.error || "Command failed"}` },
        ]);
      }
    } catch (error) {
      setOutput((prev) => [
        ...prev,
        { type: "error", text: "Failed to execute command" },
      ]);
    } finally {
      setExecuting(false);
    }
  };

  const clearOutput = () => {
    setOutput([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-4xl h-[600px] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-emerald-400" />
              Terminal - {deploymentName}
            </DialogTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearOutput}
              className="text-zinc-400 hover:text-zinc-100"
            >
              Clear
            </Button>
          </div>
        </DialogHeader>

        {/* Output Area */}
        <div
          ref={outputRef}
          className="flex-1 bg-black border border-zinc-800 rounded-lg p-4 overflow-auto font-mono text-sm"
        >
          {output.length === 0 ? (
            <div className="text-zinc-600">
              <p>Terminal ready. Type a command and press Enter.</p>
              <p className="mt-2 text-xs">
                Common commands: <code>ls</code>, <code>pwd</code>,{" "}
                <code>cat file.txt</code>, <code>env</code>
              </p>
            </div>
          ) : (
            output.map((line, i) => (
              <div
                key={i}
                className={
                  line.type === "command"
                    ? "text-emerald-400 font-semibold"
                    : line.type === "error"
                    ? "text-red-400"
                    : "text-zinc-300"
                }
              >
                {line.text.split("\n").map((l, j) => (
                  <div key={j}>{l || "\u00A0"}</div>
                ))}
              </div>
            ))
          )}
          {executing && (
            <div className="flex items-center gap-2 text-zinc-500 mt-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Executing...</span>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex items-center gap-2 pt-2">
          <div className="flex-1 flex items-center bg-black border border-zinc-800 rounded-lg px-3 py-2">
            <span className="text-emerald-400 font-mono mr-2">$</span>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter command..."
              disabled={executing}
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none font-mono text-sm px-0"
            />
          </div>
          <Button
            onClick={executeCommand}
            disabled={!command.trim() || executing}
            className="bg-emerald-600 hover:bg-emerald-500"
          >
            {executing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Run"
            )}
          </Button>
        </div>

        <p className="text-xs text-zinc-600 mt-2">
          Tip: Commands run in {"/workspace"} directory by default
        </p>
      </DialogContent>
    </Dialog>
  );
}
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Terminal, Loader2, Trash2 } from "lucide-react";

interface DeploymentTerminalInlineProps {
  deploymentId: string;
  deploymentName: string;
}

interface TerminalLine {
  type: "command" | "output" | "error";
  text: string;
  id: number;
}

export function DeploymentTerminalInline({
  deploymentId,
  deploymentName,
}: DeploymentTerminalInlineProps) {
  const [command, setCommand] = useState("");
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 0,
      type: "output",
      text: `Welcome to ${deploymentName} terminal. Type your commands below.`,
    },
  ]);
  const [executing, setExecuting] = useState(false);
  const [currentDirectory, setCurrentDirectory] = useState<string>("");
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lineIdCounter = useRef(1);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  // Disable exhaustive-deps warning for currentDirectory in executeCommand
  // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Focus input when component mounts
    inputRef.current?.focus();
  }, []);

  const executeCommand = async () => {
    if (!command.trim() || executing) return;

    const cmd = command;
    const commandLineId = lineIdCounter.current++;
    setCommand("");
    setLines((prev) => [
      ...prev,
      { id: commandLineId, type: "command", text: `$ ${cmd}` },
    ]);
    setExecuting(true);

    try {
      // Build the full command with cd tracking
      let fullCommand = cmd;

      // If it's a cd command, we need to track the directory change
      if (cmd.trim().startsWith("cd ")) {
        const targetDir = cmd.trim().substring(3).trim();
        fullCommand = `cd ${targetDir} && pwd`;
      } else if (currentDirectory) {
        // If we have a current directory, execute command from there
        fullCommand = `cd ${currentDirectory} && ${cmd}`;
      }

      // Add pwd to get current directory after command
      if (!cmd.trim().startsWith("cd ")) {
        fullCommand = `${fullCommand} ; pwd`;
      }

      const res = await fetch(`/api/deployments/${deploymentId}/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: fullCommand }),
      });

      if (res.ok) {
        const data = await res.json();

        // Handle cd command - extract new directory
        if (cmd.trim().startsWith("cd ")) {
          if (data.stdout) {
            const newDir = data.stdout.trim();
            setCurrentDirectory(newDir);
            const outputLineId = lineIdCounter.current++;
            setLines((prev) => [
              ...prev,
              {
                id: outputLineId,
                type: "output",
                text: `Changed directory to: ${newDir}`,
              },
            ]);
          }
        } else {
          // For other commands, extract stdout and current directory
          if (data.stdout) {
            const outputLines = data.stdout.trim().split("\n");
            const lastLine = outputLines[outputLines.length - 1];

            // Check if last line is a directory path (from pwd)
            if (lastLine.startsWith("/")) {
              setCurrentDirectory(lastLine);
              // Remove the pwd output
              outputLines.pop();
            }

            if (outputLines.length > 0 && outputLines.join("\n").trim()) {
              const outputLineId = lineIdCounter.current++;
              setLines((prev) => [
                ...prev,
                {
                  id: outputLineId,
                  type: "output",
                  text: outputLines.join("\n").trim(),
                },
              ]);
            }
          }
        }

        if (data.stderr) {
          const errorLineId = lineIdCounter.current++;
          setLines((prev) => [
            ...prev,
            { id: errorLineId, type: "error", text: data.stderr.trim() },
          ]);
        }

        if (data.exitCode !== 0) {
          const exitLineId = lineIdCounter.current++;
          setLines((prev) => [
            ...prev,
            {
              id: exitLineId,
              type: "error",
              text: `Exit code: ${data.exitCode}`,
            },
          ]);
        }
      } else {
        const error = await res.json();
        const errorLineId = lineIdCounter.current++;
        setLines((prev) => [
          ...prev,
          {
            id: errorLineId,
            type: "error",
            text: `Error: ${error.error || "Command failed"}`,
          },
        ]);
      }
    } catch (error) {
      const errorLineId = lineIdCounter.current++;
      setLines((prev) => [
        ...prev,
        { id: errorLineId, type: "error", text: "Failed to execute command" },
      ]);
    } finally {
      setExecuting(false);
      inputRef.current?.focus();
    }
  };

  const clearTerminal = () => {
    setLines([
      {
        id: lineIdCounter.current++,
        type: "output",
        text: "Terminal cleared.",
      },
    ]);
    setCurrentDirectory("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gradient-to-br from-zinc-900/40 via-zinc-900/30 to-zinc-900/40 border-zinc-800/50 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-zinc-100">
              Terminal - {deploymentName}
            </h3>
            {currentDirectory && (
              <span className="text-xs text-zinc-500 font-mono">
                {currentDirectory}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={clearTerminal}
            className="text-zinc-400 hover:text-zinc-100"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>

        {/* Terminal Output */}
        <div
          ref={outputRef}
          className="bg-black border border-zinc-800 rounded-lg p-4 h-[500px] overflow-y-auto font-mono text-sm mb-4"
          onClick={() => inputRef.current?.focus()}
        >
          {lines.map((line) => (
            <div
              key={line.id}
              className={
                line.type === "command"
                  ? "text-emerald-400 font-semibold mb-1"
                  : line.type === "error"
                  ? "text-red-400 mb-1"
                  : "text-zinc-300 mb-1"
              }
            >
              {line.text.split("\n").map((l, j) => (
                <div key={j}>{l || "\u00A0"}</div>
              ))}
            </div>
          ))}
          {executing && (
            <div className="flex items-center gap-2 text-zinc-500 mt-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Executing...</span>
            </div>
          )}
        </div>

        {/* Terminal Input */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-black border border-zinc-800 rounded-lg px-3 py-2">
            <span className="text-emerald-400 font-mono mr-2">$</span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter command..."
              disabled={executing}
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none font-mono text-sm text-zinc-100 placeholder-zinc-600"
            />
          </div>
          <Button
            onClick={executeCommand}
            disabled={!command.trim() || executing}
            className="bg-emerald-600 hover:bg-emerald-500"
          >
            {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run"}
          </Button>
        </div>

        <p className="text-xs text-zinc-600 mt-3">
          💡 Tip: Use <code className="text-zinc-500">cd</code> to navigate
          directories. The session maintains your current location.
        </p>
      </Card>
    </div>
  );
}

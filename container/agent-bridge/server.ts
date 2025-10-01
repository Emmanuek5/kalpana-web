import { WebSocketServer, WebSocket } from "ws";
import { readFile, writeFile, readdir, mkdir } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { existsSync } from "fs";
import { AgentExecutor } from "./agent-executor";
import { createServer } from "http";

const execAsync = promisify(exec);
const WORKSPACE_ROOT = "/workspace";
const PORT = 3001; // Agent bridge server port
const VSCODE_EXTENSION_PORT = 3002; // VS Code extension server port

// Agent executor instance (initialized when agent starts)
let agentExecutor: AgentExecutor | null = null;

// WebSocket client to connect to VS Code extension
let vscodeWs: WebSocket | null = null;
let vscodeWsReady = false;
const vscodeCommandQueue: Array<{
  command: any;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}> = [];

// Connect to VS Code extension WebSocket server
async function checkExtensionActivation() {
  try {
    const log = await readFile("/tmp/kalpana-extension-activated.log", "utf-8");
    console.log("📄 Extension activation log:", log.trim());
  } catch (error) {
    console.log(
      "⚠️ Extension activation log not found - extension may not have activated yet"
    );
  }
}

function connectToVSCodeExtension() {
  console.log(
    `Attempting to connect to VS Code extension on port ${VSCODE_EXTENSION_PORT}...`
  );

  // Check if extension activated
  checkExtensionActivation();

  vscodeWs = new WebSocket(`ws://localhost:${VSCODE_EXTENSION_PORT}`);

  vscodeWs.on("open", () => {
    console.log("✅ Connected to VS Code extension");
    vscodeWsReady = true;
    // Process queued commands
    while (vscodeCommandQueue.length > 0) {
      const { command, resolve, reject } = vscodeCommandQueue.shift()!;
      sendToVSCodeExtension(command).then(resolve).catch(reject);
    }
  });

  vscodeWs.on("close", () => {
    console.log("❌ Disconnected from VS Code extension, will retry...");
    vscodeWsReady = false;
    vscodeWs = null;
    // Retry connection after 2 seconds
    setTimeout(connectToVSCodeExtension, 2000);
  });

  vscodeWs.on("error", (error) => {
    console.error("VS Code extension WebSocket error:", error.message);
  });
}

// Send command to VS Code extension and wait for response
function sendToVSCodeExtension(command: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!vscodeWsReady || !vscodeWs) {
      // Queue command if not connected
      vscodeCommandQueue.push({ command, resolve, reject });
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error("VS Code extension command timeout"));
    }, 30000);

    const messageHandler = (data: Buffer) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.id === command.id) {
          clearTimeout(timeout);
          vscodeWs?.off("message", messageHandler);
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error || "VS Code command failed"));
          }
        }
      } catch (error) {
        // Ignore parsing errors for messages not meant for us
      }
    };

    vscodeWs.on("message", messageHandler);
    vscodeWs.send(JSON.stringify(command));
  });
}

interface Command {
  id: string;
  type:
    | "readFile"
    | "writeFile"
    | "listFiles"
    | "fileTree"
    | "runCommand"
    | "searchCode"
    | "gitCommit"
    | "gitPush"
    | "getConsoleLogs"
    | "clearConsoleLogs"
    | "reportError"
    | "getLintErrors"
    | "watchFile"
    | "getVSCodeProblems"
    | "runInTerminal"
    | "getCodeActions"
    | "applyCodeAction"
    | "goToDefinition"
    | "findReferences"
    | "searchSymbols"
    | "formatDocument"
    | "getHover";
  payload: any;
}

interface Response {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

const wss = new WebSocketServer({ noServer: true });

// Console logs and errors buffer
interface LogEntry {
  timestamp: number;
  level: "log" | "error" | "warn" | "info";
  message: string;
  source?: string;
  stack?: string;
}

const consoleLogs: LogEntry[] = [];
const MAX_LOGS = 1000; // Keep last 1000 logs

// Store connected clients for broadcasting
const clients = new Set<WebSocket>();

// Helper to broadcast errors to all clients
function broadcastError(error: LogEntry) {
  const message = JSON.stringify({
    type: "error",
    data: error,
  });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Helper to add log entry
function addLog(entry: LogEntry) {
  consoleLogs.push(entry);
  if (consoleLogs.length > MAX_LOGS) {
    consoleLogs.shift(); // Remove oldest
  }

  // Broadcast errors in real-time
  if (entry.level === "error") {
    broadcastError(entry);
  }
}

console.log(`🌉 Agent Bridge WebSocket Server starting on port ${PORT}`);

wss.on("connection", (ws: WebSocket) => {
  console.log("✅ New agent connection established");
  clients.add(ws);

  ws.on("message", async (data: Buffer) => {
    try {
      const command: Command = JSON.parse(data.toString());
      console.log(`📨 Received command: ${command.type}`);

      const response = await handleCommand(command);
      ws.send(JSON.stringify(response));
    } catch (error: any) {
      console.error("❌ Error processing command:", error);
      ws.send(
        JSON.stringify({
          success: false,
          error: error.message || "Unknown error occurred",
        })
      );
    }
  });

  ws.on("close", () => {
    console.log("🔌 Agent connection closed");
    clients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
  });

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "connected",
      message: "Agent bridge connected successfully",
    })
  );
});

async function handleCommand(command: Command): Promise<Response> {
  // Security: Prevent path traversal
  const sanitizePath = (filePath: string): string => {
    const normalized = path.normalize(filePath);
    const resolved = path.resolve(WORKSPACE_ROOT, normalized);

    if (!resolved.startsWith(WORKSPACE_ROOT)) {
      throw new Error("Path traversal detected - access denied");
    }

    return resolved;
  };

  try {
    switch (command.type) {
      case "readFile": {
        const filePath = sanitizePath(command.payload.path);
        console.log(`📖 Reading file: ${filePath}`);

        if (!existsSync(filePath)) {
          return {
            id: command.id,
            success: false,
            error: "File not found",
          };
        }

        const content = await readFile(filePath, "utf-8");
        return {
          id: command.id,
          success: true,
          data: content,
        };
      }

      case "writeFile": {
        const filePath = sanitizePath(command.payload.path);
        console.log(`✏️  Writing file: ${filePath}`);

        // Create directory if it doesn't exist
        const dir = path.dirname(filePath);
        if (!existsSync(dir)) {
          await mkdir(dir, { recursive: true });
        }

        await writeFile(filePath, command.payload.content, "utf-8");
        return {
          id: command.id,
          success: true,
        };
      }

      case "listFiles": {
        const dirPath = sanitizePath(command.payload.path || ".");
        console.log(`📁 Listing files: ${dirPath}`);

        if (!existsSync(dirPath)) {
          return {
            id: command.id,
            success: false,
            error: "Directory not found",
          };
        }

        const files = await readdir(dirPath, { withFileTypes: true });
        return {
          id: command.id,
          success: true,
          data: files.map((f) => ({
            name: f.name,
            isDirectory: f.isDirectory(),
            isFile: f.isFile(),
          })),
        };
      }

      case "fileTree": {
        const dirPath = sanitizePath(command.payload.path || ".");
        console.log(`🌳 Building file tree: ${dirPath}`);

        if (!existsSync(dirPath)) {
          return {
            id: command.id,
            success: false,
            error: "Directory not found",
          };
        }

        // Recursively build file tree
        async function buildTree(currentPath: string): Promise<any[]> {
          const entries = await readdir(currentPath, { withFileTypes: true });
          const tree = [];

          for (const entry of entries) {
            // Skip common directories we don't want
            if (
              entry.name === "node_modules" ||
              entry.name === ".git" ||
              entry.name === "dist" ||
              entry.name === "build" ||
              entry.name === ".next" ||
              entry.name.startsWith(".")
            ) {
              continue;
            }

            const item: any = {
              name: entry.name,
              type: entry.isDirectory() ? "directory" : "file",
            };

            if (entry.isDirectory()) {
              const fullPath = path.join(currentPath, entry.name);
              item.children = await buildTree(fullPath);
            }

            tree.push(item);
          }

          return tree;
        }

        const tree = await buildTree(dirPath);
        return {
          id: command.id,
          success: true,
          data: tree,
        };
      }

      case "runCommand": {
        const cmd = command.payload.command;
        console.log(`⚙️  Running command: ${cmd}`);

        // Security: Whitelist allowed commands
        const allowedCommands = [
          "ls",
          "cat",
          "echo",
          "pwd",
          "cd",
          "git",
          "npm",
          "bun",
          "pnpm",
          "yarn",
          "python",
          "python3",
          "node",
          "rustc",
          "cargo",
          "go",
          "make",
          "mkdir",
          "touch",
          "rm",
          "cp",
          "mv",
        ];

        const cmdName = cmd.trim().split(" ")[0];
        if (!allowedCommands.includes(cmdName)) {
          return {
            id: command.id,
            success: false,
            error: `Command not allowed: ${cmdName}. Allowed: ${allowedCommands.join(
              ", "
            )}`,
          };
        }

        const { stdout, stderr } = await execAsync(cmd, {
          cwd: WORKSPACE_ROOT,
          timeout: 30000, // 30s timeout
          maxBuffer: 1024 * 1024 * 10, // 10MB max output
        });

        return {
          id: command.id,
          success: true,
          data: {
            stdout,
            stderr,
            exitCode: 0,
          },
        };
      }

      case "searchCode": {
        const query = command.payload.query;
        console.log(`🔍 Searching code: ${query}`);

        try {
          const { stdout } = await execAsync(
            `rg "${query}" ${WORKSPACE_ROOT} --json`,
            {
              cwd: WORKSPACE_ROOT,
              timeout: 10000, // 10s timeout
              maxBuffer: 1024 * 1024 * 5, // 5MB
            }
          );

          return {
            id: command.id,
            success: true,
            data: stdout,
          };
        } catch (error: any) {
          // ripgrep returns exit code 1 if no matches found
          return {
            id: command.id,
            success: true,
            data: "",
          };
        }
      }

      case "gitCommit": {
        const message = command.payload.message;
        console.log(`💾 Git commit: ${message}`);

        await execAsync(`git add -A`, { cwd: WORKSPACE_ROOT });
        const { stdout } = await execAsync(
          `git commit -m "${message.replace(/"/g, '\\"')}"`,
          { cwd: WORKSPACE_ROOT }
        );

        return {
          id: command.id,
          success: true,
          data: stdout,
        };
      }

      case "gitPush": {
        console.log(`📤 Git push`);

        const { stdout } = await execAsync(`git push`, {
          cwd: WORKSPACE_ROOT,
          timeout: 60000, // 60s timeout for push
        });

        return {
          id: command.id,
          success: true,
          data: stdout,
        };
      }

      case "getConsoleLogs": {
        const { level, limit = 100 } = command.payload || {};
        console.log(`📋 Getting console logs (level: ${level || "all"})`);

        let logs = consoleLogs;
        if (level) {
          logs = logs.filter((log) => log.level === level);
        }

        return {
          id: command.id,
          success: true,
          data: logs.slice(-limit),
        };
      }

      case "clearConsoleLogs": {
        console.log(`🗑️  Clearing console logs`);
        consoleLogs.length = 0;

        return {
          id: command.id,
          success: true,
        };
      }

      case "reportError": {
        const { message, level = "error", source, stack } = command.payload;
        console.log(`⚠️  Reported ${level}: ${message}`);

        addLog({
          timestamp: Date.now(),
          level,
          message,
          source,
          stack,
        });

        return {
          id: command.id,
          success: true,
        };
      }

      case "getLintErrors": {
        const filePath = command.payload.path
          ? sanitizePath(command.payload.path)
          : WORKSPACE_ROOT;
        console.log(`🔍 Getting lint errors for: ${filePath}`);

        try {
          // Try to run ESLint if available
          const { stdout, stderr } = await execAsync(
            `eslint ${filePath} --format json || true`,
            {
              cwd: WORKSPACE_ROOT,
              timeout: 10000,
            }
          );

          let results = [];
          try {
            results = JSON.parse(stdout);
          } catch {
            // ESLint not available or no results
          }

          return {
            id: command.id,
            success: true,
            data: results,
          };
        } catch (error: any) {
          return {
            id: command.id,
            success: false,
            error: error.message,
          };
        }
      }

      case "watchFile": {
        const filePath = sanitizePath(command.payload.path);
        console.log(`👀 Watch file requested: ${filePath}`);

        // Note: Actual file watching would require fs.watch
        // For now, just acknowledge the request
        return {
          id: command.id,
          success: true,
          data: { watching: filePath },
        };
      }

      case "getVSCodeProblems": {
        console.log(`🔍 Getting VS Code problems/diagnostics`);

        const diagnosticsFile = "/tmp/kalpana-diagnostics.json";

        try {
          if (!existsSync(diagnosticsFile)) {
            // Extension hasn't written diagnostics yet
            return {
              id: command.id,
              success: true,
              data: {
                timestamp: Date.now(),
                count: 0,
                diagnostics: [],
                note: "VS Code extension not yet initialized or no problems found",
              },
            };
          }

          const content = await readFile(diagnosticsFile, "utf-8");
          const diagnostics = JSON.parse(content);

          // Filter by severity if specified
          if (command.payload?.severity) {
            const filtered = diagnostics.diagnostics.filter(
              (d: any) => d.severity === command.payload.severity
            );
            return {
              id: command.id,
              success: true,
              data: {
                ...diagnostics,
                count: filtered.length,
                diagnostics: filtered,
              },
            };
          }

          return {
            id: command.id,
            success: true,
            data: diagnostics,
          };
        } catch (error: any) {
          console.error("Error reading diagnostics:", error);
          return {
            id: command.id,
            success: false,
            error: error.message,
          };
        }
      }

      // ========== VS Code Extension Commands (via WebSocket) ==========
      case "runInTerminal": {
        console.log(
          `🖥️  Running command in VS Code terminal: ${command.payload.command}`
        );
        try {
          const data = await sendToVSCodeExtension({
            id: command.id,
            type: "runInTerminal",
            payload: command.payload,
          });
          return { id: command.id, success: true, data };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "getCodeActions": {
        console.log(
          `🔧 Getting code actions for ${command.payload.filePath}:${command.payload.line}`
        );
        try {
          const data = await sendToVSCodeExtension({
            id: command.id,
            type: "getCodeActions",
            payload: command.payload,
          });
          return { id: command.id, success: true, data };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "applyCodeAction": {
        console.log(`✨ Applying code action #${command.payload.actionId}`);
        try {
          const data = await sendToVSCodeExtension({
            id: command.id,
            type: "applyCodeAction",
            payload: command.payload,
          });
          return { id: command.id, success: true, data };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "goToDefinition": {
        console.log(
          `🎯 Finding definition for ${command.payload.filePath}:${command.payload.line}:${command.payload.character}`
        );
        try {
          const data = await sendToVSCodeExtension({
            id: command.id,
            type: "goToDefinition",
            payload: command.payload,
          });
          return { id: command.id, success: true, data };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "findReferences": {
        console.log(
          `🔍 Finding references for ${command.payload.filePath}:${command.payload.line}:${command.payload.character}`
        );
        try {
          const data = await sendToVSCodeExtension({
            id: command.id,
            type: "findReferences",
            payload: command.payload,
          });
          return { id: command.id, success: true, data };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "searchSymbols": {
        console.log(`🔎 Searching symbols: ${command.payload.query}`);
        try {
          const data = await sendToVSCodeExtension({
            id: command.id,
            type: "searchSymbols",
            payload: command.payload,
          });
          return { id: command.id, success: true, data };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "formatDocument": {
        console.log(`💅 Formatting document: ${command.payload.filePath}`);
        try {
          const data = await sendToVSCodeExtension({
            id: command.id,
            type: "formatDocument",
            payload: command.payload,
          });
          return { id: command.id, success: true, data };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "getHover": {
        console.log(
          `ℹ️  Getting hover info for ${command.payload.filePath}:${command.payload.line}:${command.payload.character}`
        );
        try {
          const data = await sendToVSCodeExtension({
            id: command.id,
            type: "getHover",
            payload: command.payload,
          });
          return { id: command.id, success: true, data };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      default:
        return {
          id: command.id,
          success: false,
          error: `Unknown command type: ${command.type}`,
        };
    }
  } catch (error: any) {
    console.error(`❌ Command execution error:`, error);
    return {
      id: command.id,
      success: false,
      error: error.message || "Command execution failed",
    };
  }
}

// Capture process errors
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  addLog({
    timestamp: Date.now(),
    level: "error",
    message: error.message,
    source: "process",
    stack: error.stack,
  });
});

process.on("unhandledRejection", (reason: any) => {
  console.error("❌ Unhandled Rejection:", reason);
  addLog({
    timestamp: Date.now(),
    level: "error",
    message: reason?.message || String(reason),
    source: "process",
    stack: reason?.stack,
  });
});

// ========== HTTP Server for Agent Endpoints ==========
const httpServer = createServer(async (req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // POST /agent/execute - Start agent execution
  if (url.pathname === "/agent/execute" && req.method === "POST") {
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }

      const { task, apiKey, model, conversationHistory } = JSON.parse(body);

      console.log(`📥 Received task request:`, {
        taskLength: task?.length || 0,
        hasApiKey: !!apiKey,
        apiKeyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : "none",
        model: model || "default",
        historyLength: conversationHistory?.length || 0,
      });

      // Use provided API key or fall back to environment variable
      const effectiveApiKey = apiKey || process.env.OPENROUTER_API_KEY;

      if (!effectiveApiKey) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "API key required (not found in request or environment)",
          })
        );
        return;
      }

      console.log(`🔑 Using API key: ${effectiveApiKey.substring(0, 8)}...`);
      console.log(`🤖 Initializing agent with model: ${model}`);

      // Initialize agent executor
      agentExecutor = new AgentExecutor(effectiveApiKey, model);

      // Set conversation history if provided (for resume)
      if (conversationHistory && Array.isArray(conversationHistory)) {
        console.log(
          `📚 Restoring ${conversationHistory.length} conversation messages`
        );
        agentExecutor.setConversationHistory(conversationHistory);
      }

      console.log(
        `▶️ Starting agent execution for task: ${task.substring(0, 100)}...`
      );

      // Stream response using Server-Sent Events
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      // Set up tool call callback to stream tool calls
      agentExecutor.setToolCallCallback((toolCall) => {
        console.log(`🔧 [Server] Tool call: ${toolCall.name}`);
        res.write(
          `data: ${JSON.stringify({
            type: "tool-call",
            toolName: toolCall.name,
            toolCallId: toolCall.id,
            args: toolCall.arguments,
          })}\n\n`
        );
      });

      console.log(`🎯 [Server] Starting to stream agent execution response...`);

      try {
        let chunkCount = 0;
        console.log(`📡 [Server] Entering for-await loop...`);

        for await (const chunk of agentExecutor.execute(task)) {
          chunkCount++;
          console.log(
            `📨 [Server] Received chunk ${chunkCount} from agent: ${chunk.substring(
              0,
              50
            )}...`
          );
          res.write(
            `data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`
          );
          console.log(`✅ [Server] Chunk ${chunkCount} written to response`);
        }

        console.log(
          `🏁 [Server] For-await loop completed with ${chunkCount} chunks`
        );

        const state = agentExecutor.getState();
        console.log(`✅ Agent execution completed:`, {
          chunksStreamed: chunkCount,
          toolCalls: state.toolCallsCount,
          filesEdited: state.filesEdited.length,
        });

        res.write(`data: ${JSON.stringify({ type: "done", state })}\n\n`);
        console.log(`📤 [Server] Sent "done" message to client`);
      } catch (error: any) {
        console.error(`❌ Agent execution error:`, error);
        console.error(`❌ Error stack:`, error.stack);
        res.write(
          `data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`
        );
      }

      res.end();
    } catch (error: any) {
      console.error("Error in /agent/execute:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // POST /agent/chat - Continue conversation
  if (url.pathname === "/agent/chat" && req.method === "POST") {
    try {
      if (!agentExecutor) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Agent not initialized. Call /agent/execute first.",
          })
        );
        return;
      }

      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }

      const { message } = JSON.parse(body);

      if (!message) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Message required" }));
        return;
      }

      // Stream response using Server-Sent Events
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      try {
        for await (const chunk of agentExecutor.chat(message)) {
          res.write(
            `data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`
          );
        }

        const state = agentExecutor.getState();
        res.write(`data: ${JSON.stringify({ type: "done", state })}\n\n`);
      } catch (error: any) {
        res.write(
          `data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`
        );
      }

      res.end();
    } catch (error: any) {
      console.error("Error in /agent/chat:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // GET /agent/status - Get agent status
  if (url.pathname === "/agent/status" && req.method === "GET") {
    try {
      if (!agentExecutor) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ initialized: false }));
        return;
      }

      const state = agentExecutor.getState();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          initialized: true,
          ...state,
        })
      );
    } catch (error: any) {
      console.error("Error in /agent/status:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // GET /health - Health check
  if (url.pathname === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", workspace: WORKSPACE_ROOT }));
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// Start HTTP server on the same port (WebSocket will upgrade)
httpServer.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

httpServer.listen(PORT, () => {
  console.log(`✅ Agent bridge running on http://0.0.0.0:${PORT}`);
  console.log(`✅ WebSocket server available at ws://0.0.0.0:${PORT}`);
  console.log(`📂 Workspace root: ${WORKSPACE_ROOT}`);
  console.log(`📊 Error tracking enabled`);
  console.log(`🤖 Agent endpoints available:
    POST /agent/execute - Start agent execution
    POST /agent/chat - Continue conversation
    GET  /agent/status - Get agent status
    GET  /health - Health check`);
});

// Connect to VS Code extension
connectToVSCodeExtension();

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
const IS_AGENT_MODE = process.env.AGENT_MODE;
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

  // Global message handler to relay codeContext messages to web clients
  vscodeWs.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      // Relay codeContext messages to all connected web clients
      if (message.type === "codeContext") {
        console.log(
          "📨 Relaying codeContext message to web clients:",
          message.action
        );
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
          }
        });
      }

      // Relay Live Share events from VS Code extension to web clients
      if (message.type === "liveshare-session-changed" || 
          message.type === "liveshare-session-ended" ||
          message.type === "liveshare-participants-changed" ||
          message.type === "user-joined" ||
          message.type === "user-left") {
        console.log(
          "📨 Relaying Live Share event to web clients:",
          message.type
        );
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
          }
        });
      }

      // Relay file viewer updates from VSCode extension to other VSCode extensions
      if (message.type === "file-viewer-update") {
        const { userId, filePath, action } = message;
        console.log(
          "📨 File viewer update:",
          userId,
          action,
          filePath
        );
        
        // Update user's current file
        if (userId && connectedUsers.has(userId)) {
          const userData = connectedUsers.get(userId)!;
          if (action === "open") {
            userData.currentFile = filePath;
            console.log(`📂 ${userData.name} is now viewing: ${filePath}`);
          } else if (action === "close" && userData.currentFile === filePath) {
            userData.currentFile = undefined;
            console.log(`📂 ${userData.name} closed: ${filePath}`);
          }
          
          // Broadcast updated user list to all clients
          const allUsers = Array.from(connectedUsers.values()).map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            image: u.image,
            color: u.color,
            role: u.role,
            currentFile: u.currentFile,
            isYou: false, // Will be set by each client
          }));
          
          clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "presence-update",
                users: allUsers,
                timestamp: Date.now(),
              }));
            }
          });
        }
        
        // Also send to VSCode extension for decorations
        if (vscodeWs && vscodeWs.readyState === WebSocket.OPEN) {
          vscodeWs.send(JSON.stringify(message));
        }
      }
    } catch (error) {
      // Ignore parsing errors
    }
  });

  vscodeWs.on("close", () => {
    console.log("❌ Disconnected from VS Code extension, will retry...");
    vscodeWsReady = false;
    vscodeWs = null;
    // Retry connection after 2 seconds
    if (!IS_AGENT_MODE) {
      setTimeout(connectToVSCodeExtension, 2000);
    }
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
    | "runInTerminalAndCapture"
    | "getTerminalOutput"
    | "getCodeActions"
    | "applyCodeAction"
    | "goToDefinition"
    | "findReferences"
    | "searchSymbols"
    | "formatDocument"
    | "getHover"
    | "grepInFile"
    | "grepInDirectory"
    | "countLines"
    | "fileDiff"
    | "headFile"
    | "tailFile"
    | "findDuplicates"
    | "startLiveShare"
    | "endLiveShare"
    | "showLiveSharePanel";
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

// Track user presence data (userId -> user info)
const connectedUsers = new Map<string, {
  id: string;
  name: string;
  email: string;
  image?: string;
  color: string;
  role: string;
  currentFile?: string; // Track what file the user is viewing
  connections: Set<WebSocket>; // Track all connections for this user
}>();

// Live Share session tracking
let liveShareActive = false;

// Chat messages (in-memory, cleared when session ends)
const chatMessages: any[] = [];

// Auto-manage Live Share based on unique user count
async function autoManageLiveShare() {
  const uniqueUserCount = connectedUsers.size;
  
  console.log(`👥 Unique users: ${uniqueUserCount}, Live Share active: ${liveShareActive}`);
  console.log(`👥 Connected users:`, Array.from(connectedUsers.values()).map(u => u.name));
  
  // Auto-start Live Share when we have 2+ unique users
  if (uniqueUserCount >= 2 && !liveShareActive) {
    console.log("🚀 Auto-starting Live Share - multiple clients detected");
    try {
      const result = await sendToVSCodeExtension({
        id: `auto-liveshare-start-${Date.now()}`,
        type: "startLiveShare",
        payload: {},
      });
      
      if (result) {
        liveShareActive = true;
        console.log("✅ Live Share auto-started successfully");
        
        // Broadcast Live Share started event to all clients
        const message = JSON.stringify({
          type: "liveshare-auto-started",
          shareLink: result.shareLink || null,
          timestamp: Date.now(),
        });
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });

        // Get and broadcast initial participants
        setTimeout(async () => {
          try {
            const participantsResult = await sendToVSCodeExtension({
              id: `get-participants-${Date.now()}`,
              type: "getLiveShareParticipants",
              payload: {},
            });
            
            if (participantsResult && participantsResult.participants) {
              const participantsMessage = JSON.stringify({
                type: "liveshare-participants-changed",
                participants: participantsResult.participants,
                timestamp: Date.now(),
              });
              clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(participantsMessage);
                }
              });
            }
          } catch (error) {
            console.error("❌ Failed to get initial Live Share participants:", error);
          }
        }, 2000); // Wait 2 seconds for Live Share to fully initialize
      }
    } catch (error) {
      console.error("❌ Failed to auto-start Live Share:", error);
    }
  }
  
  // Auto-end Live Share when we have less than 2 unique users
  else if (uniqueUserCount < 2 && liveShareActive) {
    console.log("🛑 Auto-ending Live Share - not enough unique users for collaboration");
    try {
      await sendToVSCodeExtension({
        id: `auto-liveshare-end-${Date.now()}`,
        type: "endLiveShare",
        payload: {},
      });
      
      liveShareActive = false;
      console.log("✅ Live Share auto-ended successfully");
      
      // Clear chat messages
      chatMessages.length = 0;
      console.log("🗑️ Chat messages cleared");
      
      // Broadcast Live Share ended event to all clients
      const message = JSON.stringify({
        type: "liveshare-auto-ended",
        timestamp: Date.now(),
      });
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } catch (error) {
      console.error("❌ Failed to auto-end Live Share:", error);
    }
  }
}

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
  console.log(`👥 Total clients connected: ${clients.size}`);
  
  // Check if we should auto-start Live Share
  setTimeout(() => autoManageLiveShare(), 1000); // Small delay to ensure connection is stable

  // Set up ping/pong heartbeat to keep connection alive
  let isAlive = true;

  ws.on("pong", () => {
    console.log("🏓 Received native WebSocket pong from client");
    isAlive = true;
  });

  const heartbeatInterval = setInterval(() => {
    if (!isAlive) {
      console.log("💔 Client didn't respond to ping/pong, terminating connection");
      clearInterval(heartbeatInterval);
      ws.terminate();
      return;
    }

    console.log("🏓 Sending native WebSocket ping to client");
    isAlive = false;
    ws.ping();
  }, 30000); // Ping every 30 seconds

  ws.on("message", async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      // Handle ping/pong for keepalive
      if (message.type === "ping") {
        console.log("🏓 Received JSON ping from client, sending pong");
        isAlive = true; // Reset alive flag for both JSON and native ping/pong
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        return;
      }

      // Handle presence updates (broadcast to all clients)
      if (message.type === "presence-update") {
        console.log(`👤 Presence update from: ${message.user?.name}`);

        // Broadcast to all connected clients
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "presence-update",
                users: message.users,
                timestamp: Date.now(),
              })
            );
          }
        });

        // Acknowledge to sender
        ws.send(
          JSON.stringify({
            success: true,
            type: "presence-ack",
          })
        );
        return;
      }

      // Handle presence join
      if (message.type === "presence-join") {
        const user = message.user;
        console.log(`👋 User joined: ${user?.name} (${user?.id})`);

        // Track this user
        if (user && user.id) {
          if (!connectedUsers.has(user.id)) {
            connectedUsers.set(user.id, {
              id: user.id,
              name: user.name || "Anonymous",
              email: user.email || "",
              image: user.image,
              color: user.color || "#3b82f6",
              role: user.role || "guest",
              connections: new Set([ws]),
            });
            console.log(`✅ New user tracked: ${user.name} (total unique users: ${connectedUsers.size})`);
            
            // Send user info to VSCode extension for file tracking
            if (vscodeWs && vscodeWs.readyState === WebSocket.OPEN) {
              vscodeWs.send(JSON.stringify({
                type: 'set-user-info',
                userId: user.id,
                userName: user.name,
                userColor: user.color,
              }));
              console.log(`📤 Sent user info to VSCode extension: ${user.name}`);
            }
            
            // If Live Share is already active, notify the new user
            if (liveShareActive) {
              console.log(`📡 Live Share already active, notifying new user: ${user.name}`);
              ws.send(JSON.stringify({
                type: "liveshare-already-active",
                message: "A Live Share session is already active",
                timestamp: Date.now(),
              }));
              
              // Get current Live Share info from VSCode extension
              if (vscodeWs && vscodeWs.readyState === WebSocket.OPEN) {
                sendToVSCodeExtension({
                  id: `get-liveshare-info-${Date.now()}`,
                  type: "getLiveShareParticipants",
                  payload: {},
                }).then((result) => {
                  if (result && result.participants) {
                    ws.send(JSON.stringify({
                      type: "liveshare-participants-changed",
                      participants: result.participants,
                      timestamp: Date.now(),
                    }));
                  }
                }).catch((error) => {
                  console.error("❌ Failed to get Live Share info for new user:", error);
                });
              }
            }
            
            // Check if we should auto-start Live Share
            setTimeout(() => autoManageLiveShare(), 500);
          } else {
            // Add this connection to existing user
            const userData = connectedUsers.get(user.id)!;
            userData.connections.add(ws);
            console.log(`✅ Additional connection for user: ${user.name} (connections: ${userData.connections.size})`);
          }
        }

        // Send current user list to the new user
        const allUsers = Array.from(connectedUsers.values()).map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          image: u.image,
          color: u.color,
          role: u.role,
          currentFile: u.currentFile,
          isYou: u.id === user.id,
        }));
        
        ws.send(JSON.stringify({
          type: "presence-update",
          users: allUsers,
          timestamp: Date.now(),
        }));
        console.log(`📤 Sent current user list to ${user.name}: ${allUsers.length} users`);

        // Broadcast to all other clients that a new user joined
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "user-joined",
                user: message.user,
                timestamp: Date.now(),
              })
            );
          }
        });

        ws.send(JSON.stringify({ success: true }));
        return;
      }

      // Handle presence leave
      if (message.type === "presence-leave") {
        const user = message.user;
        console.log(`👋 User left: ${user?.name} (${user?.id})`);

        // Remove this connection from user tracking
        if (user && user.id && connectedUsers.has(user.id)) {
          const userData = connectedUsers.get(user.id)!;
          userData.connections.delete(ws);
          
          // If user has no more connections, remove them completely
          if (userData.connections.size === 0) {
            connectedUsers.delete(user.id);
            console.log(`✅ User fully disconnected: ${user.name} (remaining unique users: ${connectedUsers.size})`);
            
            // Check if we should auto-end Live Share
            setTimeout(() => autoManageLiveShare(), 500);
          } else {
            console.log(`✅ Connection removed for user: ${user.name} (remaining connections: ${userData.connections.size})`);
          }
        }

        // Broadcast to all other clients
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "user-left",
                user: message.user,
                timestamp: Date.now(),
              })
            );
          }
        });

        ws.send(JSON.stringify({ success: true }));
        return;
      }

      // Handle chat messages
      if (message.type === "chat-message") {
        const chatMessage = message.data;
        console.log(`💬 Chat message from ${chatMessage.userName}: ${chatMessage.message}`);
        
        // Store in memory
        chatMessages.push(chatMessage);
        
        // Broadcast to all other clients
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "chat-message",
                data: chatMessage,
              })
            );
          }
        });
        
        return;
      }

      // Handle regular commands
      const command: Command = message as Command;
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
    clearInterval(heartbeatInterval);
    clients.delete(ws);
    
    // Clean up user tracking - remove this connection from all users
    for (const [userId, userData] of connectedUsers.entries()) {
      if (userData.connections.has(ws)) {
        userData.connections.delete(ws);
        
        // If user has no more connections, remove them completely
        if (userData.connections.size === 0) {
          connectedUsers.delete(userId);
          console.log(`✅ User auto-disconnected on close: ${userData.name} (remaining unique users: ${connectedUsers.size})`);
        }
      }
    }
    
    // Check if we should auto-end Live Share
    setTimeout(() => autoManageLiveShare(), 500); // Small delay to ensure cleanup is complete
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
    clearInterval(heartbeatInterval);
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

      case "runInTerminalAndCapture": {
        console.log(
          `🖥️  Running command in VS Code terminal with capture: ${command.payload.command}`
        );
        try {
          const data = await sendToVSCodeExtension({
            id: command.id,
            type: "runInTerminalAndCapture",
            payload: command.payload,
          });
          return { id: command.id, success: true, data };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "getTerminalOutput": {
        console.log(
          `📋 Getting terminal output for: ${command.payload.terminalId}`
        );
        try {
          const data = await sendToVSCodeExtension({
            id: command.id,
            type: "getTerminalOutput",
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

      case "showLiveSharePanel": {
        console.log("📡 Opening VS Code Live Share panel");
        try {
          const data = await sendToVSCodeExtension({
            id: command.id,
            type: "showLiveSharePanel",
            payload: command.payload,
          });
          return { id: command.id, success: true, data };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      // ========== Advanced Search and Inspection Tools ==========
      case "grepInFile": {
        const { path, pattern, caseInsensitive, contextLines } =
          command.payload;
        const filePath = sanitizePath(path);
        console.log(`🔍 Grep in file: ${pattern} in ${filePath}`);

        try {
          if (!existsSync(filePath)) {
            return { id: command.id, success: false, error: "File not found" };
          }

          const caseFlag = caseInsensitive ? "-i" : "";
          const contextFlag = contextLines > 0 ? `-C ${contextLines}` : "";

          const { stdout } = await execAsync(
            `grep -n ${caseFlag} ${contextFlag} "${pattern}" "${filePath}" || true`,
            {
              cwd: WORKSPACE_ROOT,
              maxBuffer: 1024 * 1024 * 5,
            }
          );

          const matches = stdout
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => {
              const colonIndex = line.indexOf(":");
              if (colonIndex > 0) {
                const lineNum = line.substring(0, colonIndex);
                const content = line.substring(colonIndex + 1);
                return { line: parseInt(lineNum), content };
              }
              return { line: 0, content: line };
            });

          return {
            id: command.id,
            success: true,
            data: { path, pattern, matches, count: matches.length },
          };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "grepInDirectory": {
        const {
          path: dirPath,
          pattern,
          filePattern,
          caseInsensitive,
          maxResults = 100,
        } = command.payload;
        const fullPath = sanitizePath(dirPath || ".");
        console.log(`🔍 Grep in directory: ${pattern} in ${fullPath}`);

        try {
          if (!existsSync(fullPath)) {
            return {
              id: command.id,
              success: false,
              error: "Directory not found",
            };
          }

          const caseFlag = caseInsensitive ? "-i" : "";
          const includeFlag = filePattern ? `--include="${filePattern}"` : "";

          const { stdout } = await execAsync(
            `grep -rn ${caseFlag} ${includeFlag} "${pattern}" "${fullPath}" 2>/dev/null | head -n ${maxResults} || true`,
            {
              cwd: WORKSPACE_ROOT,
              maxBuffer: 1024 * 1024 * 5,
            }
          );

          const matches = stdout
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => {
              const parts = line.split(":");
              if (parts.length >= 3) {
                const file = parts[0].replace(fullPath + "/", "");
                const lineNum = parseInt(parts[1]);
                const content = parts.slice(2).join(":");
                return { file, line: lineNum, content };
              }
              return null;
            })
            .filter((m) => m !== null);

          return {
            id: command.id,
            success: true,
            data: { path: dirPath, pattern, matches, count: matches.length },
          };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "countLines": {
        const { path: targetPath, filePattern } = command.payload;
        const fullPath = sanitizePath(targetPath);
        console.log(`📊 Count lines: ${fullPath}`);

        try {
          if (!existsSync(fullPath)) {
            return { id: command.id, success: false, error: "Path not found" };
          }

          const stats = await execAsync(`stat -c '%F' "${fullPath}"`);
          const isDirectory = stats.stdout.trim().includes("directory");

          if (isDirectory) {
            const findPattern = filePattern
              ? `-name "${filePattern}"`
              : "-type f";
            const { stdout } = await execAsync(
              `find "${fullPath}" ${findPattern} -exec wc -l {} + 2>/dev/null || echo "0"`,
              {
                cwd: WORKSPACE_ROOT,
                maxBuffer: 1024 * 1024 * 5,
              }
            );

            const lines = stdout.split("\n").filter((l) => l.trim());
            const files = lines.slice(0, -1).map((line) => {
              const parts = line.trim().split(/\s+/);
              const count = parseInt(parts[0]);
              const file = parts
                .slice(1)
                .join(" ")
                .replace(fullPath + "/", "");
              return { file, lines: count };
            });

            const total = files.reduce((sum, f) => sum + f.lines, 0);

            return {
              id: command.id,
              success: true,
              data: {
                path: targetPath,
                isDirectory: true,
                files,
                totalFiles: files.length,
                totalLines: total,
              },
            };
          } else {
            const { stdout } = await execAsync(`wc -l "${fullPath}"`);
            const lines = parseInt(stdout.trim().split(/\s+/)[0]) || 0;

            return {
              id: command.id,
              success: true,
              data: { path: targetPath, isDirectory: false, lines },
            };
          }
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "fileDiff": {
        const { file1, file2, unified = true } = command.payload;
        const fullPath1 = sanitizePath(file1);
        const fullPath2 = sanitizePath(file2);
        console.log(`🔄 File diff: ${file1} vs ${file2}`);

        try {
          if (!existsSync(fullPath1)) {
            return {
              id: command.id,
              success: false,
              error: `File not found: ${file1}`,
            };
          }
          if (!existsSync(fullPath2)) {
            return {
              id: command.id,
              success: false,
              error: `File not found: ${file2}`,
            };
          }

          const diffFlag = unified ? "-u" : "";
          const { stdout } = await execAsync(
            `diff ${diffFlag} "${fullPath1}" "${fullPath2}" || true`,
            {
              cwd: WORKSPACE_ROOT,
              maxBuffer: 1024 * 1024 * 5,
            }
          );

          return {
            id: command.id,
            success: true,
            data: {
              file1,
              file2,
              diff: stdout,
              hasDifferences: stdout.length > 0,
            },
          };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "headFile": {
        const { path: filePath, lines = 10 } = command.payload;
        const fullPath = sanitizePath(filePath);
        console.log(`📄 Head file: ${fullPath} (${lines} lines)`);

        try {
          if (!existsSync(fullPath)) {
            return { id: command.id, success: false, error: "File not found" };
          }

          const { stdout } = await execAsync(`head -n ${lines} "${fullPath}"`, {
            cwd: WORKSPACE_ROOT,
            maxBuffer: 1024 * 1024 * 5,
          });

          return {
            id: command.id,
            success: true,
            data: { path: filePath, lines, content: stdout },
          };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "tailFile": {
        const { path: filePath, lines = 10 } = command.payload;
        const fullPath = sanitizePath(filePath);
        console.log(`📄 Tail file: ${fullPath} (${lines} lines)`);

        try {
          if (!existsSync(fullPath)) {
            return { id: command.id, success: false, error: "File not found" };
          }

          const { stdout } = await execAsync(`tail -n ${lines} "${fullPath}"`, {
            cwd: WORKSPACE_ROOT,
            maxBuffer: 1024 * 1024 * 5,
          });

          return {
            id: command.id,
            success: true,
            data: { path: filePath, lines, content: stdout },
          };
        } catch (error: any) {
          return { id: command.id, success: false, error: error.message };
        }
      }

      case "findDuplicates": {
        const { path: dirPath, filePattern } = command.payload;
        const fullPath = sanitizePath(dirPath || ".");
        console.log(`🔍 Find duplicates: ${fullPath}`);

        try {
          if (!existsSync(fullPath)) {
            return {
              id: command.id,
              success: false,
              error: "Directory not found",
            };
          }

          const findPattern = filePattern
            ? `-name "${filePattern}"`
            : "-type f";
          const { stdout } = await execAsync(
            `find "${fullPath}" ${findPattern} -type f -exec md5sum {} + 2>/dev/null || true`,
            {
              cwd: WORKSPACE_ROOT,
              maxBuffer: 1024 * 1024 * 10,
            }
          );

          const hashMap = new Map<string, string[]>();

          stdout.split("\n").forEach((line) => {
            if (!line.trim()) return;
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
              const hash = parts[0];
              const file = parts
                .slice(1)
                .join(" ")
                .replace(fullPath + "/", "");

              if (!hashMap.has(hash)) {
                hashMap.set(hash, []);
              }
              hashMap.get(hash)!.push(file);
            }
          });

          const duplicates = Array.from(hashMap.entries())
            .filter(([_, files]) => files.length > 1)
            .map(([hash, files]) => ({ hash, files, count: files.length }));

          return {
            id: command.id,
            success: true,
            data: {
              path: dirPath,
              duplicates,
              duplicateCount: duplicates.length,
              totalDuplicateFiles: duplicates.reduce(
                (sum, d) => sum + d.count,
                0
              ),
            },
          };
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

      // Get agentId from environment (set by agent-runner)
      const agentId = process.env.AGENT_ID;
      if (!agentId) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "AGENT_ID not found in environment" }));
        return;
      }

      // Initialize agent executor (agentId is now first parameter)
      agentExecutor = new AgentExecutor(agentId, effectiveApiKey, model);

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

      // Execute agent task - events are published to Redis automatically
      console.log(`🎯 Starting agent execution...`);

      try {
        // Execute the task (it's an async generator, must iterate through it)
        console.log(`🔄 Consuming execute() generator...`);
        let chunkCount = 0;
        for await (const chunk of agentExecutor.execute(task)) {
          chunkCount++;
          console.log(
            `📦 [Server] Received chunk ${chunkCount}: "${chunk.substring(
              0,
              50
            )}${chunk.length > 50 ? "..." : ""}"`
          );
          // Chunks are already published to Redis by the executor
        }
        console.log(
          `✅ [Server] Generator completed, received ${chunkCount} chunks`
        );

        const state = agentExecutor.getState();
        console.log(`✅ Agent execution completed:`, {
          toolCalls: state.toolCallsCount,
          filesEdited: state.filesEdited.length,
        });

        // Return success response
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            state: {
              toolCallsCount: state.toolCallsCount,
              filesEditedCount: state.filesEdited.length,
            },
          })
        );
      } catch (error: any) {
        console.error(`❌ Agent execution error:`, error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
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

  // POST /command - Send command to VS Code extension (used by Live Share API)
  if (url.pathname === "/command" && req.method === "POST") {
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }

      const command = JSON.parse(body);
      console.log(`📨 Received command for VS Code extension:`, command.type);

      // Send command to VS Code extension via WebSocket
      const result = await sendToVSCodeExtension(command);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: result }));
    } catch (error: any) {
      console.error("Error in /command:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
    return;
  }

  // POST /vscode-command - Send command to VS Code extension
  if (url.pathname === "/vscode-command" && req.method === "POST") {
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }

      const command = JSON.parse(body);
      console.log(`📨 Forwarding command to VS Code extension:`, command.type);

      // Forward command to VS Code extension via WebSocket
      const result = await sendToVSCodeExtension({
        id: `checkpoint-${Date.now()}`,
        ...command,
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (error: any) {
      console.error("Error in /vscode-command:", error);
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
    POST /command - Send command to VS Code extension
    POST /vscode-command - Send command to VS Code extension (legacy)
    GET  /health - Health check`);
});

// Connect to VS Code extension
connectToVSCodeExtension();

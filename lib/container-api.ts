import { WebSocket } from "ws";

interface Command {
  id: string;
  type: string;
  payload: any;
}

interface Response {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class ContainerAPI {
  private connections = new Map<string, WebSocket>();
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
    }
  >();

  /**
   * Connect to a workspace's agent bridge
   */
  async connect(workspaceId: string, agentPort: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${agentPort}`);

      ws.on("open", () => {
        console.log(`✅ Connected to workspace ${workspaceId} agent bridge`);
        this.connections.set(workspaceId, ws);
        resolve();
      });

      ws.on("message", (data: Buffer) => {
        try {
          const response: Response = JSON.parse(data.toString());

          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            if (response.success) {
              pending.resolve(response.data);
            } else {
              pending.reject(new Error(response.error || "Command failed"));
            }
            this.pendingRequests.delete(response.id);
          }
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      });

      ws.on("error", (error) => {
        console.error(`WebSocket error for ${workspaceId}:`, error);
        reject(error);
      });

      ws.on("close", () => {
        console.log(`🔌 Connection closed for workspace ${workspaceId}`);
        this.connections.delete(workspaceId);
      });
    });
  }

  /**
   * Disconnect from a workspace
   */
  disconnect(workspaceId: string): void {
    const ws = this.connections.get(workspaceId);
    if (ws) {
      ws.close();
      this.connections.delete(workspaceId);
    }
  }

  /**
   * Send a command to the agent bridge
   */
  private async sendCommand(
    workspaceId: string,
    type: string,
    payload: any
  ): Promise<any> {
    const ws = this.connections.get(workspaceId);
    if (!ws) {
      throw new Error(`Not connected to workspace ${workspaceId}`);
    }

    const id = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const command: Command = { id, type, payload };

    return new Promise((resolve, reject) => {
      // Store promise resolvers
      this.pendingRequests.set(id, { resolve, reject });

      // Send command
      ws.send(JSON.stringify(command));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Command timeout"));
        }
      }, 30000);
    });
  }

  /**
   * Read a file from the workspace
   */
  async readFile(workspaceId: string, path: string): Promise<string> {
    return await this.sendCommand(workspaceId, "readFile", { path });
  }

  /**
   * Write a file to the workspace
   */
  async writeFile(
    workspaceId: string,
    path: string,
    content: string
  ): Promise<void> {
    await this.sendCommand(workspaceId, "writeFile", { path, content });
  }

  /**
   * List files in a directory
   */
  async listFiles(workspaceId: string, path: string = "."): Promise<any[]> {
    return await this.sendCommand(workspaceId, "listFiles", { path });
  }

  /**
   * Get recursive file tree for workspace
   */
  async fileTree(workspaceId: string, path: string = "."): Promise<any[]> {
    return await this.sendCommand(workspaceId, "fileTree", { path });
  }

  /**
   * Execute a command in the workspace
   */
  async runCommand(
    workspaceId: string,
    command: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return await this.sendCommand(workspaceId, "runCommand", { command });
  }

  /**
   * Search code in the workspace
   */
  async searchCode(workspaceId: string, query: string): Promise<string> {
    return await this.sendCommand(workspaceId, "searchCode", { query });
  }

  /**
   * Git commit
   */
  async gitCommit(workspaceId: string, message: string): Promise<string> {
    return await this.sendCommand(workspaceId, "gitCommit", { message });
  }

  /**
   * Git push
   */
  async gitPush(workspaceId: string): Promise<string> {
    return await this.sendCommand(workspaceId, "gitPush", {});
  }

  /**
   * Get console logs from the workspace
   */
  async getConsoleLogs(
    workspaceId: string,
    options?: { level?: "log" | "error" | "warn" | "info"; limit?: number }
  ): Promise<any[]> {
    return await this.sendCommand(workspaceId, "getConsoleLogs", options || {});
  }

  /**
   * Clear console logs
   */
  async clearConsoleLogs(workspaceId: string): Promise<void> {
    await this.sendCommand(workspaceId, "clearConsoleLogs", {});
  }

  /**
   * Report an error to the workspace
   */
  async reportError(
    workspaceId: string,
    error: {
      message: string;
      level?: "error" | "warn" | "info";
      source?: string;
      stack?: string;
    }
  ): Promise<void> {
    await this.sendCommand(workspaceId, "reportError", error);
  }

  /**
   * Get lint errors for a file or directory
   */
  async getLintErrors(workspaceId: string, path?: string): Promise<any[]> {
    return await this.sendCommand(workspaceId, "getLintErrors", { path });
  }

  /**
   * Watch a file for changes
   */
  async watchFile(workspaceId: string, path: string): Promise<any> {
    return await this.sendCommand(workspaceId, "watchFile", { path });
  }

  /**
   * Get VS Code problems/diagnostics
   */
  async getVSCodeProblems(
    workspaceId: string,
    severity?: "error" | "warning" | "info" | "hint"
  ): Promise<any> {
    return await this.sendCommand(workspaceId, "getVSCodeProblems", {
      severity,
    });
  }

  // ========== VS Code Extension Commands ==========
  async runInTerminal(
    workspaceId: string,
    command: string,
    terminalName?: string
  ): Promise<any> {
    return await this.sendCommand(workspaceId, "runInTerminal", {
      command,
      terminalName,
    });
  }

  async getCodeActions(
    workspaceId: string,
    filePath: string,
    line: number
  ): Promise<any> {
    return await this.sendCommand(workspaceId, "getCodeActions", {
      filePath,
      line,
    });
  }

  async applyCodeAction(workspaceId: string, actionId: number): Promise<any> {
    return await this.sendCommand(workspaceId, "applyCodeAction", {
      actionId,
    });
  }

  async goToDefinition(
    workspaceId: string,
    filePath: string,
    line: number,
    character: number
  ): Promise<any> {
    return await this.sendCommand(workspaceId, "goToDefinition", {
      filePath,
      line,
      character,
    });
  }

  async findReferences(
    workspaceId: string,
    filePath: string,
    line: number,
    character: number
  ): Promise<any> {
    return await this.sendCommand(workspaceId, "findReferences", {
      filePath,
      line,
      character,
    });
  }

  async searchSymbols(workspaceId: string, query: string): Promise<any> {
    return await this.sendCommand(workspaceId, "searchSymbols", {
      query,
    });
  }

  async formatDocument(workspaceId: string, filePath: string): Promise<any> {
    return await this.sendCommand(workspaceId, "formatDocument", {
      filePath,
    });
  }

  async getHover(
    workspaceId: string,
    filePath: string,
    line: number,
    character: number
  ): Promise<any> {
    return await this.sendCommand(workspaceId, "getHover", {
      filePath,
      line,
      character,
    });
  }

  // ========== Advanced Search and Inspection Tools ==========
  async grepInFile(
    workspaceId: string,
    path: string,
    pattern: string,
    caseInsensitive?: boolean,
    contextLines?: number
  ): Promise<any> {
    return await this.sendCommand(workspaceId, "grepInFile", {
      path,
      pattern,
      caseInsensitive,
      contextLines,
    });
  }

  async grepInDirectory(
    workspaceId: string,
    path: string | undefined,
    pattern: string,
    filePattern?: string,
    caseInsensitive?: boolean,
    maxResults?: number
  ): Promise<any> {
    return await this.sendCommand(workspaceId, "grepInDirectory", {
      path,
      pattern,
      filePattern,
      caseInsensitive,
      maxResults,
    });
  }

  async countLines(
    workspaceId: string,
    path: string,
    filePattern?: string
  ): Promise<any> {
    return await this.sendCommand(workspaceId, "countLines", {
      path,
      filePattern,
    });
  }

  async fileDiff(
    workspaceId: string,
    file1: string,
    file2: string,
    unified?: boolean
  ): Promise<any> {
    return await this.sendCommand(workspaceId, "fileDiff", {
      file1,
      file2,
      unified,
    });
  }

  async headFile(
    workspaceId: string,
    path: string,
    lines?: number
  ): Promise<any> {
    return await this.sendCommand(workspaceId, "headFile", {
      path,
      lines,
    });
  }

  async tailFile(
    workspaceId: string,
    path: string,
    lines?: number
  ): Promise<any> {
    return await this.sendCommand(workspaceId, "tailFile", {
      path,
      lines,
    });
  }

  async findDuplicates(
    workspaceId: string,
    path?: string,
    filePattern?: string
  ): Promise<any> {
    return await this.sendCommand(workspaceId, "findDuplicates", {
      path,
      filePattern,
    });
  }
}

// Singleton instance
export const containerAPI = new ContainerAPI();

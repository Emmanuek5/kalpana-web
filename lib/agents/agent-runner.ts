import { prisma } from "@/lib/db";
import { dockerManager } from "@/lib/docker/manager";
import { PortManager } from "@/lib/docker/port-manager";
import { Octokit } from "@octokit/rest";
import Docker from "dockerode";
import path from "path";
import fs from "fs";

/**
 * Agent Runner - Manages execution of autonomous coding agents
 * - Creates isolated containers
 * - Clones GitHub repos
 * - Executes agent tasks
 * - Tracks file changes and tool calls
 */

interface ToolCall {
  id: string;
  type: string;
  function?: {
    name: string;
    arguments: string;
  };
  timestamp: string;
}

interface EditedFile {
  path: string;
  originalContent: string;
  newContent: string;
  diff: string;
}

class AgentRunner {
  private docker: Docker;
  private portManager: PortManager;
  private runningAgents: Map<string, boolean> = new Map();

  constructor() {
    const envHost = process.env.DOCKER_HOST;

    if (envHost && envHost.length > 0) {
      if (envHost.startsWith("unix://")) {
        this.docker = new Docker({
          socketPath: envHost.replace(/^unix:\/\//, ""),
        });
      } else if (envHost.startsWith("npipe://")) {
        this.docker = new Docker({
          socketPath: envHost.replace(/^npipe:\/\//, ""),
        });
      } else {
        const normalized = envHost.startsWith("tcp://")
          ? `http://${envHost.slice("tcp://".length)}`
          : envHost;
        try {
          const url = new URL(normalized);
          const protocol = url.protocol.replace(":", "") as "http" | "https";
          const host = url.hostname || "localhost";
          const port = url.port
            ? parseInt(url.port, 10)
            : protocol === "https"
            ? 2376
            : 2375;
          this.docker = new Docker({ protocol, host, port });
        } catch (_e) {
          this.docker = this.getDefaultDockerClient();
        }
      }
    } else {
      this.docker = this.getDefaultDockerClient();
    }

    this.portManager = new PortManager();
  }

  private getDefaultDockerClient(): Docker {
    if (process.platform === "win32") {
      return new Docker({ socketPath: "//./pipe/docker_engine" });
    }
    return new Docker({ socketPath: "/var/run/docker.sock" });
  }

  async startAgent(
    agentId: string,
    githubToken: string,
    openrouterApiKey: string
  ): Promise<void> {
    if (this.runningAgents.get(agentId)) {
      throw new Error("Agent is already running");
    }

    this.runningAgents.set(agentId, true);

    try {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
      });

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Initialize conversation history if not exists
      const conversationHistory = agent.conversationHistory
        ? JSON.parse(agent.conversationHistory)
        : [];

      // Add initial task to conversation if this is the first run
      if (conversationHistory.length === 0) {
        conversationHistory.push({
          role: "user",
          content: agent.task,
          timestamp: new Date().toISOString(),
          type: "initial_task",
        });
      }

      // Update status to CLONING
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          status: "CLONING",
          startedAt: new Date(),
          conversationHistory: JSON.stringify(conversationHistory),
        },
      });

      // Allocate port for agent communication (single port)
      let agentPort = await this.portManager.allocateAgentPort();

      // Get user details for git configuration
      const user = await prisma.user.findUnique({
        where: { id: agent.userId },
        select: { name: true, email: true },
      });

      // Create container and clone repo with retry logic for port conflicts
      let containerId: string | undefined;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          containerId = await this.createAgentContainer(
            agentId,
            agent.githubRepo,
            agent.sourceBranch,
            githubToken,
            agentPort,
            openrouterApiKey,
            agent.model,
            user?.name || undefined,
            user?.email || undefined
          );
          break; // Success, exit retry loop
        } catch (error: any) {
          // Check if it's a port binding error
          if (
            error.message &&
            (error.message.includes("port is already allocated") ||
              error.message.includes("address already in use"))
          ) {
            retries++;
            if (retries >= maxRetries) {
              throw new Error(
                `Failed to allocate port after ${maxRetries} attempts: ${error.message}`
              );
            }
            console.log(
              `⚠️ Port ${agentPort} binding failed, finding alternative (attempt ${retries}/${maxRetries})...`
            );
            agentPort = await this.portManager.findAlternativePort(agentPort);
          } else {
            // Not a port error, rethrow
            throw error;
          }
        }
      }

      if (!containerId) {
        throw new Error("Failed to create container after retries");
      }

      await prisma.agent.update({
        where: { id: agentId },
        data: {
          containerId,
          agentPort,
          status: "RUNNING",
        },
      });

      // Execute agent task with context (streams to database)
      await this.executeAgentTask(
        agentId,
        containerId,
        conversationHistory,
        agentPort,
        openrouterApiKey,
        undefined
      );

      this.runningAgents.delete(agentId);
    } catch (error: any) {
      console.error(`Agent ${agentId} error:`, error);

      await prisma.agent.update({
        where: { id: agentId },
        data: {
          status: "ERROR",
          errorMessage: error.message,
        },
      });

      // Release the allocated port
      await this.portManager.releaseAgentPort(agentId);

      this.runningAgents.delete(agentId);
    }
  }

  async resumeAgent(
    agentId: string,
    newTask: string,
    openrouterApiKey: string
  ): Promise<void> {
    // Resume uses the EXISTING container - no restart!
    if (this.runningAgents.get(agentId)) {
      throw new Error("Agent is already running");
    }

    this.runningAgents.set(agentId, true);

    try {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
      });

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Verify container still exists
      if (!agent.containerId || !agent.agentPort) {
        throw new Error(
          "Agent container not found. Please start the agent first."
        );
      }

      // Get existing conversation history
      const conversationHistory = agent.conversationHistory
        ? JSON.parse(agent.conversationHistory)
        : [];

      // Update status to RUNNING
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          status: "RUNNING",
          lastMessageAt: new Date(),
        },
      });

      // Execute agent task with full conversation context (no container recreation!)
      await this.executeAgentTask(
        agentId,
        agent.containerId,
        conversationHistory,
        agent.agentPort,
        openrouterApiKey,
        newTask
      );

      this.runningAgents.delete(agentId);
    } catch (error: any) {
      console.error(`Agent ${agentId} resume error:`, error);

      await prisma.agent.update({
        where: { id: agentId },
        data: {
          status: "ERROR",
          errorMessage: error.message,
        },
      });

      this.runningAgents.delete(agentId);
    }
  }

  private async createAgentContainer(
    agentId: string,
    githubRepo: string,
    branch: string,
    githubToken: string,
    agentPort: number,
    openrouterApiKey: string,
    model: string,
    gitUserName?: string,
    gitUserEmail?: string
  ): Promise<string> {
    // Ensure base image exists
    const imageName = "kalpana/workspace:latest";
    const images = await this.docker.listImages({
      filters: { reference: [imageName] } as any,
    });

    if (!images || images.length === 0) {
      throw new Error(
        "Base image not found. Please build kalpana/workspace:latest"
      );
    }

    // Create volume for this agent
    const volumeName = `kalpana-agent-${agentId}`;
    try {
      await this.docker.createVolume({
        Name: volumeName,
        Labels: {
          "kalpana.agent.id": agentId,
          "kalpana.managed": "true",
        },
      });
    } catch (error) {
      // Volume might exist, that's fine
    }

    // Remove existing container if any
    const containerName = `agent-${agentId}`;
    try {
      const oldContainer = this.docker.getContainer(containerName);
      const info = await oldContainer.inspect();
      if (info.State.Running) {
        await oldContainer.stop();
      }
      await oldContainer.remove({ force: true });
    } catch (_e) {
      // Container doesn't exist, that's fine
    }

    // Create new container
    const envVars = [
      `AGENT_ID=${agentId}`,
      `GITHUB_REPO=${githubRepo}`,
      `GITHUB_BRANCH=${branch}`,
      `GITHUB_TOKEN=${githubToken}`,
      `OPENROUTER_API_KEY=${openrouterApiKey}`,
      `AGENT_MODEL=${model}`,
      `AGENT_MODE=true`,
    ];

    // Add git user info if available
    if (gitUserName) {
      envVars.push(`GIT_USER_NAME=${gitUserName}`);
    }
    if (gitUserEmail) {
      envVars.push(`GIT_USER_EMAIL=${gitUserEmail}`);
    }

    const container = await this.docker.createContainer({
      Image: imageName,
      name: containerName,
      Env: envVars,
      ExposedPorts: {
        "3001/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "3001/tcp": [{ HostPort: agentPort.toString() }],
        },
        Binds: [`${volumeName}:/workspace`],
        Memory: parseInt(process.env.DEFAULT_CONTAINER_MEMORY || "2147483648"),
        NanoCpus: parseInt(process.env.DEFAULT_CONTAINER_CPU || "1000000000"),
        AutoRemove: false,
      },
      Labels: {
        "kalpana.agent.id": agentId,
        "kalpana.managed": "true",
      },
      WorkingDir: "/workspace",
    });

    await container.start();

    // Wait for repo to be cloned
    await this.waitForRepoClone(container.id);

    return container.id;
  }

  private async waitForRepoClone(containerId: string): Promise<void> {
    const maxAttempts = 90; // Increased from 30 to 90 (3 minutes total)
    const delayMs = 2000;

    console.log(
      `⏳ Waiting for repository to clone (max ${
        (maxAttempts * delayMs) / 1000
      }s)...`
    );

    for (let i = 0; i < maxAttempts; i++) {
      try {
        // First check: Look for the success message in container logs
        const container = this.docker.getContainer(containerId);
        const logsStream = await container.logs({
          stdout: true,
          stderr: true,
          tail: 100,
        });
        const logsOutput = logsStream.toString();

        // Check if clone success message is in logs
        if (logsOutput.includes("Repository cloned successfully")) {
          console.log(
            `✅ Repository clone confirmed via logs after ${
              (i + 1) * (delayMs / 1000)
            }s`
          );
          // Wait an additional 2 seconds to ensure filesystem sync
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return;
        }

        // Second check: Test for .git directory
        const exec = await container.exec({
          Cmd: ["test", "-d", "/workspace/.git"],
          AttachStdout: true,
          AttachStderr: true,
        });

        const stream = await exec.start({ Detach: false });
        const inspectResult = await exec.inspect();

        if (inspectResult.ExitCode === 0) {
          console.log(
            `✅ Repository detected via .git directory after ${
              (i + 1) * (delayMs / 1000)
            }s`
          );
          // Wait an additional 2 seconds to ensure the clone is fully complete
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return;
        }
      } catch (error: any) {
        // Container might not be ready yet or command failed
        if (i % 10 === 0) {
          console.log(
            `⏳ Still waiting for clone... (attempt ${i + 1}/${maxAttempts})`
          );
        }
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // One final check before giving up
    try {
      const container = this.docker.getContainer(containerId);
      const logsStream = await container.logs({
        stdout: true,
        stderr: true,
        tail: 200,
      });
      const logsOutput = logsStream.toString();

      if (logsOutput.includes("Repository cloned successfully")) {
        console.log(`✅ Repository clone confirmed via logs on final attempt`);
        return;
      }

      const exec = await container.exec({
        Cmd: ["test", "-d", "/workspace/.git"],
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream = await exec.start({ Detach: false });
      const inspectResult = await exec.inspect();
      if (inspectResult.ExitCode === 0) {
        console.log(`✅ Repository detected on final attempt`);
        return;
      }
    } catch (_e) {
      // Final attempt failed
    }

    throw new Error(
      "Timeout waiting for repository to clone - exceeded 3 minutes"
    );
  }

  private async executeAgentTask(
    agentId: string,
    containerId: string,
    conversationHistory: any[],
    agentPort: number,
    openrouterApiKey: string,
    newTask?: string
  ): Promise<void> {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new Error("Agent not found");
    }

    // Determine the task (new task for resume, or initial task for start)
    const task = newTask || agent.task;

    // Always use /agent/execute with conversation history
    // This ensures the agent is properly initialized every time
    const endpoint = `http://localhost:${agentPort}/agent/execute`;

    const requestBody = {
      task,
      apiKey: openrouterApiKey,
      model: agent.model,
      conversationHistory: conversationHistory.filter(
        (msg) => msg.role === "user" || msg.role === "assistant"
      ),
    };

    console.log(`📤 Sending task to agent container: ${endpoint}`);
    console.log(
      `   Task: ${task.substring(0, 100)}${task.length > 100 ? "..." : ""}`
    );
    console.log(`   Model: ${agent.model}`);
    console.log(
      `   Conversation history: ${
        conversationHistory.filter(
          (msg) => msg.role === "user" || msg.role === "assistant"
        ).length
      } messages`
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(
          `Agent container returned error: ${response.status} ${response.statusText}`
        );
      }

      // Stream the response
      let fullResponse = "";
      const toolCallsCollected: any[] = [];
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body stream available");
      }

      // Track last save time for incremental updates
      let lastSaveTime = Date.now();
      const SAVE_INTERVAL_MS = 2000; // Save every 2 seconds

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              // Handle errors FIRST and outside of the generic catch
              if (data.type === "error") {
                console.error(
                  `❌ Agent container reported error: ${data.error}`
                );
                throw new Error(data.error || "Agent execution failed");
              }

              if (data.type === "text") {
                fullResponse += data.content;
                // Don't log every tiny chunk, just show we're receiving
                if (fullResponse.length % 500 === 0) {
                  console.log(
                    `📝 Agent streaming... (${fullResponse.length} chars so far)`
                  );
                }

                // Save incrementally every 2 seconds while streaming
                const now = Date.now();
                if (now - lastSaveTime > SAVE_INTERVAL_MS) {
                  lastSaveTime = now;

                  // Update with current progress
                  const tempHistory = [
                    ...conversationHistory,
                    {
                      role: "assistant",
                      content: fullResponse,
                      timestamp: new Date().toISOString(),
                      streaming: true,
                    },
                  ];

                  await prisma.agent.update({
                    where: { id: agentId },
                    data: {
                      conversationHistory: JSON.stringify(tempHistory),
                      toolCalls: JSON.stringify(toolCallsCollected),
                      lastMessageAt: new Date(),
                    },
                  });
                }
              } else if (data.type === "tool-call") {
                // Collect tool call information for display
                toolCallsCollected.push({
                  id: data.toolCallId || Date.now().toString(),
                  type: "function",
                  function: {
                    name: data.toolName,
                    arguments: JSON.stringify(data.args || {}),
                  },
                  timestamp: new Date().toISOString(),
                });
                console.log(`🔧 Tool called: ${data.toolName}`);

                // Save tool calls immediately
                await prisma.agent.update({
                  where: { id: agentId },
                  data: {
                    toolCalls: JSON.stringify(toolCallsCollected),
                    lastMessageAt: new Date(),
                  },
                });
              } else if (data.type === "done") {
                console.log(`✅ Agent task completed`);
                console.log(
                  `   Response: ${fullResponse.substring(0, 200)}${
                    fullResponse.length > 200 ? "..." : ""
                  }`
                );
                console.log(
                  `   Total response length: ${fullResponse.length} chars`
                );
                console.log(
                  `   Files edited: ${data.state?.filesEdited?.length || 0}`
                );
                console.log(
                  `   Tool calls: ${data.state?.toolCallsCount || 0}`
                );

                // Add final assistant response to conversation history
                conversationHistory.push({
                  role: "assistant",
                  content: fullResponse,
                  timestamp: new Date().toISOString(),
                });

                // Update agent in database with final results
                await prisma.agent.update({
                  where: { id: agentId },
                  data: {
                    conversationHistory: JSON.stringify(conversationHistory),
                    filesEdited: JSON.stringify(data.state?.filesEdited || []),
                    toolCalls: JSON.stringify(toolCallsCollected),
                    status: "COMPLETED",
                    completedAt: new Date(),
                    lastMessageAt: new Date(),
                  },
                });
              }
            } catch (e: any) {
              // Only skip lines that are genuinely invalid JSON
              // Re-throw actual errors from agent execution
              if (
                e.message &&
                (e.message.includes("Agent") ||
                  e.message.includes("Authentication"))
              ) {
                throw e;
              }
              // Skip invalid JSON lines silently
              console.debug(`Skipping invalid SSE line: ${line}`);
            }
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ Agent execution error:`, error);

      // Save error to database
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          status: "ERROR",
          errorMessage: error.message || "Unknown error occurred",
          lastMessageAt: new Date(),
        },
      });

      throw error;
    }
  }

  private async execInContainer(
    containerId: string,
    command: string[]
  ): Promise<{ stdout: string; stderr: string }> {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ Detach: false });

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";

      stream.on("data", (chunk: Buffer) => {
        const header = chunk.readUInt8(0);
        const data = chunk.slice(8).toString("utf-8");

        if (header === 1) {
          stdout += data;
        } else if (header === 2) {
          stderr += data;
        }
      });

      stream.on("end", () => {
        resolve({ stdout, stderr });
      });

      stream.on("error", reject);
    });
  }

  async stopAgent(agentId: string): Promise<void> {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent || !agent.containerId) {
      return;
    }

    try {
      const container = this.docker.getContainer(agent.containerId);
      await container.stop();
      await container.remove({ force: true });
    } catch (_e) {
      // Container might not exist
    }

    this.runningAgents.delete(agentId);

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: "IDLE",
        containerId: null,
      },
    });
  }
}

export const agentRunner = new AgentRunner();

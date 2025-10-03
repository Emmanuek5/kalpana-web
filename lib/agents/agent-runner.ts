import { prisma } from "@/lib/db";
import { dockerManager } from "@/lib/docker/manager";
import { PortManager } from "@/lib/docker/port-manager";
import { Octokit } from "@octokit/rest";
import Docker from "dockerode";
import path from "path";
import fs from "fs";
import { EventEmitter } from "events";
import { createClient } from "redis";

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

export interface AgentStreamEvent {
  type: "text" | "tool-call" | "tool-result" | "status" | "files" | "done" | "error" | "message";
  agentId: string;
  data?: any;
  timestamp: string;
}

class AgentRunner {
  private docker: Docker;
  private portManager: PortManager;
  private runningAgents: Map<string, boolean> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private redis: ReturnType<typeof createClient> | null = null;

  // Increase max listeners to handle multiple concurrent streams
  constructor() {
    this.eventEmitter.setMaxListeners(100);
    // Initialize Redis asynchronously (don't await in constructor)
    this.initializeRedis().catch(err => 
      console.error('[Agent Runner] Redis initialization failed:', err)
    );

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

  /**
   * Subscribe to real-time agent events for streaming
   */
  subscribeToAgent(
    agentId: string,
    callback: (event: AgentStreamEvent) => void
  ): () => void {
    const listener = (event: AgentStreamEvent) => {
      if (event.agentId === agentId) {
        callback(event);
      }
    };

    this.eventEmitter.on("agent-event", listener);

    // Return unsubscribe function
    return () => {
      this.eventEmitter.off("agent-event", listener);
    };
  }

  /**
   * Emit an agent event for real-time streaming
   */
  private emitAgentEvent(
    agentId: string,
    type: AgentStreamEvent["type"],
    data?: any
  ): void {
    const event: AgentStreamEvent = {
      type,
      agentId,
      data,
      timestamp: new Date().toISOString(),
    };
    console.log(`[Agent Runner] Emitting event type: ${type} for agent ${agentId}`);
    console.log(`[Agent Runner] Event listeners count:`, this.eventEmitter.listenerCount("agent-event"));
    this.eventEmitter.emit("agent-event", event);
  }

  private async initializeRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    try {
      this.redis = createClient({ url: redisUrl });
      
      this.redis.on('error', (err) => {
        console.error('[Agent Runner] Redis error:', err);
      });
      
      await this.redis.connect();
      console.log('[Agent Runner] ✅ Redis connected');
    } catch (error) {
      console.error('[Agent Runner] ❌ Failed to connect to Redis:', error);
      // Continue without Redis - agent will still work but no real-time events
    }
  }

  private async publishStatusToRedis(agentId: string, status: string): Promise<void> {
    if (!this.redis) return;
    
    try {
      const event = {
        type: 'status',
        agentId,
        status,
        timestamp: Date.now()
      };
      
      await this.redis.publish(
        `agent:${agentId}:events`,
        JSON.stringify(event)
      );
      
      console.log(`[Agent Runner] 📡 Published status ${status} for agent ${agentId}`);
    } catch (error) {
      console.error('[Agent Runner] Failed to publish status to Redis:', error);
    }
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
      // Update status to show we're setting up infrastructure
      await prisma.agent.update({
        where: { id: agentId },
        data: { 
          status: 'CLONING',
          errorMessage: null
        }
      });
      
      // Publish status to Redis for real-time updates
      await this.publishStatusToRedis(agentId, 'CLONING');
      
      // Ensure Redis is running (creates container if needed)
      await dockerManager.ensureRedis();
      console.log('✅ Redis ensured for agent', agentId);
      
      // Ensure Socket.io container is running
      await dockerManager.ensureSocketIO();
      console.log('✅ Socket.io ensured for agent', agentId);
      
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
      
      // Publish status to Redis for real-time updates
      await this.publishStatusToRedis(agentId, 'CLONING');

      // Allocate port for agent communication (single port)
      // This checks BOTH database AND OS-level availability
      let agentPort = await this.portManager.allocateAgentPort();

      // CRITICAL: Reserve the port in database IMMEDIATELY to prevent race conditions
      // This ensures no other agent can get the same port while we create the container
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          agentPort, // Reserve port immediately
        },
      });
      console.log(`🔒 Reserved port ${agentPort} for agent ${agentId}`);

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
            (agent as any).model || "anthropic/claude-3.5-sonnet",
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
            // Find alternative and update DB immediately
            agentPort = await this.portManager.findAlternativePort(agentPort);
            await prisma.agent.update({
              where: { id: agentId },
              data: {
                agentPort, // Update to new port
              },
            });
            console.log(
              `🔒 Reserved alternative port ${agentPort} for agent ${agentId}`
            );
          } else {
            // Not a port error, rethrow
            throw error;
          }
        }
      }

      if (!containerId) {
        throw new Error("Failed to create container after retries");
      }

      // Update status to RUNNING now that container is ready
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          containerId,
          status: "RUNNING",
        },
      });

      console.log(`🚀 Agent ${agentId} status updated to RUNNING`);

      // Emit status change event
      this.emitAgentEvent(agentId, "status", { status: "RUNNING" });

      // Execute agent task with context (streams to database and real-time)
      console.log(`🤖 Starting agent task execution for ${agentId}`);
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

      // Try to update agent status, but don't fail if agent was deleted
      try {
        await prisma.agent.update({
          where: { id: agentId },
          data: {
            status: "ERROR",
            errorMessage: error.message,
          },
        });
        console.log(`✅ Updated agent ${agentId} status to ERROR`);
      } catch (updateError: any) {
        console.warn(`⚠️ Could not update agent ${agentId} status (may have been deleted):`, updateError.message);
      }

      // Emit error event
      this.emitAgentEvent(agentId, "error", { error: error.message });

      // Release the allocated port
      try {
        await this.portManager.releaseAgentPort(agentId);
      } catch (portError: any) {
        console.warn(`⚠️ Could not release port for agent ${agentId}:`, portError.message);
      }

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

      // Emit status change event
      this.emitAgentEvent(agentId, "status", { status: "RUNNING" });

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

      // Emit error event
      this.emitAgentEvent(agentId, "error", { error: error.message });

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
      `REDIS_URL=redis://host.docker.internal:6379`,
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
      model: (agent as any).model || "anthropic/claude-3.5-sonnet",
      conversationHistory: conversationHistory.filter(
        (msg) => msg.role === "user" || msg.role === "assistant"
      ),
    };

    console.log(`📤 Sending task to agent container: ${endpoint}`);
    console.log(
      `   Task: ${task.substring(0, 100)}${task.length > 100 ? "..." : ""}`
    );
    console.log(`   Model: ${(agent as any).model}`);
    console.log(
      `   Conversation history: ${
        conversationHistory.filter(
          (msg) => msg.role === "user" || msg.role === "assistant"
        ).length
      } messages`
    );

    // Set up timeout to detect stuck agents (10 minutes of no activity)
    let lastActivityTime = Date.now();
    const ACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
    
    const activityCheckInterval = setInterval(async () => {
      const timeSinceLastActivity = Date.now() - lastActivityTime;
      if (timeSinceLastActivity > ACTIVITY_TIMEOUT) {
        console.error(`⏱️ Agent ${agentId} timed out after ${ACTIVITY_TIMEOUT / 1000}s of inactivity`);
        clearInterval(activityCheckInterval);
        
        // Update agent status to ERROR
        await prisma.agent.update({
          where: { id: agentId },
          data: {
            status: "ERROR",
            errorMessage: "Agent execution timed out due to inactivity",
            lastMessageAt: new Date(),
          },
        });
        
        // Emit error event
        this.emitAgentEvent(agentId, "error", {
          error: "Agent execution timed out due to inactivity",
        });
      }
    }, 30000); // Check every 30 seconds

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
        const toolResultsCollected: any[] = [];
        const filesEditedCollected: any[] = [];
        
        // Track assistant message parts (like workspace agent)
        const assistantParts: any[] = [];
        
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

              // Reset activity timer on any data received
              lastActivityTime = Date.now();

              // Handle errors FIRST and outside of the generic catch
              if (data.type === "error") {
                console.error(
                  `❌ Agent container reported error: ${data.error}`
                );
                clearInterval(activityCheckInterval);
                throw new Error(data.error || "Agent execution failed");
              }

              if (data.type === "text") {
                fullResponse += data.content;

                // Emit text chunk in real-time for streaming display
                this.emitAgentEvent(agentId, "text", { content: data.content });

             

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
                // Add tool call as a message part (like workspace agent)
                const toolCallPart = {
                  type: "tool-call",
                  toolCallId: data.toolCallId,
                  toolName: data.toolName,
                  args: data.args,
                };
                
                assistantParts.push(toolCallPart);
                
                // Add to toolCallsCollected with proper format for Activity tab
                toolCallsCollected.push({
                  id: data.toolCallId,
                  type: "function",
                  function: {
                    name: data.toolName,
                    arguments: JSON.stringify(data.args || {}),
                  },
                  timestamp: new Date().toISOString(),
                  state: "executing" as const,
                  toolName: data.toolName, // Also include flat for easier access
                  args: data.args,
                });
                
                console.log(`🔧 Tool called: ${data.toolName}`);
                console.log(`   Arguments:`, data.args);
                
                // Save to database immediately so Activity tab shows in real-time
                await prisma.agent.update({
                  where: { id: agentId },
                  data: {
                    toolCalls: JSON.stringify(toolCallsCollected),
                    lastMessageAt: new Date(),
                  },
                });

                // Emit tool call event in real-time
                this.emitAgentEvent(agentId, "tool-call", { 
                  toolCallId: data.toolCallId,
                  toolName: data.toolName,
                  args: data.args,
                });
              } else if (data.type === "tool-result") {
                // Add tool result as a message part
                const toolResultPart = {
                  type: "tool-result",
                  toolCallId: data.toolCallId,
                  toolName: data.toolName,
                  result: data.result,
                };
                
                assistantParts.push(toolResultPart);
                
                // Update the corresponding tool call with result and mark as complete
                console.log(`🔍 Looking for tool call with ID: ${data.toolCallId}`);
                console.log(`🔍 Current toolCallsCollected:`, JSON.stringify(toolCallsCollected.map(tc => ({ id: tc.id, toolName: (tc as any).toolName }))));
                
                const toolCall = toolCallsCollected.find(
                  tc => tc.id === data.toolCallId || (tc as any).toolCallId === data.toolCallId
                );
                
                if (toolCall) {
                  (toolCall as any).state = "complete";
                  (toolCall as any).result = data.result;
                  (toolCall as any).completedAt = new Date().toISOString();
                  console.log(`✅ Tool ${data.toolName} marked complete in toolCallsCollected`);
                
                  
                  // Save to database immediately so Activity tab shows completion
                  await prisma.agent.update({
                    where: { id: agentId },
                    data: {
                      toolCalls: JSON.stringify(toolCallsCollected),
                      lastMessageAt: new Date(),
                    },
                  });
                  console.log(`✅ Saved updated toolCallsCollected to database (${toolCallsCollected.length} calls)`);
                } else {
                  console.error(`⚠️ Tool call ${data.toolCallId} NOT FOUND in toolCallsCollected!`);
                  console.error(`⚠️ Available IDs:`, toolCallsCollected.map(tc => tc.id));
                }
                
                console.log(`📤 Tool result: ${data.toolName}`);
                console.log(`   Result:`, data.result);

                // Emit tool result event in real-time
                this.emitAgentEvent(agentId, "tool-result", {
                  toolCallId: data.toolCallId,
                  toolName: data.toolName,
                  result: data.result,
                });
              } else if (data.type === "file-edit") {
                // Track file edits in real-time
                console.log(`📝 [Agent Runner] ✅ Received file-edit event:`, JSON.stringify(data.fileEdit));
                
                // Ensure file edit has all required fields
                const fileEdit = {
                  path: data.fileEdit.path,
                  operation: data.fileEdit.operation,
                  timestamp: data.fileEdit.timestamp || new Date().toISOString(),
                  diff: data.fileEdit.diff || null,
                  newContent: data.fileEdit.newContent || null,
                  oldContent: data.fileEdit.oldContent || null,
                };
                
                filesEditedCollected.push(fileEdit);
                
                console.log(`📝 [Agent Runner] File edited: ${fileEdit.path} (${fileEdit.operation})`);
                console.log(`📝 [Agent Runner] Total files edited: ${filesEditedCollected.length}`);
                console.log(`📝 [Agent Runner] Files array:`, JSON.stringify(filesEditedCollected.map(f => ({ path: f.path, op: f.operation }))));
                
                // Save files to database immediately
                await prisma.agent.update({
                  where: { id: agentId },
                  data: {
                    filesEdited: JSON.stringify(filesEditedCollected),
                    lastMessageAt: new Date(),
                  },
                });
                console.log(`📝 [Agent Runner] ✅ Saved ${filesEditedCollected.length} files to database`);
                
                // Emit file edit event
                this.emitAgentEvent(agentId, "files", {
                  files: filesEditedCollected,
                });
                console.log(`📝 [Agent Runner] ✅ Emitted 'files' event with ${filesEditedCollected.length} files`);
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

                // Build final assistant message with all parts (text + tool calls/results)
                // Remove temporary streaming messages
                conversationHistory = conversationHistory.filter(
                  msg => !(msg as any).streaming
                );
                
                // Add text part if there's any content
                if (fullResponse && fullResponse.trim()) {
                  assistantParts.unshift({ type: "text", text: fullResponse });
                }
                
                // Create final assistant message with parts (like workspace agent)
                const finalMessage = {
                  role: "assistant",
                  content: JSON.stringify(assistantParts),
                  timestamp: new Date().toISOString(),
                };
                
                conversationHistory.push(finalMessage);
                
                // Emit the complete message
                this.emitAgentEvent(agentId, "message", {
                  message: finalMessage,
                });

                // Emit files edited event
                if (data.state?.filesEdited?.length > 0) {
                  this.emitAgentEvent(agentId, "files", {
                    files: data.state.filesEdited,
                  });
                }

                // Update agent in database with final results
                await prisma.agent.update({
                  where: { id: agentId },
                  data: {
                    conversationHistory: JSON.stringify(conversationHistory),
                    filesEdited: JSON.stringify(filesEditedCollected),
                    toolCalls: JSON.stringify(toolCallsCollected),
                    status: "COMPLETED",
                    completedAt: new Date(),
                    lastMessageAt: new Date(),
                  },
                });

                // Emit done event in real-time (minimal data only)
                this.emitAgentEvent(agentId, "done", {
                  status: "COMPLETED",
                  filesEditedCount: filesEditedCollected.length,
                  toolCallsCount: toolCallsCollected.length,
                });
                
                // Clear activity timeout
                clearInterval(activityCheckInterval);
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

      // Clear activity timeout
      clearInterval(activityCheckInterval);

      // Save error to database
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          status: "ERROR",
          errorMessage: error.message || "Unknown error occurred",
          lastMessageAt: new Date(),
        },
      });

      // Emit error event
      this.emitAgentEvent(agentId, "error", {
        error: error.message || "Unknown error occurred",
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

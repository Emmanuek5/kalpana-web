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

  async startAgent(agentId: string, githubToken: string): Promise<void> {
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

      // Allocate port for agent communication
      const { agentPort } = await this.portManager.allocatePorts();

      // Create container and clone repo
      const containerId = await this.createAgentContainer(
        agentId,
        agent.githubRepo,
        agent.sourceBranch,
        githubToken,
        agentPort
      );

      await prisma.agent.update({
        where: { id: agentId },
        data: {
          containerId,
          agentPort,
          status: "RUNNING",
        },
      });

      // Execute agent task with context
      await this.executeAgentTask(agentId, containerId, conversationHistory);

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

      this.runningAgents.delete(agentId);
    }
  }

  async resumeAgent(
    agentId: string,
    newTask: string,
    githubToken: string
  ): Promise<void> {
    // Resume is similar to start, but maintains existing context
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

      // Get existing conversation history
      const conversationHistory = agent.conversationHistory
        ? JSON.parse(agent.conversationHistory)
        : [];

      // Update status to CLONING
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          status: "CLONING",
          startedAt: new Date(),
        },
      });

      // Allocate port for agent communication
      const { agentPort } = await this.portManager.allocatePorts();

      // Create container and clone repo
      const containerId = await this.createAgentContainer(
        agentId,
        agent.githubRepo,
        agent.sourceBranch,
        githubToken,
        agentPort
      );

      await prisma.agent.update({
        where: { id: agentId },
        data: {
          containerId,
          agentPort,
          status: "RUNNING",
        },
      });

      // Execute agent task with full conversation context
      await this.executeAgentTask(agentId, containerId, conversationHistory);

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
    agentPort: number
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
    const container = await this.docker.createContainer({
      Image: imageName,
      name: containerName,
      Env: [
        `AGENT_ID=${agentId}`,
        `GITHUB_REPO=${githubRepo}`,
        `GITHUB_BRANCH=${branch}`,
        `GITHUB_TOKEN=${githubToken}`,
        `AGENT_MODE=true`,
      ],
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
    const maxAttempts = 30;
    const delayMs = 2000;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const exec = await this.docker.getContainer(containerId).exec({
          Cmd: ["test", "-d", "/workspace/.git"],
          AttachStdout: true,
          AttachStderr: true,
        });

        const stream = await exec.start({ Detach: false });
        const inspectResult = await exec.inspect();

        if (inspectResult.ExitCode === 0) {
          console.log("Repository cloned successfully");
          return;
        }
      } catch (_e) {
        // Not ready yet
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error("Timeout waiting for repository to clone");
  }

  private async executeAgentTask(
    agentId: string,
    containerId: string,
    conversationHistory: any[]
  ): Promise<void> {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new Error("Agent not found");
    }

    const toolCalls: ToolCall[] = [];
    const filesEdited: EditedFile[] = [];

    // Get list of files in repo
    const { stdout: filesOutput } = await this.execInContainer(containerId, [
      "find",
      "/workspace",
      "-type",
      "f",
      "-not",
      "-path",
      "*/.git/*",
    ]);

    const files = filesOutput
      .split("\n")
      .filter((f) => f.trim())
      .map((f) => f.replace("/workspace/", ""));

    // Read file contents
    const fileContents = await Promise.all(
      files.slice(0, 50).map(async (filePath) => {
        try {
          const { stdout } = await this.execInContainer(containerId, [
            "cat",
            `/workspace/${filePath}`,
          ]);
          return { path: filePath, content: stdout };
        } catch (_e) {
          return null;
        }
      })
    );

    const validFiles = fileContents.filter((f) => f !== null) as {
      path: string;
      content: string;
    }[];

    // Get the latest task from conversation history
    const latestUserMessage = [...conversationHistory]
      .reverse()
      .find((msg) => msg.role === "user");

    const currentTask = latestUserMessage?.content || agent.task;

    // Log task execution with context
    toolCalls.push({
      id: Date.now().toString(),
      type: "function",
      function: {
        name: "execute_with_context",
        arguments: JSON.stringify({
          currentTask,
          previousMessages: conversationHistory.length,
          filesAvailable: validFiles.length,
        }),
      },
      timestamp: new Date().toISOString(),
    });

    // TODO: Integrate actual AI agent execution with conversation context
    // This would use the agent-tools and execute the task with full context
    // The agent will have access to:
    // - All previous conversation messages
    // - Previously edited files
    // - Current repository state

    // Add assistant response to conversation
    const assistantResponse = {
      role: "assistant",
      content: `Analyzing repository and executing task with context from ${conversationHistory.length} previous messages...`,
      timestamp: new Date().toISOString(),
      type: "execution",
    };

    conversationHistory.push(assistantResponse);

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        toolCalls: JSON.stringify(toolCalls),
        filesEdited: JSON.stringify(filesEdited),
        conversationHistory: JSON.stringify(conversationHistory),
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
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
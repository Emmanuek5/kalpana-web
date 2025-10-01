import Docker from "dockerode";
import { PortManager } from "./port-manager";
import { prisma } from "@/lib/db";
import path from "path";
import fs from "fs";

export interface WorkspaceContainer {
  containerId: string;
  vscodePort: number;
  agentPort: number;
  workspaceId: string;
}

export class DockerManager {
  private docker: Docker;
  private portManager: PortManager;
  private static buildInProgress: Promise<void> | null = null;

  constructor() {
    // Connect to Docker honoring DOCKER_HOST when present
    const envHost = process.env.DOCKER_HOST;

    if (envHost && envHost.length > 0) {
      // Handle unix://, npipe://, tcp:// and http(s):// forms
      if (envHost.startsWith("unix://")) {
        this.docker = new Docker({
          socketPath: envHost.replace(/^unix:\/\//, ""),
        });
      } else if (envHost.startsWith("npipe://")) {
        // dockerode expects a Windows named pipe path like //./pipe/docker_engine
        this.docker = new Docker({
          socketPath: envHost.replace(/^npipe:\/\//, ""),
        });
      } else {
        // Normalize tcp:// to http:// for URL parsing
        const normalized = envHost.startsWith("tcp://")
          ? `http://${envHost.slice("tcp://".length)}`
          : envHost;
        try {
          const url = new URL(normalized);
          const protocol = url.protocol.replace(":", "") as "http" | "https"; // http or https
          const host = url.hostname || "localhost";
          const port = url.port
            ? parseInt(url.port, 10)
            : protocol === "https"
            ? 2376
            : 2375;
          this.docker = new Docker({ protocol, host, port });
        } catch (_e) {
          // Fallback to defaults if DOCKER_HOST is malformed
          this.docker = this.getDefaultDockerClient();
        }
      }
    } else {
      // No DOCKER_HOST provided: choose sensible OS defaults
      this.docker = this.getDefaultDockerClient();
    }

    this.portManager = new PortManager();
  }

  private getDefaultDockerClient(): Docker {
    if (process.platform === "win32") {
      // Windows Docker Desktop default named pipe
      return new Docker({ socketPath: "//./pipe/docker_engine" });
    }
    // Linux/Mac default Unix socket
    return new Docker({ socketPath: "/var/run/docker.sock" });
  }

  private async ensureImage(imageName: string): Promise<void> {
    const images = await this.docker.listImages({
      filters: { reference: [imageName] } as any,
    });

    if (images && images.length > 0) return;

    // If another call is already building the image, wait for it
    if (DockerManager.buildInProgress) {
      await DockerManager.buildInProgress;
      return;
    }

    const buildPromise = (async () => {
      // Determine docker build context: prefer repoRoot/container, then repoRoot/kalpana/container, or env override
      const cwd = process.cwd();
      const envDir = process.env.KALPANA_CONTAINER_DIR;
      const candidates = [
        envDir ? path.resolve(cwd, envDir) : "",
        path.resolve(cwd, "container"),
        path.resolve(cwd, "kalpana", "container"),
      ].filter(Boolean) as string[];

      const dockerfileContextPath = candidates.find((p) =>
        fs.existsSync(path.join(p, "Dockerfile"))
      );

      if (!dockerfileContextPath) {
        const suggested = "container";
        throw new Error(
          `Base image not found and automatic build failed to locate Dockerfile. Please build it manually:\n  docker build -t ${imageName} ${suggested}`
        );
      }

      const tar = await import("tar-fs");
      const fsTar = tar.pack(dockerfileContextPath);

      await new Promise<void>((resolve, reject) => {
        this.docker.buildImage(
          fsTar as unknown as NodeJS.ReadableStream,
          { t: imageName },
          (err, stream) => {
            if (err || !stream) return reject(err);
            this.docker.modem.followProgress(
              stream,
              (buildErr: any) => (buildErr ? reject(buildErr) : resolve()),
              () => {}
            );
          }
        );
      });
    })();

    DockerManager.buildInProgress = buildPromise.finally(() => {
      DockerManager.buildInProgress = null;
    });

    await DockerManager.buildInProgress;
  }

  /**
   * Remove existing container with the same name if it exists
   */
  private async removeExistingContainer(containerName: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerName);
      const info = await container.inspect();

      // Stop if running
      if (info.State.Running) {
        await container.stop();
      }

      // Remove the container
      await container.remove({ force: true });
      console.log(`Removed existing container: ${containerName}`);
    } catch (error: any) {
      // Container doesn't exist, which is fine
      if (error.statusCode !== 404) {
        console.error(
          `Error removing existing container ${containerName}:`,
          error
        );
      }
    }
  }

  /**
   * Create and start a workspace container
   */
  async createWorkspace(
    workspaceId: string,
    config: {
      githubRepo?: string;
      githubToken?: string;
      nixConfig?: string;
      template?: string;
      preset?: string;
      gitUserName?: string;
      gitUserEmail?: string;
      openrouterApiKey?: string;
      autocompleteModel?: string;
    }
  ): Promise<WorkspaceContainer> {
    // Allocate ports
    let vscodePort: number;
    let agentPort: number;
    const portResult = await this.portManager.allocatePorts();
    vscodePort = portResult.vscodePort;
    agentPort = portResult.agentPort;

    // Check if preset is a custom user preset (MongoDB ObjectId format)
    let presetSettings = "";
    let presetExtensions = "";

    if (config.preset && config.preset.length === 24) {
      // Looks like a MongoDB ObjectId - fetch custom preset
      const customPreset = await prisma.preset.findUnique({
        where: { id: config.preset },
        select: { settings: true, extensions: true },
      });

      if (customPreset) {
        presetSettings = customPreset.settings;
        presetExtensions = customPreset.extensions.join(",");
      }
    }

    // Update workspace status
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        status: "STARTING",
        vscodePort,
        agentPort,
      },
    });

    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        // Ensure base image exists; build once if missing
        const imageName = "kalpana/workspace:latest";
        await this.ensureImage(imageName);

        // Create or get persistent volume for workspace
        const volumeName = `kalpana-workspace-${workspaceId}`;
        try {
          await this.docker.getVolume(volumeName).inspect();
        } catch (error) {
          // Volume doesn't exist, create it
          await this.docker.createVolume({
            Name: volumeName,
            Labels: {
              "kalpana.workspace.id": workspaceId,
              "kalpana.managed": "true",
            },
          });
          console.log(`Created persistent volume: ${volumeName}`);
        }

        // Create or get shared Nix volume for caching packages
        // Note: We mount /nix (not just /nix/store) because Nix needs /nix/var for its database
        const nixVolumeName = "kalpana-nix-cache";
        try {
          await this.docker.getVolume(nixVolumeName).inspect();
          console.log(`Using existing Nix cache: ${nixVolumeName}`);
        } catch (error) {
          // Volume doesn't exist, create it
          await this.docker.createVolume({
            Name: nixVolumeName,
            Labels: {
              "kalpana.shared": "true",
              "kalpana.managed": "true",
              "kalpana.type": "nix-cache",
            },
          });
          console.log(`Created shared Nix cache: ${nixVolumeName}`);
        }

        // Create or get shared VSCode extensions volume for caching
        const extensionsVolumeName = "kalpana-vscode-extensions";
        try {
          await this.docker.getVolume(extensionsVolumeName).inspect();
          console.log(`Using existing VSCode extensions cache: ${extensionsVolumeName}`);
        } catch (error) {
          // Volume doesn't exist, create it
          await this.docker.createVolume({
            Name: extensionsVolumeName,
            Labels: {
              "kalpana.shared": "true",
              "kalpana.managed": "true",
              "kalpana.type": "extensions-cache",
            },
          });
          console.log(`Created shared VSCode extensions cache: ${extensionsVolumeName}`);
        }

        // Remove any existing container with the same name
        const containerName = `workspace-${workspaceId}`;
        await this.removeExistingContainer(containerName);

        // Create container with persistent volume
        const container = await this.docker.createContainer({
          Image: imageName,
          name: containerName,
          Env: [
            `WORKSPACE_ID=${workspaceId}`,
            `GITHUB_REPO=${config.githubRepo || ""}`,
            `GITHUB_TOKEN=${config.githubToken || ""}`,
            `NIX_CONFIG=${config.nixConfig || ""}`,
            `TEMPLATE=${config.template || ""}`,
            `PRESET=${config.preset || "default"}`,
            `GIT_USER_NAME=${config.gitUserName || ""}`,
            `GIT_USER_EMAIL=${config.gitUserEmail || ""}`,
            `CUSTOM_PRESET_SETTINGS=${presetSettings}`,
            `CUSTOM_PRESET_EXTENSIONS=${presetExtensions}`,
            `OPENROUTER_API_KEY=${config.openrouterApiKey || ""}`,
            `AUTOCOMPLETE_MODEL=${config.autocompleteModel || "google/gemma-3-27b-it:free"}`,
          ],
          ExposedPorts: {
            "8080/tcp": {}, // code-server
            "3001/tcp": {}, // agent bridge
          },
          HostConfig: {
            PortBindings: {
              "8080/tcp": [{ HostPort: vscodePort.toString() }],
              "3001/tcp": [{ HostPort: agentPort.toString() }],
            },
            Binds: [
              `${volumeName}:/workspace`, // Mount persistent workspace volume
              `${nixVolumeName}:/nix`, // Mount shared Nix cache (includes store + var)
              `${extensionsVolumeName}:/root/.local/share/code-server/extensions`, // Mount shared extensions cache
            ],
            Memory: parseInt(
              process.env.DEFAULT_CONTAINER_MEMORY || "2147483648"
            ), // 2GB
            NanoCpus: parseInt(
              process.env.DEFAULT_CONTAINER_CPU || "1000000000"
            ), // 1 CPU
            RestartPolicy: {
              Name: "unless-stopped",
            },
            AutoRemove: false,
          },
          Labels: {
            "kalpana.workspace.id": workspaceId,
            "kalpana.managed": "true",
          },
        });

        // Start container
        await container.start();

        // Update workspace with containerId but keep status STARTING
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            containerId: container.id,
            // status intentionally left as STARTING; mark RUNNING in API when fully ready
          },
        });

        // Begin background readiness watcher so status can flip to RUNNING without an active client
        this.monitorWorkspaceReadiness(workspaceId, container.id).catch((e) => {
          console.error("Workspace readiness watcher error:", e);
        });

        return {
          containerId: container.id,
          vscodePort,
          agentPort,
          workspaceId,
        };
      } catch (error: any) {
        // Check if it's a port binding error
        if (
          error.message &&
          (error.message.includes("port is already allocated") ||
            error.message.includes("address already in use") ||
            error.message.includes("Bind for"))
        ) {
          retries++;
          if (retries >= maxRetries) {
            // Rollback on final failure
            await prisma.workspace.update({
              where: { id: workspaceId },
              data: {
                status: "ERROR",
                vscodePort: null,
                agentPort: null,
              },
            });
            throw new Error(
              `Failed to allocate ports after ${maxRetries} attempts: ${error.message}`
            );
          }

          console.log(
            `⚠️ Port binding failed for workspace, finding alternative ports (attempt ${retries}/${maxRetries})...`
          );

          // Find alternative ports
          const newPortResult = await this.portManager.allocatePorts();
          vscodePort = newPortResult.vscodePort;
          agentPort = newPortResult.agentPort;

          // Update workspace with new ports
          await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              vscodePort,
              agentPort,
            },
          });

          // Continue to next retry iteration
          continue;
        }

        // Not a port error - rollback and throw
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            status: "ERROR",
            vscodePort: null,
            agentPort: null,
          },
        });

        // Surface clearer error messages to API layer
        if (
          typeof error === "object" &&
          error &&
          "json" in (error as any) &&
          (error as any).reason
        ) {
          throw new Error(
            `Docker error: ${
              (error as any).reason
            }. Ensure image exists (kalpana/workspace:latest) and Docker is running.`
          );
        }

        throw error;
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error("Failed to create workspace after all retries");
  }

  /**
   * Stop a workspace container
   */
  async stopWorkspace(workspaceId: string): Promise<void> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace || !workspace.containerId) {
      throw new Error("Workspace not found or not running");
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { status: "STOPPING" },
    });

    try {
      const container = this.docker.getContainer(workspace.containerId);
      await container.stop();

      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          status: "STOPPED",
          containerId: null,
        },
      });

      // Release ports
      await this.portManager.releasePorts(workspaceId);
    } catch (error) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { status: "ERROR" },
      });

      throw error;
    }
  }

  /**
   * Destroy a workspace container
   */
  async destroyWorkspace(
    workspaceId: string,
    deleteVolume = false
  ): Promise<void> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    if (workspace.containerId) {
      try {
        const container = this.docker.getContainer(workspace.containerId);

        // Stop if running
        try {
          await container.stop();
        } catch (e) {
          // Container might already be stopped
        }

        // Remove container
        await container.remove({ force: true });
      } catch (error) {
        console.error("Error removing container:", error);
      }
    }

    // Optionally delete persistent volume (data loss warning!)
    if (deleteVolume) {
      const volumeName = `kalpana-workspace-${workspaceId}`;
      try {
        const volume = this.docker.getVolume(volumeName);
        await volume.remove({ force: true });
        console.log(`Deleted volume: ${volumeName}`);
      } catch (error) {
        console.error("Error removing volume:", error);
      }
    }

    // Release ports
    if (workspace.vscodePort) {
      await this.portManager.releasePorts(workspaceId);
    }
  }

  /**
   * Get container stats
   */
  async getContainerStats(containerId: string): Promise<any> {
    const container = this.docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });
    return stats;
  }

  /**
   * Check if container is healthy
   */
  async isContainerHealthy(containerId: string): Promise<boolean> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      return info.State.Running || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(
    containerId: string,
    options?: {
      tail?: number;
      since?: number;
      timestamps?: boolean;
    }
  ): Promise<string> {
    try {
      const container = this.docker.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: options?.tail || 100,
        since: options?.since,
        timestamps: options?.timestamps || false,
      });

      return logs.toString("utf-8");
    } catch (error) {
      console.error("Error getting container logs:", error);
      return "";
    }
  }

  /**
   * Stream container logs
   */
  async streamContainerLogs(
    containerId: string,
    onLog: (log: string) => void
  ): Promise<() => void> {
    try {
      const container = this.docker.getContainer(containerId);
      const logStream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: 50,
        timestamps: true,
      });

      logStream.on("data", (chunk: Buffer) => {
        // Docker log format: first 8 bytes are header, rest is content
        const log = chunk.toString("utf-8");
        onLog(log);
      });

      // Return cleanup function
      return () => {
        try {
          if (logStream && typeof (logStream as any).destroy === "function") {
            (logStream as any).destroy();
          }
        } catch (e) {
          console.error("Error destroying log stream:", e);
        }
      };
    } catch (error) {
      console.error("Error streaming container logs:", error);
      return () => {};
    }
  }

  /**
   * Restart a workspace container (re-runs start.sh)
   */
  async restartWorkspace(workspaceId: string): Promise<void> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace || !workspace.containerId) {
      throw new Error("Workspace not found or not running");
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { status: "STARTING" },
    });

    try {
      const container = this.docker.getContainer(workspace.containerId);

      // Restart the container (this will re-run start.sh)
      await container.restart();

      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { status: "RUNNING" },
      });
    } catch (error) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { status: "ERROR" },
      });

      throw error;
    }
  }

  /**
   * Execute a command in a running container
   */
  async execInContainer(
    containerId: string,
    command: string[]
  ): Promise<{ stdout: string; stderr: string }> {
    try {
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
          // Parse Docker stream format
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
    } catch (error) {
      console.error("Error executing command in container:", error);
      throw error;
    }
  }

  /**
   * Watch container logs and automatically mark workspace RUNNING
   * when both agent bridge and code-server are ready.
   * Runs in background; safely no-ops on timeout or errors.
   */
  private async monitorWorkspaceReadiness(
    workspaceId: string,
    containerId: string
  ): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);

      // Track readiness of subsystems
      let agentReady = false;
      let codeServerReady = false;
      let done = false;

      const finalize = async () => {
        if (done) return;
        done = true;
        try {
          const info = await container.inspect();
          if (info.State.Running) {
            await prisma.workspace.update({
              where: { id: workspaceId },
              data: { status: "RUNNING" },
            });
          }
        } catch (e) {
          // Swallow errors; this is a background helper
          console.error("Error finalizing workspace readiness:", e);
        } finally {
          try {
            if (logStream && typeof (logStream as any).destroy === "function") {
              (logStream as any).destroy();
            }
          } catch {}
          clearTimeout(timeoutId);
        }
      };

      // Attach to logs; include some tail to capture already-emitted lines
      const logStream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: 200,
        timestamps: false,
      });

      const onData = (chunk: Buffer) => {
        if (done) return;
        const text = chunk
          .toString("utf-8")
          .replace(/[\x00-\x1F\x7F-\x9F]/g, "");
        const lines = text.split("\n").filter((l) => l.trim());
        for (const line of lines) {
          if (
            !agentReady &&
            (line.includes("Agent bridge started") ||
              line.includes("Agent bridge running") ||
              line.includes("WebSocket server available"))
          ) {
            agentReady = true;
          }
          if (!codeServerReady && line.includes("HTTP server listening")) {
            codeServerReady = true;
          }

          if (agentReady && codeServerReady) {
            // Both subsystems reported ready; mark workspace RUNNING
            finalize();
            break;
          }
        }
      };

      logStream.on("data", onData);
      logStream.on("error", () => {
        // Ignore log errors; rely on timeout below
      });

      // Safety timeout: stop watching after 2 minutes
      const timeoutId = setTimeout(() => {
        try {
          if (logStream && typeof (logStream as any).destroy === "function") {
            (logStream as any).destroy();
          }
        } catch {}
      }, 120000);
    } catch (error) {
      // Do not throw; this should never block caller
      console.error("monitorWorkspaceReadiness failure:", error);
    }
  }
}

// Singleton instance
export const dockerManager = new DockerManager();

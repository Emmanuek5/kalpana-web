import Docker from "dockerode";
import { prisma } from "@/lib/db";
import { PortManager } from "./port-manager";
import { traefikManager } from "./traefik-manager";

export interface DeploymentConfig {
  name: string;
  description?: string;
  buildCommand?: string;
  startCommand: string;
  workingDir?: string;
  port: number; // Application port inside container
  envVars?: Record<string, string>;
  subdomain?: string;
  autoRebuild?: boolean;
}

export class DeploymentManager {
  private docker: Docker;
  private portManager: PortManager;

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

  /**
   * Create a new deployment
   */
  async createDeployment(
    workspaceId: string,
    config: DeploymentConfig
  ): Promise<string> {
    const baseUrl = process.env.TRAEFIK_BASE_URL;

    // Validate subdomain if using Traefik
    if (baseUrl && config.subdomain) {
      // Check if subdomain is already in use
      const existing = await prisma.deployment.findFirst({
        where: {
          subdomain: config.subdomain,
          baseUrl: baseUrl,
        },
      });

      if (existing) {
        throw new Error(`Subdomain "${config.subdomain}" is already in use`);
      }
    }

    // Generate webhook secret for auto-rebuild
    const webhookSecret = config.autoRebuild
      ? this.generateWebhookSecret()
      : undefined;

    const deployment = await prisma.deployment.create({
      data: {
        workspaceId,
        name: config.name,
        description: config.description,
        buildCommand: config.buildCommand,
        startCommand: config.startCommand,
        workingDir: config.workingDir,
        port: config.port,
        envVars: config.envVars ? JSON.stringify(config.envVars) : undefined,
        subdomain: config.subdomain,
        baseUrl: baseUrl,
        autoRebuild: config.autoRebuild || false,
        webhookSecret,
        status: "STOPPED",
      },
    });

    return deployment.id;
  }

  /**
   * Build and deploy an application
   */
  async deployApplication(
    deploymentId: string,
    triggeredBy: string = "manual",
    onLog?: (log: string) => void
  ): Promise<void> {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { workspace: true },
    });

    if (!deployment) {
      throw new Error("Deployment not found");
    }

    // Create a build record
    const build = await prisma.build.create({
      data: {
        deploymentId,
        status: "BUILDING",
        triggeredBy,
        startedAt: new Date(),
      },
    });

    try {
      // Update deployment status
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: "BUILDING" },
      });

      onLog?.("Starting build process...");

      // Get workspace container
      if (!deployment.workspace.containerId) {
        throw new Error("Workspace is not running");
      }

      const workspaceContainer = this.docker.getContainer(
        deployment.workspace.containerId
      );

      // Run build command if specified
      if (deployment.buildCommand) {
        onLog?.(`Running build command: ${deployment.buildCommand}`);
        const buildResult = await this.execInContainer(
          workspaceContainer,
          deployment.buildCommand,
          deployment.workingDir || "/workspace",
          onLog
        );

        if (buildResult.exitCode !== 0) {
          throw new Error(
            `Build failed with exit code ${buildResult.exitCode}: ${buildResult.stderr}`
          );
        }
      }

      onLog?.("Build completed successfully");

      // Update build status
      await prisma.build.update({
        where: { id: build.id },
        data: {
          status: "SUCCESS",
          completedAt: new Date(),
        },
      });

      // Now deploy
      await this.startDeployment(deploymentId, onLog);
    } catch (error: any) {
      // Update build status
      await prisma.build.update({
        where: { id: build.id },
        data: {
          status: "FAILED",
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });

      // Update deployment status
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: "ERROR" },
      });

      onLog?.(`Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start a deployment container
   */
  private async startDeployment(
    deploymentId: string,
    onLog?: (log: string) => void
  ): Promise<void> {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { workspace: true },
    });

    if (!deployment) {
      throw new Error("Deployment not found");
    }

    onLog?.("Starting deployment...");

    // Update status
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: "DEPLOYING" },
    });

    // Stop existing deployment container if running
    if (deployment.containerId) {
      try {
        const oldContainer = this.docker.getContainer(deployment.containerId);
        await oldContainer.stop();
        await oldContainer.remove();
      } catch (error) {
        // Container might not exist
      }
    }

    const baseUrl = deployment.baseUrl;
    let exposedPort: number | undefined;

    // Allocate port if not using Traefik
    if (!baseUrl) {
      const ports = await this.portManager.allocatePorts();
      exposedPort = ports.vscodePort; // Reuse port allocation logic
    }

    // Parse environment variables
    const envVars = deployment.envVars
      ? JSON.parse(deployment.envVars)
      : {};
    const env = Object.entries(envVars).map(
      ([key, value]) => `${key}=${value}`
    );

    // Get the workspace volume
    const volumeName = `kalpana-workspace-${deployment.workspaceId}`;

    // Generate container name
    const containerName = `deployment-${deploymentId}`;

    // Generate Traefik labels if using subdomain routing
    const labels = baseUrl && deployment.subdomain
      ? traefikManager.generateLabels(
          deploymentId,
          deployment.subdomain,
          deployment.port,
          baseUrl
        )
      : {
          "kalpana.deployment.id": deploymentId,
        };

    // Create deployment container
    const containerConfig: any = {
      Image: "kalpana/workspace:latest", // Use same base image
      name: containerName,
      Env: env,
      Labels: labels,
      WorkingDir: deployment.workingDir || "/workspace",
      Cmd: ["/bin/bash", "-c", deployment.startCommand],
      ExposedPorts: {
        [`${deployment.port}/tcp`]: {},
      },
      HostConfig: {
        Binds: [`${volumeName}:/workspace`],
        RestartPolicy: {
          Name: "unless-stopped",
        },
      },
    };

    // Add port binding if not using Traefik
    if (!baseUrl && exposedPort) {
      containerConfig.HostConfig.PortBindings = {
        [`${deployment.port}/tcp`]: [{ HostPort: exposedPort.toString() }],
      };
    }

    const container = await this.docker.createContainer(containerConfig);
    await container.start();

    onLog?.("Deployment container started");

    // Connect to Traefik network if using subdomain routing
    if (baseUrl && deployment.subdomain) {
      await traefikManager.ensureTraefik();
      await traefikManager.connectToNetwork(container.id);
      onLog?.(`Configured subdomain: ${deployment.subdomain}.${baseUrl}`);
    }

    // Update deployment record
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "RUNNING",
        containerId: container.id,
        exposedPort: exposedPort,
        lastDeployedAt: new Date(),
      },
    });

    onLog?.("Deployment completed successfully!");
  }

  /**
   * Stop a deployment
   */
  async stopDeployment(deploymentId: string): Promise<void> {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment || !deployment.containerId) {
      throw new Error("Deployment not running");
    }

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: "STOPPING" },
    });

    try {
      const container = this.docker.getContainer(deployment.containerId);

      // Disconnect from Traefik network if connected
      if (deployment.baseUrl && deployment.subdomain) {
        await traefikManager.disconnectFromNetwork(deployment.containerId);
      }

      await container.stop();
      await container.remove();

      // Release port if allocated
      if (deployment.exposedPort) {
        // Port will be freed when container is removed
      }

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "STOPPED",
          containerId: null,
        },
      });
    } catch (error) {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: "ERROR" },
      });
      throw error;
    }
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(deploymentId: string): Promise<void> {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new Error("Deployment not found");
    }

    // Stop if running
    if (deployment.status === "RUNNING" && deployment.containerId) {
      await this.stopDeployment(deploymentId);
    }

    // Delete from database (builds will be cascade deleted)
    await prisma.deployment.delete({
      where: { id: deploymentId },
    });
  }

  /**
   * Execute command in container
   */
  private async execInContainer(
    container: Docker.Container,
    command: string,
    workingDir: string,
    onLog?: (log: string) => void
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const exec = await container.exec({
      Cmd: ["/bin/bash", "-c", command],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: workingDir,
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
          onLog?.(data);
        } else if (header === 2) {
          stderr += data;
          onLog?.(data);
        }
      });

      stream.on("end", async () => {
        const info = await exec.inspect();
        resolve({
          stdout,
          stderr,
          exitCode: info.ExitCode || 0,
        });
      });

      stream.on("error", reject);
    });
  }

  /**
   * Generate webhook secret
   */
  private generateWebhookSecret(): string {
    return Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get deployment logs
   */
  async getDeploymentLogs(deploymentId: string, tail: number = 100): Promise<string> {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment || !deployment.containerId) {
      throw new Error("Deployment not running");
    }

    const container = this.docker.getContainer(deployment.containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });

    return logs.toString("utf-8");
  }
}

// Singleton instance
export const deploymentManager = new DeploymentManager();
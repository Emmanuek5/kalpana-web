import Docker from "dockerode";
import { prisma } from "@/lib/db";
import { PortManager } from "./port-manager";
import { traefikManager } from "./traefik-manager";
import { encryptEnvVars, decryptEnvVars } from "@/lib/crypto";

export interface DeploymentConfig {
  name: string;
  description?: string;
  buildCommand?: string;
  startCommand: string;
  workingDir?: string;
  port: number; // Application port inside container
  envVars?: Record<string, string>;
  subdomain?: string;
  domainId?: string;
  autoRebuild?: boolean;
}

export class DeploymentManager {
  private docker: Docker;
  private portManager: PortManager;
  private baseDomain?: string;

  constructor() {
    this.baseDomain = process.env.KALPANA_BASE_DOMAIN;
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
    let finalSubdomain = config.subdomain;
    let domain = null;

    // Get domain if domainId is provided
    if (config.domainId) {
      domain = await prisma.domain.findUnique({
        where: { id: config.domainId },
      });

      if (!domain || !domain.verified) {
        throw new Error("Invalid or unverified domain");
      }

      // Auto-generate subdomain if not provided and domain is linked
      if (!finalSubdomain) {
        const { generateSubdomain } = await import("@/lib/subdomain-generator");
        finalSubdomain = generateSubdomain();

        // Ensure uniqueness
        let attempts = 0;
        while (attempts < 10) {
          const existing = await prisma.deployment.findFirst({
            where: {
              subdomain: finalSubdomain,
              domainId: config.domainId,
            },
          });

          if (!existing) break;
          finalSubdomain = generateSubdomain();
          attempts++;
        }

        if (attempts === 10) {
          throw new Error("Failed to generate unique subdomain");
        }
      } else {
        // Validate subdomain if using domain
        const { isValidSubdomain } = await import("@/lib/subdomain-generator");
        if (!isValidSubdomain(finalSubdomain)) {
          throw new Error("Invalid subdomain format");
        }

        // Check if subdomain is already in use for this domain
        const existing = await prisma.deployment.findFirst({
          where: {
            subdomain: finalSubdomain,
            domainId: config.domainId,
          },
        });

        if (existing) {
          throw new Error(`Subdomain "${finalSubdomain}" is already in use`);
        }
      }
    }

    // Generate webhook secret for auto-rebuild
    const webhookSecret = config.autoRebuild
      ? this.generateWebhookSecret()
      : undefined;

    // Get the workspace to get the userId
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { userId: true },
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const deployment = await prisma.deployment.create({
      data: {
        workspaceId,
        userId: workspace.userId,
        name: config.name,
        description: config.description,
        buildCommand: config.buildCommand,
        startCommand: config.startCommand,
        workingDir: config.workingDir,
        port: config.port,
        envVars: config.envVars ? encryptEnvVars(config.envVars) : undefined,
        subdomain: finalSubdomain,
        domainId: config.domainId,
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
    onLog?: (log: string) => void | Promise<void>
  ): Promise<void> {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { workspace: true, domain: true },
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

    // Store logs for later viewing
    const buildLogs: string[] = [];
    let lastLogUpdate = Date.now();
    const LOG_UPDATE_INTERVAL = 1000; // Update DB every 1 second

    const logCapture = async (log: string) => {
      buildLogs.push(log);
      onLog?.(log);

      // Update logs in database periodically for live viewing
      const now = Date.now();
      if (now - lastLogUpdate >= LOG_UPDATE_INTERVAL) {
        lastLogUpdate = now;
        try {
          await prisma.build.update({
            where: { id: build.id },
            data: { logs: buildLogs.join("\n") },
          });
        } catch (error) {
          // Ignore update errors, logs will be saved at the end anyway
        }
      }
    };

    try {
      // Update deployment status
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: "BUILDING" },
      });

      await logCapture("Starting build process...");

      // Check if this is a standalone deployment (has githubRepo) or workspace-based
      if (deployment.githubRepo && !deployment.workspace) {
        // Standalone deployment - deploy from GitHub
        await this.deployStandaloneApplication(
          deployment,
          build.id,
          async (log) => await logCapture(log)
        );
      } else if (deployment.workspace) {
        // Workspace-based deployment
        await this.deployWorkspaceApplication(
          deployment,
          build.id,
          async (log) => await logCapture(log)
        );
      } else {
        throw new Error("Invalid deployment configuration");
      }

      // Update build status to success with logs
      await prisma.build.update({
        where: { id: build.id },
        data: {
          status: "SUCCESS",
          completedAt: new Date(),
          logs: buildLogs.join("\n"),
        },
      });

      // Update deployment status
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "RUNNING",
          lastDeployedAt: new Date(),
        },
      });

      await logCapture("✅ Deployment completed successfully!");
    } catch (error: any) {
      await logCapture(`❌ Error: ${error.message}`);

      // Update build status to failed with logs
      await prisma.build.update({
        where: { id: build.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          logs:
            buildLogs.join("\n") +
            `\n\n❌ Error: ${error.message}\n${error.stack || ""}`,
        },
      });

      // Update deployment status
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: "ERROR" },
      });

      throw error;
    }
  }

  private async deployWorkspaceApplication(
    deployment: any,
    buildId: string,
    onLog?: (log: string) => Promise<void>
  ): Promise<void> {
    // Get workspace container
    if (!deployment.workspace.containerId) {
      throw new Error("Workspace is not running");
    }

    const workspaceContainer = this.docker.getContainer(
      deployment.workspace.containerId
    );

    // Run build command if specified
    if (deployment.buildCommand) {
      await onLog?.(`Running build command: ${deployment.buildCommand}`);
      const buildResult = await this.execInContainerSh(
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

    await onLog?.("Build completed successfully");

    // Now deploy
    await this.startDeployment(deployment.id, onLog);
  }

  private async deployStandaloneApplication(
    deployment: any,
    buildId: string,
    onLog?: (log: string) => Promise<void>
  ): Promise<void> {
    await onLog?.("🔄 Starting standalone deployment from GitHub...");
    await onLog?.(`📦 Repository: ${deployment.githubRepo}`);
    await onLog?.(`🌿 Branch: ${deployment.githubBranch || "main"}`);

    const buildContainerName = `build-${deployment.id}`;
    const deployContainerName = `deploy-${deployment.id}`;

    // Get user's GitHub access token for private repos
    const account = await prisma.account.findFirst({
      where: {
        userId: deployment.userId,
        providerId: "github",
      },
    });

    const githubToken = account?.accessToken;
    if (!githubToken) {
      throw new Error(
        "GitHub access token not found. Please reconnect your GitHub account."
      );
    }

    try {
      // Step 1: Create a temporary build container
      await onLog?.("📦 Creating build container...");

      const buildContainer = await this.docker.createContainer({
        Image: "oven/bun:1", // Use Bun image (includes Node.js)
        name: buildContainerName,
        Cmd: ["/bin/sh", "-c", "sleep infinity"], // Keep container running
        WorkingDir: "/app",
        Labels: {
          "kalpana.type": "build",
          "kalpana.deployment.id": deployment.id,
        },
      });

      await buildContainer.start();
      await onLog?.("✅ Build container created");

      // Step 2: Install git and clone repository
      await onLog?.("📦 Installing git...");

      // Bun image is based on Debian, so use apt-get
      const gitInstallCmd = "apt-get update && apt-get install -y git";
      const gitInstallResult = await this.execInContainer(
        buildContainer,
        gitInstallCmd,
        "/app",
        onLog
      );

      if (gitInstallResult.exitCode !== 0) {
        throw new Error(`Failed to install git: ${gitInstallResult.stderr}`);
      }

      await onLog?.(`📥 Cloning repository: ${deployment.githubRepo}...`);

      // Use GitHub token for authentication (supports both public and private repos)
      const gitCloneCmd = `git clone --depth 1 --branch ${
        deployment.githubBranch || "main"
      } https://${githubToken}@github.com/${
        deployment.githubRepo
      }.git /app/repo`;

      const cloneResult = await this.execInContainer(
        buildContainer,
        gitCloneCmd,
        "/app",
        onLog
      );

      if (cloneResult.exitCode !== 0) {
        throw new Error(`Failed to clone repository: ${cloneResult.stderr}`);
      }

      await onLog?.("✅ Repository cloned successfully");

      // Determine working directory
      const workDir = deployment.rootDirectory
        ? `/app/repo/${deployment.rootDirectory}`
        : "/app/repo";

      // Step 3: Install dependencies
      if (deployment.installCommand) {
        await onLog?.(
          `📦 Running install command: ${deployment.installCommand}`
        );
        const installResult = await this.execInContainer(
          buildContainer,
          deployment.installCommand,
          workDir,
          onLog
        );

        if (installResult.exitCode !== 0) {
          throw new Error(`Install failed: ${installResult.stderr}`);
        }
        await onLog?.("✅ Dependencies installed");
      }

      // Step 4: Run build command if specified
      if (deployment.buildCommand) {
        await onLog?.(`🔨 Running build command: ${deployment.buildCommand}`);
        const buildResult = await this.execInContainer(
          buildContainer,
          deployment.buildCommand,
          workDir,
          onLog
        );

        if (buildResult.exitCode !== 0) {
          throw new Error(`Build failed: ${buildResult.stderr}`);
        }
        await onLog?.("✅ Build completed successfully");
      }

      // Step 5: Create production container
      await onLog?.("🚀 Creating production container...");

      // Stop and remove any existing deployment container
      if (deployment.containerId) {
        try {
          const oldContainer = this.docker.getContainer(deployment.containerId);
          await oldContainer.stop();
          await oldContainer.remove();
        } catch (error) {
          // Ignore errors if container doesn't exist
        }
      }

      // Parse and decrypt environment variables
      const envVars = deployment.envVars
        ? decryptEnvVars(deployment.envVars)
        : {};
      const env = Object.entries(envVars).map(
        ([key, value]) => `${key}=${value}`
      );

      // Add PORT environment variable
      env.push(`PORT=${deployment.port}`);

      // Allocate port
      const domain = deployment.domain;
      let exposedPort: number | undefined;

      // Determine subdomain and domain for Traefik
      let traefikSubdomain: string | undefined;
      let traefikDomain: string | undefined;

      // Priority 1: Custom domain if provided
      if (domain && deployment.subdomain) {
        traefikSubdomain = deployment.subdomain;
        traefikDomain = domain.domain;
      }
      // Priority 2: Base domain with deployment ID as subdomain
      else if (this.baseDomain) {
        traefikSubdomain = deployment.id;
        traefikDomain = this.baseDomain;
      }

      // Allocate port if not using any domain
      if (!domain && !this.baseDomain) {
        const ports = await this.portManager.allocatePorts();
        exposedPort = ports.vscodePort;
        await onLog?.(`📍 Allocated port: ${exposedPort}`);
      }

      const labels =
        traefikSubdomain && traefikDomain
          ? traefikManager.generateLabels(
              deployment.id,
              traefikSubdomain,
              deployment.port,
              traefikDomain
            )
          : {
              "kalpana.deployment.id": deployment.id,
            };

      // Commit the build container to create an image
      await onLog?.("💾 Creating container image from build...");
      const image = await buildContainer.commit({
        repo: `kalpana-deploy-${deployment.id}`,
        tag: "latest",
      });

      // Create deployment container from the committed image
      const containerConfig: any = {
        Image: image.Id,
        name: deployContainerName,
        Cmd: ["/bin/sh", "-c", `cd ${workDir} && ${deployment.startCommand}`],
        Env: env,
        Labels: labels,
        WorkingDir: workDir,
        ExposedPorts: {
          [`${deployment.port}/tcp`]: {},
        },
      };

      // Set up networking - always use bridge for port bindings
      // Traefik network will be added as secondary network if needed
      containerConfig.HostConfig = {
        RestartPolicy: {
          Name: "unless-stopped",
        },
        NetworkMode: "bridge",
      };

      // Add port bindings if not using custom domain (base domain still needs ports for internal access)
      if (!domain || this.baseDomain) {
        if (exposedPort) {
          containerConfig.HostConfig.PortBindings = {
            [`${deployment.port}/tcp`]: [{ HostPort: exposedPort.toString() }],
          };
        }
      }

      const deployContainer = await this.docker.createContainer(
        containerConfig
      );
      await deployContainer.start();

      await onLog?.("✅ Production container started");

      // Clean up build container
      await onLog?.("🧹 Cleaning up build container...");
      await buildContainer.stop();
      await buildContainer.remove();

      // Remove the temporary image to save space
      try {
        await this.docker.getImage(image.Id).remove({ force: true });
      } catch (error) {
        // Ignore cleanup errors
      }

      // Update deployment record
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: "RUNNING",
          containerId: deployContainer.id,
          exposedPort: exposedPort,
          lastDeployedAt: new Date(),
        },
      });

      if (domain && deployment.subdomain) {
        await onLog?.(
          `✅ Deployed at: https://${deployment.subdomain}.${domain.domain}`
        );
      } else if (exposedPort) {
        await onLog?.(`✅ Deployed at: http://localhost:${exposedPort}`);
      }
    } catch (error: any) {
      // Clean up on error
      try {
        const buildContainer = this.docker.getContainer(buildContainerName);
        await buildContainer.stop();
        await buildContainer.remove();
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  /**
   * Start a deployment container
   */
  private async startDeployment(
    deploymentId: string,
    onLog?: (log: string) => void | Promise<void>
  ): Promise<void> {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { workspace: true },
    });

    if (!deployment) {
      throw new Error("Deployment not found");
    }

    await onLog?.("Starting deployment...");

    // Update status
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: "DEPLOYING" },
    });

    // Fetch domain if domainId is present
    let domain = null;
    if (deployment.domainId) {
      domain = await prisma.domain.findUnique({
        where: { id: deployment.domainId },
      });
    }

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

    // Determine subdomain and domain for Traefik
    let traefikSubdomain: string | undefined;
    let traefikDomain: string | undefined;

    // Priority 1: Custom domain if provided
    if (domain && deployment.subdomain) {
      traefikSubdomain = deployment.subdomain;
      traefikDomain = domain.domain;
    }
    // Priority 2: Base domain with deployment ID as subdomain
    else if (this.baseDomain) {
      traefikSubdomain = deploymentId;
      traefikDomain = this.baseDomain;
    }

    let exposedPort: number | undefined;

    // Allocate port if not using any domain
    if (!domain && !this.baseDomain) {
      const ports = await this.portManager.allocatePorts();
      exposedPort = ports.vscodePort;
    }

    // Parse and decrypt environment variables
    const envVars = deployment.envVars
      ? decryptEnvVars(deployment.envVars)
      : {};
    const env = Object.entries(envVars).map(
      ([key, value]) => `${key}=${value}`
    );

    // Get the workspace volume
    const volumeName = `kalpana-workspace-${deployment.workspaceId}`;

    // Generate container name
    const containerName = `deployment-${deploymentId}`;

    // Generate Traefik labels if any domain is configured
    const labels =
      traefikSubdomain && traefikDomain && deployment.port
        ? traefikManager.generateLabels(
            deploymentId,
            traefikSubdomain,
            deployment.port,
            traefikDomain
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
      Cmd: ["/bin/sh", "-c", deployment.startCommand],
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

    // Set up networking - always use bridge for port bindings
    // Traefik network will be added as secondary network if needed
    containerConfig.HostConfig.NetworkMode = "bridge";
    
    // Add port bindings if not using custom domain
    if (!domain || this.baseDomain) {
      if (exposedPort) {
        containerConfig.HostConfig.PortBindings = {
          [`${deployment.port}/tcp`]: [{ HostPort: exposedPort.toString() }],
        };
      }
    }

    const container = await this.docker.createContainer(containerConfig);
    await container.start();

    await onLog?.("Deployment container started");

    // Connect to Traefik network if any domain is configured
    if (domain && deployment.subdomain) {
      await traefikManager.ensureTraefik();
      await traefikManager.connectToNetwork(container.id);
      await onLog?.(
        `Configured subdomain: ${deployment.subdomain}.${domain.domain}`
      );
    } else if (this.baseDomain) {
      await traefikManager.ensureTraefik();
      await traefikManager.connectToNetwork(container.id);
      await onLog?.(
        `Configured base domain: ${deployment.id}.${this.baseDomain}`
      );
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

    await onLog?.("Deployment completed successfully!");
  }

  /**
   * Stop a deployment
   */
  async stopDeployment(deploymentId: string): Promise<void> {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { domain: true },
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
      if (deployment.domain && deployment.subdomain) {
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
   * Stop a running build
   */
  async stopBuild(deploymentId: string, buildId: string): Promise<void> {
    const build = await prisma.build.findFirst({
      where: {
        id: buildId,
        deploymentId,
      },
    });

    if (!build) {
      throw new Error("Build not found");
    }

    if (build.status !== "BUILDING") {
      throw new Error("Build is not running");
    }

    // Try to stop and remove the build container
    const buildContainerName = `build-${deploymentId}`;

    try {
      const buildContainer = this.docker.getContainer(buildContainerName);
      await buildContainer.stop();
      await buildContainer.remove();
    } catch (error) {
      // Container might not exist or already stopped, that's okay
      console.log("Build container cleanup:", error);
    }

    // Update build status to cancelled
    await prisma.build.update({
      where: { id: buildId },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
        logs: (build.logs || "") + "\n\n🛑 Build cancelled by user",
      },
    });

    // Update deployment status back to previous state (likely STOPPED or ERROR)
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: "STOPPED" },
    });
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
   * Execute command in container using /bin/sh (for Alpine containers)
   */
  private async execInContainerSh(
    container: Docker.Container,
    command: string,
    workingDir: string,
    onLog?: (log: string) => void
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const exec = await container.exec({
      Cmd: ["/bin/sh", "-c", command],
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
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Get deployment logs
   */
  async getDeploymentLogs(
    deploymentId: string,
    tail: number = 100
  ): Promise<string> {
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

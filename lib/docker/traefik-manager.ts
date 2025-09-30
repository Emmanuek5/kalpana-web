import Docker from "dockerode";
import { prisma } from "@/lib/db";

export interface TraefikConfig {
  baseUrl?: string; // e.g., "example.com"
  email?: string; // For Let's Encrypt
  network?: string; // Docker network name
}

export class TraefikManager {
  private docker: Docker;
  private config: TraefikConfig;
  private static instance: TraefikManager;

  constructor(config: TraefikConfig = {}) {
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

    this.config = {
      baseUrl: config.baseUrl || process.env.TRAEFIK_BASE_URL,
      email: config.email || process.env.TRAEFIK_EMAIL || "admin@localhost",
      network: config.network || process.env.TRAEFIK_NETWORK || "traefik-proxy",
    };
  }

  private getDefaultDockerClient(): Docker {
    if (process.platform === "win32") {
      return new Docker({ socketPath: "//./pipe/docker_engine" });
    }
    return new Docker({ socketPath: "/var/run/docker.sock" });
  }

  static getInstance(config?: TraefikConfig): TraefikManager {
    if (!TraefikManager.instance) {
      TraefikManager.instance = new TraefikManager(config);
    }
    return TraefikManager.instance;
  }

  /**
   * Ensure Traefik is running
   */
  async ensureTraefik(): Promise<void> {
    // Check if Traefik container exists
    const containers = await this.docker.listContainers({ all: true });
    const traefikContainer = containers.find((c) =>
      c.Names.some((name) => name.includes("traefik"))
    );

    if (traefikContainer) {
      // Start if not running
      if (traefikContainer.State !== "running") {
        const container = this.docker.getContainer(traefikContainer.Id);
        await container.start();
      }
      return;
    }

    // Create Traefik network if it doesn't exist
    await this.ensureNetwork();

    // Create and start Traefik container
    await this.createTraefikContainer();
  }

  /**
   * Ensure the Traefik network exists
   */
  private async ensureNetwork(): Promise<void> {
    try {
      const networks = await this.docker.listNetworks({
        filters: { name: [this.config.network!] },
      });

      if (networks.length === 0) {
        await this.docker.createNetwork({
          Name: this.config.network!,
          Driver: "bridge",
          Labels: {
            "kalpana.managed": "true",
          },
        });
        console.log(`Created network: ${this.config.network}`);
      }
    } catch (error) {
      console.error("Error ensuring network:", error);
      throw error;
    }
  }

  /**
   * Create Traefik container
   */
  private async createTraefikContainer(): Promise<void> {
    const labels: Record<string, string> = {
      "kalpana.managed": "true",
      "traefik.enable": "true",
      "traefik.http.routers.api.rule": "Host(`traefik.localhost`)",
      "traefik.http.routers.api.service": "api@internal",
    };

    const cmd = [
      "--api.insecure=true",
      "--api.dashboard=true",
      "--providers.docker=true",
      "--providers.docker.exposedbydefault=false",
      `--providers.docker.network=${this.config.network}`,
      "--entrypoints.web.address=:80",
    ];

    // Add HTTPS entrypoint if base URL is configured
    if (this.config.baseUrl) {
      cmd.push("--entrypoints.websecure.address=:443");
      cmd.push("--certificatesresolvers.letsencrypt.acme.httpchallenge=true");
      cmd.push(
        "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      );
      cmd.push(`--certificatesresolvers.letsencrypt.acme.email=${this.config.email}`);
      cmd.push(
        "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      );
    }

    const container = await this.docker.createContainer({
      Image: "traefik:v2.10",
      name: "kalpana-traefik",
      Cmd: cmd,
      Labels: labels,
      ExposedPorts: {
        "80/tcp": {},
        "443/tcp": {},
        "8080/tcp": {}, // Dashboard
      },
      HostConfig: {
        Binds: [
          "/var/run/docker.sock:/var/run/docker.sock:ro",
          "kalpana-letsencrypt:/letsencrypt",
        ],
        PortBindings: {
          "80/tcp": [{ HostPort: "80" }],
          "443/tcp": [{ HostPort: "443" }],
          "8080/tcp": [{ HostPort: "8080" }], // Dashboard
        },
        NetworkMode: this.config.network,
        RestartPolicy: {
          Name: "unless-stopped",
        },
      },
    });

    await container.start();
    console.log("Traefik container started");
  }

  /**
   * Generate Traefik labels for a deployment
   */
  generateLabels(
    deploymentId: string,
    subdomain: string,
    port: number,
    baseUrl?: string
  ): Record<string, string> {
    const routerName = `deployment-${deploymentId}`;
    const serviceName = `deployment-${deploymentId}`;

    const labels: Record<string, string> = {
      "traefik.enable": "true",
      "kalpana.deployment.id": deploymentId,
    };

    if (baseUrl) {
      // Use subdomain routing
      const host = `${subdomain}.${baseUrl}`;
      labels[`traefik.http.routers.${routerName}.rule`] = `Host(\`${host}\`)`;
      labels[`traefik.http.routers.${routerName}.entrypoints`] = "websecure";
      labels[`traefik.http.routers.${routerName}.tls.certresolver`] =
        "letsencrypt";
      labels[`traefik.http.services.${serviceName}.loadbalancer.server.port`] =
        port.toString();
    } else {
      // No subdomain - Traefik not used for routing, just direct port mapping
      // Still add labels for consistency
      labels[`traefik.http.services.${serviceName}.loadbalancer.server.port`] =
        port.toString();
    }

    return labels;
  }

  /**
   * Connect a container to the Traefik network
   */
  async connectToNetwork(containerId: string): Promise<void> {
    try {
      const network = this.docker.getNetwork(this.config.network!);
      await network.connect({ Container: containerId });
    } catch (error: any) {
      // Ignore if already connected
      if (!error.message?.includes("already exists")) {
        throw error;
      }
    }
  }

  /**
   * Disconnect a container from the Traefik network
   */
  async disconnectFromNetwork(containerId: string): Promise<void> {
    try {
      const network = this.docker.getNetwork(this.config.network!);
      await network.disconnect({ Container: containerId });
    } catch (error) {
      console.error("Error disconnecting from network:", error);
    }
  }

  /**
   * Check if Traefik is enabled (base URL is set)
   */
  isEnabled(): boolean {
    return !!this.config.baseUrl;
  }

  /**
   * Get deployment URL
   */
  getDeploymentUrl(subdomain: string, baseUrl?: string): string {
    if (baseUrl) {
      return `https://${subdomain}.${baseUrl}`;
    }
    return ""; // Port-based access
  }
}

// Singleton instance
export const traefikManager = TraefikManager.getInstance();
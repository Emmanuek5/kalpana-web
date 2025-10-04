import Docker from "dockerode";
import { prisma } from "@/lib/db";

export interface TraefikConfig {
  baseUrl?: string; // OPTIONAL: Default domain for testing (e.g., "kalpana.local")
  // NOTE: Actual routing uses domains from database!
  email?: string; // For Let's Encrypt SSL certificates
  network?: string; // Docker network name (default: "traefik-proxy")
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
      cmd.push(
        `--certificatesresolvers.letsencrypt.acme.email=${this.config.email}`
      );
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
   * Check if Traefik is enabled
   * Traefik is enabled if:
   * 1. Base URL is set in env (for initial setup), OR
   * 2. Any verified domains exist in database (dynamic routing)
   */
  async isEnabled(): Promise<boolean> {
    // Check env var first (for initial setup)
    if (this.config.baseUrl) {
      return true;
    }

    // Check if any verified domains exist in database
    const domainCount = await prisma.domain.count({
      where: { verified: true },
    });

    return domainCount > 0;
  }

  /**
   * Generate Traefik labels for a bucket
   * Buckets use MinIO S3 API on port 9000
   */
  generateBucketLabels(
    bucketId: string,
    subdomain: string,
    domain: string
  ): Record<string, string> {
    const routerName = `bucket-${bucketId}`;
    const serviceName = `bucket-${bucketId}`;
    const host = `${subdomain}.${domain}`;

    return {
      "traefik.enable": "true",
      "kalpana.bucket.id": bucketId,
      [`traefik.http.routers.${routerName}.rule`]: `Host(\`${host}\`)`,
      [`traefik.http.routers.${routerName}.entrypoints`]: "web,websecure",
      [`traefik.http.routers.${routerName}.tls`]: "true",
      [`traefik.http.routers.${routerName}.tls.certresolver`]: "letsencrypt",
      [`traefik.http.services.${serviceName}.loadbalancer.server.port`]: "9000",
      // Add middleware to handle S3 path-style requests
      [`traefik.http.routers.${routerName}.middlewares`]: `${routerName}-headers`,
      [`traefik.http.middlewares.${routerName}-headers.headers.customrequestheaders.X-Forwarded-Proto`]: "https",
    };
  }

  /**
   * Get deployment URL
   * @param subdomain - The subdomain (e.g., "api")
   * @param domain - The domain from DATABASE (e.g., "example.com")
   * @returns Full URL (e.g., "https://api.example.com")
   */
  getDeploymentUrl(subdomain: string, domain?: string): string {
    if (domain) {
      return `https://${subdomain}.${domain}`;
    }
    return ""; // Port-based access
  }

  /**
   * Generate Traefik labels for an edge function
   * Edge functions route through the shared runtime container
   */
  generateEdgeFunctionLabels(
    functionId: string,
    subdomain: string,
    domain: string,
    path?: string
  ): Record<string, string> {
    const routerName = `function-${functionId}`;
    const serviceName = `edge-runtime`; // Shared service
    const host = `${subdomain}.${domain}`;

    const labels: Record<string, string> = {
      "traefik.enable": "true",
      "kalpana.function.id": functionId,
      [`traefik.http.routers.${routerName}.rule`]: path
        ? `Host(\`${host}\`) && PathPrefix(\`${path}\`)`
        : `Host(\`${host}\`)`,
      [`traefik.http.routers.${routerName}.entrypoints`]: "web,websecure",
      [`traefik.http.routers.${routerName}.tls`]: "true",
      [`traefik.http.routers.${routerName}.tls.certresolver`]: "letsencrypt",
      [`traefik.http.services.${serviceName}.loadbalancer.server.port`]: "3003",
      // Add middleware to forward function ID
      [`traefik.http.routers.${routerName}.middlewares`]: `${routerName}-headers`,
      [`traefik.http.middlewares.${routerName}-headers.headers.customrequestheaders.X-Function-Id`]: functionId,
    };

    return labels;
  }

  /**
   * Get bucket URL
   * @param subdomain - The bucket subdomain
   * @param domain - The domain from DATABASE
   * @returns Full URL for bucket access
   */
  getBucketUrl(subdomain: string, domain?: string): string {
    if (domain) {
      return `https://${subdomain}.${domain}`;
    }
    return ""; // Port-based access
  }

  /**
   * Get edge function URL
   * @param subdomain - The function subdomain
   * @param domain - The domain from DATABASE
   * @param path - Optional path prefix
   * @returns Full URL for function access
   */
  getEdgeFunctionUrl(subdomain: string, domain?: string, path?: string): string {
    if (domain) {
      const baseUrl = `https://${subdomain}.${domain}`;
      return path ? `${baseUrl}${path}` : baseUrl;
    }
    return ""; // No direct access without domain
  }
}

// Singleton instance
export const traefikManager = TraefikManager.getInstance();

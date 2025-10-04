import { prisma } from "@/lib/db";
import net from "net";
import Docker from "dockerode";



const UNASSINGABLE_PORTS = [3002, 3003];
export class PortManager {
  private minPort: number;
  private maxPort: number;
  private docker: Docker;

  constructor() {
    this.minPort = parseInt(process.env.CONTAINER_PORT_RANGE_START || "40000");
    this.maxPort = parseInt(process.env.CONTAINER_PORT_RANGE_END || "50000");

    // Initialize Docker client
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
  }

  private getDefaultDockerClient(): Docker {
    if (process.platform === "win32") {
      return new Docker({ socketPath: "//./pipe/docker_engine" });
    }
    return new Docker({ socketPath: "/var/run/docker.sock" });
  }

  /**
   * Check if any Docker container is using this port
   */
  private async isPortUsedByDocker(port: number): Promise<boolean> {
    try {
      const containers = await this.docker.listContainers({ all: true });

      for (const container of containers) {
        if (!container.Ports) continue;

        for (const portBinding of container.Ports) {
          // Check if this container has a port binding to our host port
          if (portBinding.PublicPort === port) {
            console.log(
              `🔴 Port ${port} is used by Docker container ${
                container.Names?.[0] || container.Id
              }`
            );
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error(`Error checking Docker for port ${port}:`, error);
      // If we can't check Docker, assume port might be in use to be safe
      return true;
    }
  }

  /**
   * Test if a port can actually be bound at the OS level AND is not used by Docker
   * This checks:
   * 1. Database records
   * 2. Docker containers (running or stopped)
   * 3. Actual system-level port binding
   */
  private async canBind(port: number): Promise<boolean> {
    // First check if Docker is using this port
    const dockerUsing = await this.isPortUsedByDocker(port);
    if (dockerUsing) {
      return false;
    }

    // Then check OS-level binding
    return new Promise((resolve) => {
      const server = net.createServer();

      // Set a timeout in case the check hangs
      const timeout = setTimeout(() => {
        server.close();
        resolve(false);
      }, 1000);

      server.once("error", (err: any) => {
        clearTimeout(timeout);
        // Port is in use if we get EADDRINUSE
        if (err.code === "EADDRINUSE") {
          console.log(`🔴 Port ${port} is already in use (OS level)`);
        }
        resolve(false);
      });

      server.once("listening", () => {
        clearTimeout(timeout);
        server.close(() => {
          console.log(
            `🟢 Port ${port} is available (DB + Docker + OS verified)`
          );
          resolve(true);
        });
      });

      try {
        // Bind to all interfaces to ensure the port is truly available
        server.listen(port, "0.0.0.0");
      } catch (_e) {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  private async getUsedPortsFromDb(): Promise<Set<number>> {
    const used = new Set<number>();

    // Check workspace ports
    const workspaces: {
      vscodePort: number | null;
      agentPort: number | null;
    }[] = await prisma.workspace.findMany({
      where: {
        status: { in: ["STARTING", "RUNNING"] },
        OR: [{ vscodePort: { not: null } }, { agentPort: { not: null } }],
      },
      select: { vscodePort: true, agentPort: true },
    });

    workspaces.forEach((ws) => {
      if (ws.vscodePort) used.add(ws.vscodePort);
      if (ws.agentPort) used.add(ws.agentPort);
    });

    // Also check agent ports
    const agents: {
      agentPort: number | null;
    }[] = await prisma.agent.findMany({
      where: {
        status: { in: ["CLONING", "RUNNING"] },
        agentPort: { not: null },
      },
      select: { agentPort: true },
    });

    agents.forEach((agent) => {
      if (agent.agentPort) used.add(agent.agentPort);
    });

    return used;
  }

  /**
   * Allocate two consecutive ports for a workspace (VSCode + Agent)
   * Checks BOTH database AND actual OS-level port availability
   * Automatically tries the next port if one is taken
   */
  async allocatePorts(): Promise<{ vscodePort: number; agentPort: number }> {
    console.log(
      `🔍 Searching for available ports in range ${this.minPort}-${this.maxPort}...`
    );
    const usedPorts = await this.getUsedPortsFromDb();
    console.log(`📊 Found ${usedPorts.size} ports in use from database`);

    // Find two consecutive available ports - checking BOTH DB and OS level
    for (let port = this.minPort; port < this.maxPort - 1; port++) {
      // Check 1: Skip if either port is allocated in our database
      if (usedPorts.has(port) || usedPorts.has(port + 1)) {
        continue; // Skip silently to reduce log spam
      }

      // Check 2: Test actual OS-level availability
      // This is critical - checks if ports are ACTUALLY free on the system
      // eslint-disable-next-line no-await-in-loop
      const p1Available = await this.canBind(port);
      if (!p1Available) {
        continue; // Port in use by another process, try next
      }

      // eslint-disable-next-line no-await-in-loop
      const p2Available = await this.canBind(port + 1);
      if (!p2Available) {
        continue; // Second port in use by another process, try next
      }

      // Both ports passed DB check AND OS-level binding test!
      console.log(
        `✅ Successfully allocated ports: ${port} (VSCode) and ${
          port + 1
        } (Agent) - verified available in DB and OS`
      );
      return { vscodePort: port, agentPort: port + 1 };
    }

    throw new Error(
      `❌ No available consecutive ports in range ${this.minPort}-${this.maxPort}. All port pairs are in use (checked both database and OS-level system ports).`
    );
  }

  /**
   * Release ports when workspace is stopped
   */
  async releasePorts(workspaceId: string): Promise<void> {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        vscodePort: null,
        agentPort: null,
      },
    });
  }

  /**
   * Release agent port when agent is stopped
   */
  async releaseAgentPort(agentId: string): Promise<void> {
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        agentPort: null,
      },
    });
  }

  /**
   * Check if a port is available
   */
  async isPortAvailable(port: number): Promise<boolean> {
    // Check workspace ports
    const inUseWorkspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ vscodePort: port }, { agentPort: port }],
        status: { in: ["STARTING", "RUNNING"] },
      },
    });
    if (inUseWorkspace) return false;

    // Check agent ports
    const inUseAgent = await prisma.agent.findFirst({
      where: {
        agentPort: port,
        status: { in: ["CLONING", "RUNNING"] },
      },
    });
    if (inUseAgent) return false;

    return this.canBind(port);
  }

  /**
   * Allocate a single port (for agent containers)
   * Checks BOTH database AND actual OS-level port availability
   * Automatically tries the next port if one is taken
   */
  async allocateAgentPort(): Promise<number> {
    console.log(
      `🔍 Searching for available agent port in range ${this.minPort}-${this.maxPort}...`
    );
    const usedPorts = await this.getUsedPortsFromDb();
    console.log(`📊 Found ${usedPorts.size} ports in use from database`);

    // Check all ports in range - checking BOTH DB and OS level
    for (let port = this.minPort; port <= this.maxPort; port++) {
      // Check 1: Skip if already allocated in our database
      if (usedPorts.has(port)) continue;

      // Check 2: Test actual OS-level availability
      // This is critical - checks if port is ACTUALLY free on the system
      // eslint-disable-next-line no-await-in-loop
      const isAvailableOnOS = await this.canBind(port);
      if (!isAvailableOnOS) {
        continue; // Port in use by another process, try next
      }

      // Port passed both DB check AND OS-level binding test!
      console.log(
        `✅ Successfully allocated port: ${port} - verified available in DB and OS`
      );
      return port;
    }

    throw new Error(
      `❌ No available agent ports in range ${this.minPort}-${this.maxPort}. All ports are in use (checked both database and OS-level system ports).`
    );
  }

  /**
   * Find an alternative port if the initially allocated one fails to bind
   * This is used as a fallback when Docker fails to bind a port
   */
  async findAlternativePort(failedPort: number): Promise<number> {
    console.log(`🔄 Port ${failedPort} failed to bind, finding alternative...`);

    // Get fresh list of used ports
    const usedPorts = await this.getUsedPortsFromDb();
    usedPorts.add(failedPort); // Add the failed port to avoid trying it again

    // Try to find an alternative port
    for (let port = this.minPort; port <= this.maxPort; port++) {
      if (usedPorts.has(port)) continue;

      // eslint-disable-next-line no-await-in-loop
      const canUsePort = await this.canBind(port);
      if (!canUsePort) continue;

      console.log(`✅ Found alternative port: ${port}`);
      return port;
    }

    throw new Error("No alternative ports available");
  }

  /**
   * Find alternative consecutive ports if the initially allocated ones fail to bind
   * This is used as a fallback when Docker fails to bind workspace ports
   */
  async findAlternativePorts(
    failedVscodePort: number,
    failedAgentPort: number
  ): Promise<{ vscodePort: number; agentPort: number }> {
    console.log(
      `🔄 Ports ${failedVscodePort} and ${failedAgentPort} failed to bind, finding alternatives...`
    );

    // Get fresh list of used ports
    const usedPorts = await this.getUsedPortsFromDb();
    usedPorts.add(failedVscodePort);
    usedPorts.add(failedAgentPort);

    // Find new consecutive ports
    for (let port = this.minPort; port < this.maxPort - 1; port++) {
      if (usedPorts.has(port) || usedPorts.has(port + 1)) continue;

      // Test OS-level availability
      // eslint-disable-next-line no-await-in-loop
      const p1 = await this.canBind(port);
      // eslint-disable-next-line no-await-in-loop
      const p2 = await this.canBind(port + 1);

      if (!p1 || !p2) continue;

      console.log(
        `✅ Found alternative consecutive ports: ${port} and ${port + 1}`
      );
      return { vscodePort: port, agentPort: port + 1 };
    }

    throw new Error("No alternative consecutive ports available");
  }
}

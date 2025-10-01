import { prisma } from "@/lib/db";
import net from "net";

export class PortManager {
  private minPort: number;
  private maxPort: number;

  constructor() {
    this.minPort = parseInt(process.env.CONTAINER_PORT_RANGE_START || "40000");
    this.maxPort = parseInt(process.env.CONTAINER_PORT_RANGE_END || "50000");
  }

  private async canBind(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => {
        resolve(false);
      });
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      try {
        server.listen(port, "0.0.0.0");
      } catch (_e) {
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
   */
  async allocatePorts(): Promise<{ vscodePort: number; agentPort: number }> {
    const usedPorts = await this.getUsedPortsFromDb();

    // Find two consecutive available ports
    for (let port = this.minPort; port < this.maxPort - 1; port++) {
      if (usedPorts.has(port) || usedPorts.has(port + 1)) continue;
      // Probe OS-level availability as well
      // eslint-disable-next-line no-await-in-loop
      const p1 = await this.canBind(port);
      // eslint-disable-next-line no-await-in-loop
      const p2 = await this.canBind(port + 1);
      if (!p1 || !p2) continue;
      return { vscodePort: port, agentPort: port + 1 };
    }

    throw new Error("No available ports in range");
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
   * This method checks both the database AND the actual OS-level port availability
   */
  async allocateAgentPort(): Promise<number> {
    const usedPorts = await this.getUsedPortsFromDb();

    // Check all ports in range for actual availability
    for (let port = this.minPort; port <= this.maxPort; port++) {
      // Skip if already in DB
      if (usedPorts.has(port)) continue;

      // Test actual OS-level availability (this is the critical check)
      // eslint-disable-next-line no-await-in-loop
      const canUsePort = await this.canBind(port);
      if (!canUsePort) {
        console.log(`⚠️ Port ${port} is in use at OS level, trying next...`);
        continue;
      }

      console.log(`✅ Allocated available port: ${port}`);
      return port;
    }

    throw new Error(
      `No available agent ports in range ${this.minPort}-${this.maxPort}. All ports are in use.`
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
}

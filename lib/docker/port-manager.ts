import { prisma } from "@/lib/db";

export class PortManager {
  private minPort: number;
  private maxPort: number;

  constructor() {
    this.minPort = parseInt(process.env.CONTAINER_PORT_RANGE_START || "40000");
    this.maxPort = parseInt(process.env.CONTAINER_PORT_RANGE_END || "50000");
  }

  /**
   * Allocate two consecutive ports for a workspace (VSCode + Agent)
   */
  async allocatePorts(): Promise<{ vscodePort: number; agentPort: number }> {
    // Get all currently used ports from database
    const workspaces = await prisma.workspace.findMany({
      where: {
        status: {
          in: ["STARTING", "RUNNING"],
        },
        vscodePort: { not: null },
        agentPort: { not: null },
      },
      select: {
        vscodePort: true,
        agentPort: true,
      },
    });

    const usedPorts = new Set<number>();
    workspaces.forEach((ws) => {
      if (ws.vscodePort) usedPorts.add(ws.vscodePort);
      if (ws.agentPort) usedPorts.add(ws.agentPort);
    });

    // Find two consecutive available ports
    for (let port = this.minPort; port < this.maxPort - 1; port++) {
      if (!usedPorts.has(port) && !usedPorts.has(port + 1)) {
        return {
          vscodePort: port,
          agentPort: port + 1,
        };
      }
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
   * Check if a port is available
   */
  async isPortAvailable(port: number): Promise<boolean> {
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ vscodePort: port }, { agentPort: port }],
        status: {
          in: ["STARTING", "RUNNING"],
        },
      },
    });

    return !workspace;
  }
}

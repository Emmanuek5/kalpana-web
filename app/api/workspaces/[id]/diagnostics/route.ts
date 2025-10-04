import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authorizeWorkspaceAccess } from "@/lib/workspace-auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { dockerManager } from "@/lib/docker/manager";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify ownership
    // Verify user has access to this workspace
    const workspace = await authorizeWorkspaceAccess(workspaceId, session.user.id);
    if (!workspace) {
      return NextResponse.json(
        { error: "You are not authorized to access this workspace" },
        { status: 403 }
      );
    }

    if (!workspace.containerId) {
      return NextResponse.json(
        { error: "Container not running" },
        { status: 400 }
      );
    }

    // Get various diagnostic information
    const diagnostics: any = {};

    // Check extension activation log
    try {
      const activationLog = await dockerManager.execInContainer(
        workspace.containerId,
        ["cat", "/tmp/kalpana-extension-activated.log"]
      );
      diagnostics.extensionActivationLog = activationLog.stdout || "Not found";
    } catch (error) {
      diagnostics.extensionActivationLog = "File not found or error reading";
    }

    // Check if code-server is running
    try {
      const psResult = await dockerManager.execInContainer(
        workspace.containerId,
        ["ps", "aux"]
      );
      const processes = psResult.stdout;
      diagnostics.codeServerRunning = processes.includes("code-server");
      diagnostics.agentBridgeRunning = processes.includes("bun");
      diagnostics.processes = processes;
    } catch (error) {
      diagnostics.processCheckError = (error as Error).message;
    }

    // Check if extension is installed
    try {
      const extensionsList = await dockerManager.execInContainer(
        workspace.containerId,
        ["code-server", "--list-extensions"]
      );
      diagnostics.installedExtensions = extensionsList.stdout;
      diagnostics.kalpanaExtensionInstalled = extensionsList.stdout.includes(
        "kalpana-diagnostics"
      );
    } catch (error) {
      diagnostics.extensionListError = (error as Error).message;
    }

    // Check if WebSocket port is listening
    try {
      const netstatResult = await dockerManager.execInContainer(
        workspace.containerId,
        [
          "sh",
          "-c",
          "netstat -tuln | grep 3002 || echo 'Port 3002 not listening'",
        ]
      );
      diagnostics.port3002Status = netstatResult.stdout;
    } catch (error) {
      diagnostics.portCheckError = (error as Error).message;
    }

    // Get container logs (last 200 lines)
    try {
      const logs = await dockerManager.getContainerLogs(workspace.containerId, {
        tail: 200,
        timestamps: true,
      });
      diagnostics.containerLogs = logs;
    } catch (error) {
      diagnostics.logsError = (error as Error).message;
    }

    return NextResponse.json({
      workspaceId: workspace.id,
      containerId: workspace.containerId,
      diagnostics,
    });
  } catch (error: any) {
    console.error("Error fetching diagnostics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch diagnostics" },
      { status: 500 }
    );
  }
}

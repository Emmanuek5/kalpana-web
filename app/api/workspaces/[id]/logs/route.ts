import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    if (!workspace.containerId) {
      return NextResponse.json({ logs: "" }, { status: 200 });
    }

    // Get logs
    const logs = await dockerManager.getContainerLogs(workspace.containerId, {
      tail: 100,
      timestamps: true,
    });

    // Parse logs to extract startup status
    const startupStatus = parseStartupLogs(logs);

    return NextResponse.json({
      logs,
      status: startupStatus,
    });
  } catch (error: any) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

function parseStartupLogs(logs: string): {
  stage: string;
  message: string;
  progress: number;
} {
  const lines = logs.split("\n").filter((line) => line.trim());

  // Check for specific startup markers
  if (logs.includes("🚀 Starting Kalpana Workspace")) {
    if (logs.includes("✅ Agent bridge started")) {
      if (logs.includes("📝 Starting code-server")) {
        return {
          stage: "ready",
          message: "Starting code server...",
          progress: 90,
        };
      }
      return {
        stage: "agent",
        message: "Agent bridge ready",
        progress: 70,
      };
    }

    if (logs.includes("📦 Cloning repository")) {
      return {
        stage: "clone",
        message: "Cloning repository...",
        progress: 30,
      };
    }

    if (logs.includes("🔧 Applying Nix configuration")) {
      return {
        stage: "nix",
        message: "Applying Nix configuration...",
        progress: 50,
      };
    }

    if (logs.includes("🌉 Starting agent bridge")) {
      return {
        stage: "agent",
        message: "Starting agent bridge...",
        progress: 60,
      };
    }

    return {
      stage: "init",
      message: "Initializing workspace...",
      progress: 10,
    };
  }

  return {
    stage: "starting",
    message: "Container starting...",
    progress: 5,
  };
}

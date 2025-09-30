import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { deploymentManager } from "@/lib/docker/deployment-manager";
import Docker from "dockerode";

// GET /api/deployments/:id/logs - Get deployment logs (with streaming support)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: deploymentId } = await params;

  // Verify ownership
  const deployment = await prisma.deployment.findFirst({
    where: {
      id: deploymentId,
      workspace: {
        userId: session.user.id,
      },
    },
  });

  if (!deployment) {
    return NextResponse.json(
      { error: "Deployment not found" },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(request.url);
  const tail = parseInt(searchParams.get("tail") || "100");
  const follow = searchParams.get("follow") === "true";

  try {
    // If not following, return static logs
    if (!follow) {
      const logs = await deploymentManager.getDeploymentLogs(deploymentId, tail);
      return NextResponse.json({ logs });
    }

    // Stream logs using SSE
    if (!deployment.containerId) {
      return NextResponse.json(
        { error: "Deployment not running" },
        { status: 400 }
      );
    }

    const docker = new Docker({
      socketPath:
        process.platform === "win32"
          ? "//./pipe/docker_engine"
          : "/var/run/docker.sock",
    });

    const container = docker.getContainer(deployment.containerId);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const logStream = await container.logs({
            follow: true,
            stdout: true,
            stderr: true,
            tail,
            timestamps: true,
          });

          logStream.on("data", (chunk: Buffer) => {
            // Docker log format: 8-byte header + data
            try {
              const data = chunk.slice(8).toString("utf-8");
              const message = `data: ${JSON.stringify({ log: data })}\n\n`;
              controller.enqueue(encoder.encode(message));
            } catch (e) {
              console.error("Error processing log chunk:", e);
            }
          });

          logStream.on("end", () => {
            controller.close();
          });

          logStream.on("error", (error) => {
            console.error("Log stream error:", error);
            controller.close();
          });
        } catch (error) {
          console.error("Error streaming logs:", error);
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Error getting deployment logs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get logs" },
      { status: 500 }
    );
  }
}
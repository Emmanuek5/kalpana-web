import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authorizeWorkspaceAccess } from "@/lib/workspace-auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { dockerManager } from "@/lib/docker/manager";
import Docker from "dockerode";

// Background monitoring function that runs independently of client connection
async function monitorWorkspaceRestart(
  workspaceId: string,
  containerId: string
): Promise<void> {
  console.log(`🔍 Starting background monitor for workspace restart ${workspaceId}`);

  const docker = dockerManager["docker"] as Docker;
  const container = docker.getContainer(containerId);

  if (!container) {
    console.error(`❌ Container not found for workspace ${workspaceId}`);
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { status: "ERROR" },
    });
    return;
  }

  let agentReady = false;
  let codeServerReady = false;
  let checksPerformed = 0;
  const maxChecks = 30; // 60 seconds timeout for restart

  // Monitor container logs for readiness signals
  const logMonitor = setInterval(async () => {
    try {
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: 100,
      });

      const logText = logs.toString();

      if (
        !agentReady &&
        (logText.includes("Agent bridge started") ||
          logText.includes("agent bridge started"))
      ) {
        agentReady = true;
        console.log(`✅ Workspace ${workspaceId}: Agent bridge ready after restart`);
      }

      if (!codeServerReady && logText.includes("HTTP server listening")) {
        codeServerReady = true;
        console.log(`✅ Workspace ${workspaceId}: Code-server ready after restart`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("no such container")) {
        clearInterval(logMonitor);
        clearInterval(statusCheck);
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { status: "ERROR" },
        });
        console.error(`❌ Container not found for workspace ${workspaceId}`);
        return;
      }
      console.error(`Error reading logs for workspace ${workspaceId}:`, error);
    }
  }, 2000);

  // Check container status and readiness
  const statusCheck = setInterval(async () => {
    try {
      checksPerformed++;
      const info = await container.inspect();

      if (checksPerformed % 5 === 0) {
        console.log(
          `⏱ Workspace ${workspaceId} restart: ${checksPerformed} checks performed`
        );
      }

      // Ready if both are ready, OR if code-server is ready and we've waited 30+ seconds
      const isReady = info.State.Running && agentReady && codeServerReady;
      const failsafeReady =
        info.State.Running && codeServerReady && checksPerformed > 15;

      if (isReady || failsafeReady) {
        clearInterval(logMonitor);
        clearInterval(statusCheck);

        if (failsafeReady && !agentReady) {
          console.log(
            `⚠️ Workspace ${workspaceId}: Using failsafe after restart (code-server ready, agent bridge not detected)`
          );
        }

        // Mark workspace as RUNNING
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { status: "RUNNING" },
        });

        console.log(`✅ Workspace ${workspaceId} is now RUNNING after restart`);
        return;
      }

      // Timeout after max checks
      if (checksPerformed >= maxChecks) {
        clearInterval(logMonitor);
        clearInterval(statusCheck);

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { status: "ERROR" },
        });

        console.error(`❌ Workspace ${workspaceId} restart timeout`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("no such container")) {
        clearInterval(logMonitor);
        clearInterval(statusCheck);
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { status: "ERROR" },
        });
        console.error(`❌ Container not found for workspace ${workspaceId}`);
        return;
      }
      console.error(`Error checking workspace ${workspaceId}:`, error);
    }
  }, 2000);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
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

    if (workspace.status !== "RUNNING" || !workspace.containerId) {
      return new Response("Workspace must be running", { status: 400 });
    }

    // Update workspace status
    await prisma.workspace.update({
      where: { id },
      data: { status: "STARTING" },
    });

    // Get container
    const docker = dockerManager["docker"] as Docker;
    const container = docker.getContainer(workspace.containerId);

    // Restart the container
    await container.restart();

    // Start background monitoring (runs independently of this request)
    monitorWorkspaceRestart(id, workspace.containerId).catch((error) => {
      console.error(`Background monitoring failed for workspace ${id}:`, error);
    });

    // Create a readable stream to send logs to the client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial status
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "status",
                stage: "restarting",
                message: "Container restarted, monitoring startup...",
              })}\n\n`
            )
          );

          // Stream logs to the client
          const logStream = await container.logs({
            follow: true,
            stdout: true,
            stderr: true,
            tail: 100,
            timestamps: false,
          });

          // Process log stream for client display
          logStream.on("data", (chunk: Buffer) => {
            const log = chunk
              .toString("utf-8")
              .replace(/[\x00-\x1F\x7F-\x9F]/g, "");
            const lines = log.split("\n").filter((l) => l.trim());

            for (const line of lines) {
              try {
                // Send log line to client
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "log",
                      message: line,
                    })}\n\n`
                  )
                );
              } catch (e) {
                // Client disconnected, that's fine
              }
            }
          });

          logStream.on("end", () => {
            try {
              controller.close();
            } catch (e) {
              // Already closed
            }
          });

          // Poll database for status updates from background monitor
          const statusCheckInterval = setInterval(async () => {
            try {
              const ws = await prisma.workspace.findUnique({
                where: { id },
                select: { status: true },
              });

              if (ws?.status === "RUNNING") {
                clearInterval(statusCheckInterval);
                (logStream as any).destroy?.();

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "complete",
                      message: "Workspace ready!",
                    })}\n\n`
                  )
                );
                controller.close();
              } else if (ws?.status === "ERROR") {
                clearInterval(statusCheckInterval);
                (logStream as any).destroy?.();

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "error",
                      message: "Workspace failed to restart",
                    })}\n\n`
                  )
                );
                controller.close();
              }
            } catch (e) {
              // Ignore errors, background monitor will handle it
            }
          }, 2000);

          // Client timeout - stop streaming but background continues
          setTimeout(() => {
            clearInterval(statusCheckInterval);
            (logStream as any).destroy?.();
            try {
              controller.close();
            } catch (e) {
              // Already closed
            }
          }, 60000);
        } catch (error: any) {
          console.error("Stream error:", error);
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  message: error.message,
                })}\n\n`
              )
            );
          } catch (e) {
            // Client disconnected
          }
          try {
            controller.close();
          } catch (e) {
            // Already closed
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Error initiating rebuild:", error);
    return new Response(error.message || "Failed to rebuild", { status: 500 });
  }
}
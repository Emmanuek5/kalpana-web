import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dockerManager } from "@/lib/docker/manager";
import { NextRequest } from "next/server";
import Docker from "dockerode";

// Background monitoring function that runs independently of client connection
async function monitorWorkspaceStartup(
  workspaceId: string,
  containerId: string
): Promise<void> {
  console.log(`🔍 Starting background monitor for workspace ${workspaceId}`);

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
  let nixInstalling = false;
  let checksPerformed = 0;
  const baseMaxChecks = 45; // 90 seconds base timeout
  let maxChecks = baseMaxChecks;

  // Monitor container logs for readiness signals
  const logMonitor = setInterval(async () => {
    try {
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: 100,
      });

      

      const logText = logs.toString();

      // Check if Nix is installing packages
      if (
        !nixInstalling &&
        (logText.includes("copying path") ||
          logText.includes("building") ||
          logText.includes("downloading") ||
          logText.includes("these") ||
          logText.includes("will be fetched"))
      ) {
        nixInstalling = true;
        maxChecks = 250; // Extend to 5 minutes when Nix is installing
        console.log(
          `📦 Workspace ${workspaceId}: Nix package installation detected, extending timeout to 5 minutes`
        );
      }

      // Check if Nix installation completed
      if (
        nixInstalling &&
        (logText.includes("Nix environment configured") ||
          logText.includes("Installing Kalpana") ||
          logText.includes("code-server"))
      ) {
        nixInstalling = false;
        console.log(`✅ Workspace ${workspaceId}: Nix installation completed`);
      }

      if (
        !agentReady &&
        (logText.includes("Agent bridge started") ||
          logText.includes("agent bridge started"))
      ) {
        agentReady = true;
        console.log(`✅ Workspace ${workspaceId}: Agent bridge ready`);
      }

      if (!codeServerReady && logText.includes("HTTP server listening")) {
        codeServerReady = true;
        console.log(`✅ Workspace ${workspaceId}: Code-server ready`);
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

      const statusMsg = nixInstalling ? "NixInstalling" : "Ready";

      if (checksPerformed % 10 === 0) {
        console.log(
          `⏱ Workspace ${workspaceId}: ${checksPerformed} checks performed, status: ${statusMsg}`
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
            `⚠️ Workspace ${workspaceId}: Using failsafe (code-server ready, agent bridge not detected)`
          );
        }

        // Mark workspace as RUNNING
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { status: "RUNNING" },
        });

        console.log(`✅ Workspace ${workspaceId} is now RUNNING`);
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

        console.error(`❌ Workspace ${workspaceId} startup timeout`);
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
  }, 3000);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { id } = await context.params;

    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return new Response("Workspace not found", { status: 404 });
    }

    if (workspace.status === "RUNNING") {
      return new Response("Workspace is already running", { status: 400 });
    }

    // Get GitHub access token if user has connected their account
    const githubAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: "github",
      },
      select: {
        accessToken: true,
      },
    });

    // Get user's OpenRouter API key for autocomplete
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { openrouterApiKey: true },
    });

    // Start the workspace container
    const container = await dockerManager.createWorkspace(workspace.id, {
      githubRepo: workspace.githubRepo || undefined,
      githubToken: githubAccount?.accessToken || undefined,
      nixConfig: workspace.nixConfig || undefined,
      template: workspace.template || undefined,
      preset: workspace.preset || "default",
      gitUserName: session.user.name || undefined,
      gitUserEmail: session.user.email || undefined,
      openrouterApiKey: user?.openrouterApiKey || undefined,
      autocompleteModel: "google/gemma-3-27b-it:free", // Can be made configurable later
    });

    // Start background monitoring (runs independently of this request)
    monitorWorkspaceStartup(id, container.containerId).catch((error) => {
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
                stage: "starting",
                message: "Container created, monitoring startup...",
              })}\n\n`
            )
          );

          // Get the container
          const docker = dockerManager["docker"] as Docker;
          const dockerContainer = docker.getContainer(container.containerId);

          // Stream logs to the client
          const logStream = await dockerContainer.logs({
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
                      message: "Workspace failed to start",
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
          }, 90000);
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
    console.error("Error initiating startup:", error);
    return new Response(error.message || "Failed to start", { status: 500 });
  }
}

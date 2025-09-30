import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dockerManager } from "@/lib/docker/manager";
import { NextRequest } from "next/server";

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

    // Create a readable stream to send logs
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
                message: "Creating container...",
              })}\n\n`
            )
          );

          // Start the workspace container
          const container = await dockerManager.createWorkspace(workspace.id, {
            githubRepo: workspace.githubRepo || undefined,
            githubToken: githubAccount?.accessToken || undefined,
            nixConfig: workspace.nixConfig || undefined,
            template: workspace.template || undefined,
            preset: workspace.preset || "default",
            gitUserName: session.user.name || undefined,
            gitUserEmail: session.user.email || undefined,
          });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "status",
                stage: "logs",
                message: "Streaming startup logs...",
              })}\n\n`
            )
          );

          // Get the container
          const dockerContainer = await dockerManager["docker"].getContainer(
            container.containerId
          );

          // Stream logs
          const logStream = await dockerContainer.logs({
            follow: true,
            stdout: true,
            stderr: true,
            tail: 100,
            timestamps: false,
          });

          let checkInterval: NodeJS.Timeout;
          let agentReady = false;
          let codeServerReady = false;

          // Process log stream
          logStream.on("data", (chunk: Buffer) => {
            const log = chunk
              .toString("utf-8")
              .replace(/[\x00-\x1F\x7F-\x9F]/g, "");
            const lines = log.split("\n").filter((l) => l.trim());

            for (const line of lines) {
              // Send log line
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "log", message: line })}\n\n`
                )
              );

              // Check for readiness markers (require BOTH agent and code-server)
              if (line.includes("Agent bridge started")) {
                agentReady = true;
              }
              if (line.includes("HTTP server listening")) {
                codeServerReady = true;
              }
            }
          });

          // Check if container is ready
          checkInterval = setInterval(async () => {
            try {
              const info = await dockerContainer.inspect();
              if (info.State.Running && agentReady && codeServerReady) {
                clearInterval(checkInterval);
                (logStream as any).destroy?.();

                // Mark workspace RUNNING only now that both subsystems are ready
                await prisma.workspace.update({
                  where: { id },
                  data: { status: "RUNNING" },
                });

                // Send completion
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "complete",
                      message: "Workspace ready!",
                    })}\n\n`
                  )
                );

                controller.close();
              }
            } catch (error) {
              console.error("Error checking container:", error);
            }
          }, 2000);

          // Timeout after 90 seconds (starting takes longer than rebuild)
          setTimeout(() => {
            clearInterval(checkInterval);
            (logStream as any).destroy?.();
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  message: "Startup timeout (agent or code-server not ready)",
                })}\n\n`
              )
            );
            controller.close();
          }, 90000);
        } catch (error: any) {
          console.error("Startup error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                message: error.message,
              })}\n\n`
            )
          );
          controller.close();
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

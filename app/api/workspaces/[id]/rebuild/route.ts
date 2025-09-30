import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { dockerManager } from "@/lib/docker/manager";

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
    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return new Response("Workspace not found", { status: 404 });
    }

    if (workspace.status !== "RUNNING" || !workspace.containerId) {
      return new Response("Workspace must be running", { status: 400 });
    }

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
                stage: "restarting",
                message: "Initiating restart...",
              })}\n\n`
            )
          );

          // Update workspace status
          await prisma.workspace.update({
            where: { id },
            data: { status: "STARTING" },
          });

          // Get container
          const container = await dockerManager["docker"].getContainer(
            workspace.containerId!
          );

          // Restart the container
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "status",
                stage: "stopping",
                message: "Stopping container...",
              })}\n\n`
            )
          );

          await container.restart();

          // Wait a moment for container to start
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Stream logs
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "status",
                stage: "logs",
                message: "Streaming startup logs...",
              })}\n\n`
            )
          );

          const logStream = await container.logs({
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
              const info = await container.inspect();
              if (info.State.Running && agentReady && codeServerReady) {
                clearInterval(checkInterval);
                (logStream as any).destroy?.();

                // Update workspace status
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

          // Timeout after 60 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            (logStream as any).destroy?.();
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  message: "Rebuild timeout (agent or code-server not ready)",
                })}\n\n`
              )
            );
            controller.close();
          }, 60000);
        } catch (error: any) {
          console.error("Rebuild error:", error);
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
    console.error("Error initiating rebuild:", error);
    return new Response(error.message || "Failed to rebuild", { status: 500 });
  }
}

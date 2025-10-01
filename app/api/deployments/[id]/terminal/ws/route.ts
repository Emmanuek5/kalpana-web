import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import Docker from "dockerode";

// Helper function to get Docker client
function getDockerClient() {
  const envHost = process.env.DOCKER_HOST;

  if (envHost && envHost.length > 0) {
    if (envHost.startsWith("unix://")) {
      return new Docker({
        socketPath: envHost.replace(/^unix:\/\//, ""),
      });
    } else if (envHost.startsWith("npipe://")) {
      return new Docker({
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
        return new Docker({ protocol, host, port });
      } catch (_e) {
        // Fallback to default
      }
    }
  }

  if (process.platform === "win32") {
    return new Docker({ socketPath: "//./pipe/docker_engine" });
  }
  return new Docker({ socketPath: "/var/run/docker.sock" });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: deploymentId } = await params;

  // Verify ownership
  const deployment = await prisma.deployment.findFirst({
    where: {
      id: deploymentId,
      userId: session.user.id,
    },
  });

  if (!deployment || !deployment.containerId) {
    return new Response("Deployment not found or not running", { status: 404 });
  }

  // Upgrade to WebSocket
  const upgradeHeader = request.headers.get("upgrade");
  if (upgradeHeader !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  try {
    const docker = getDockerClient();
    const container = docker.getContainer(deployment.containerId);

    // Determine working directory
    const workingDir =
      deployment.workingDir ||
      (deployment.githubRepo ? "/app/repo" : "/workspace");

    // Create an interactive shell session
    const exec = await container.exec({
      Cmd: ["/bin/sh"],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      WorkingDir: workingDir,
    });

    const stream = await exec.start({
      hijack: true,
      stdin: true,
      Tty: true,
    });

    // This is a simplified version - in production, you'd use a proper WebSocket library
    // For Next.js, we need to handle this differently since built-in WebSocket support is limited
    // Return a response indicating WebSocket upgrade is needed
    return new Response(
      JSON.stringify({
        message:
          "WebSocket terminal requires additional setup. Use HTTP terminal endpoint for now.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error creating terminal session:", error);
    return new Response(error.message || "Failed to create terminal session", {
      status: 500,
    });
  }
}

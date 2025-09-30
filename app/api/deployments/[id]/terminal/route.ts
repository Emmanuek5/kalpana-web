import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import Docker from "dockerode";

// POST /api/deployments/:id/terminal - Execute command in deployment container
export async function POST(
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

  if (!deployment || !deployment.containerId) {
    return NextResponse.json(
      { error: "Deployment not found or not running" },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const { command } = body;

    if (!command) {
      return NextResponse.json(
        { error: "Command is required" },
        { status: 400 }
      );
    }

    // Create Docker client
    const docker = new Docker({
      socketPath:
        process.platform === "win32"
          ? "//./pipe/docker_engine"
          : "/var/run/docker.sock",
    });

    const container = docker.getContainer(deployment.containerId);

    // Create exec instance
    const exec = await container.exec({
      Cmd: ["/bin/bash", "-c", command],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: deployment.workingDir || "/workspace",
    });

    const stream = await exec.start({ Detach: false });

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";

      stream.on("data", (chunk: Buffer) => {
        const header = chunk.readUInt8(0);
        const data = chunk.slice(8).toString("utf-8");

        if (header === 1) {
          stdout += data;
        } else if (header === 2) {
          stderr += data;
        }
      });

      stream.on("end", async () => {
        const info = await exec.inspect();
        resolve(
          NextResponse.json({
            stdout,
            stderr,
            exitCode: info.ExitCode || 0,
          })
        );
      });

      stream.on("error", (error) => {
        resolve(
          NextResponse.json(
            { error: error.message, stdout, stderr },
            { status: 500 }
          )
        );
      });
    });
  } catch (error: any) {
    console.error("Error executing command:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute command" },
      { status: 500 }
    );
  }
}
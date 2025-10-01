import { NextRequest, NextResponse } from "next/server";
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

// GET /api/deployments/:id/files - List files in deployment container
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
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get("path") || "/";

  // Verify ownership
  const deployment = await prisma.deployment.findFirst({
    where: {
      id: deploymentId,
      userId: session.user.id,
    },
  });

  if (!deployment || !deployment.containerId) {
    return NextResponse.json(
      { error: "Deployment not found or not running" },
      { status: 404 }
    );
  }

  try {
    const docker = getDockerClient();
    const container = docker.getContainer(deployment.containerId);

    // Determine working directory
    const workDir =
      deployment.workingDir ||
      (deployment.githubRepo ? "/app/repo" : "/workspace");

    // Build the full path
    const fullPath = path === "/" ? workDir : `${workDir}${path}`;

    // Execute ls command to list files
    const exec = await container.exec({
      Cmd: [
        "/bin/sh",
        "-c",
        `ls -la "${fullPath}" 2>/dev/null || echo "ERROR: Directory not found"`,
      ],
      AttachStdout: true,
      AttachStderr: true,
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

      stream.on("end", () => {
        if (stdout.includes("ERROR:")) {
          resolve(NextResponse.json({ files: [], directories: [] }));
          return;
        }

        // Parse ls output
        const lines = stdout.split("\n").filter((line) => line.trim());
        const files: string[] = [];
        const directories: string[] = [];

        // Skip first line (total) and parse rest
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const parts = line.split(/\s+/);
          if (parts.length < 9) continue;

          const permissions = parts[0];
          const name = parts.slice(8).join(" ");

          // Skip . and ..
          if (name === "." || name === "..") continue;

          if (permissions.startsWith("d")) {
            directories.push(name);
          } else {
            files.push(name);
          }
        }

        resolve(
          NextResponse.json({
            files: files.sort(),
            directories: directories.sort(),
            currentPath: path,
          })
        );
      });

      stream.on("error", (error) => {
        resolve(NextResponse.json({ error: error.message }, { status: 500 }));
      });
    });
  } catch (error: any) {
    console.error("Error listing files:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list files" },
      { status: 500 }
    );
  }
}

// POST /api/deployments/:id/files - Read or write file
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
      userId: session.user.id,
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
    const { action, path, content } = body;

    if (!action || !path) {
      return NextResponse.json(
        { error: "Action and path are required" },
        { status: 400 }
      );
    }

    const docker = getDockerClient();
    const container = docker.getContainer(deployment.containerId);

    // Determine working directory
    const workDir =
      deployment.workingDir ||
      (deployment.githubRepo ? "/app/repo" : "/workspace");
    const fullPath = `${workDir}${path}`;

    if (action === "read") {
      // Read file
      const exec = await container.exec({
        Cmd: ["/bin/sh", "-c", `cat "${fullPath}"`],
        AttachStdout: true,
        AttachStderr: true,
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
          if (info.ExitCode !== 0) {
            resolve(
              NextResponse.json(
                { error: stderr || "Failed to read file" },
                { status: 500 }
              )
            );
          } else {
            resolve(NextResponse.json({ content: stdout }));
          }
        });

        stream.on("error", (error) => {
          resolve(NextResponse.json({ error: error.message }, { status: 500 }));
        });
      });
    } else if (action === "write") {
      // Write file
      if (content === undefined) {
        return NextResponse.json(
          { error: "Content is required for write action" },
          { status: 400 }
        );
      }

      // Escape content for shell
      const escapedContent = content.replace(/'/g, "'\\''");

      const exec = await container.exec({
        Cmd: ["/bin/sh", "-c", `echo '${escapedContent}' > "${fullPath}"`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Detach: false });

      return new Promise((resolve) => {
        let stderr = "";

        stream.on("data", (chunk: Buffer) => {
          const header = chunk.readUInt8(0);
          const data = chunk.slice(8).toString("utf-8");

          if (header === 2) {
            stderr += data;
          }
        });

        stream.on("end", async () => {
          const info = await exec.inspect();
          if (info.ExitCode !== 0) {
            resolve(
              NextResponse.json(
                { error: stderr || "Failed to write file" },
                { status: 500 }
              )
            );
          } else {
            resolve(NextResponse.json({ success: true }));
          }
        });

        stream.on("error", (error) => {
          resolve(NextResponse.json({ error: error.message }, { status: 500 }));
        });
      });
    } else if (action === "delete") {
      // Delete file
      const exec = await container.exec({
        Cmd: ["/bin/sh", "-c", `rm -f "${fullPath}"`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Detach: false });

      return new Promise((resolve) => {
        let stderr = "";

        stream.on("data", (chunk: Buffer) => {
          const header = chunk.readUInt8(0);
          const data = chunk.slice(8).toString("utf-8");

          if (header === 2) {
            stderr += data;
          }
        });

        stream.on("end", async () => {
          const info = await exec.inspect();
          if (info.ExitCode !== 0) {
            resolve(
              NextResponse.json(
                { error: stderr || "Failed to delete file" },
                { status: 500 }
              )
            );
          } else {
            resolve(NextResponse.json({ success: true }));
          }
        });

        stream.on("error", (error) => {
          resolve(NextResponse.json({ error: error.message }, { status: 500 }));
        });
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'read', 'write', or 'delete'" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Error handling file operation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to handle file operation" },
      { status: 500 }
    );
  }
}

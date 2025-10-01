import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dockerManager } from "@/lib/docker/manager";

export async function GET(
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

    if (workspace.status !== "RUNNING" || !workspace.containerId) {
      return Response.json({ error: "Workspace not running" }, { status: 400 });
    }

    // Check if index exists and is recent (< 5 minutes old)
    const checkIndexCmd = [
      "sh",
      "-c",
      `if [ -f /workspace/.kalpana/codebase-index.json ]; then
        age=$(($(date +%s) - $(stat -c %Y /workspace/.kalpana/codebase-index.json 2>/dev/null || echo 0)))
        if [ $age -lt 300 ]; then
          cat /workspace/.kalpana/codebase-index.json
          exit 0
        fi
      fi
      exit 1`,
    ];

    try {
      const { stdout } = await dockerManager.execInContainer(
        workspace.containerId,
        checkIndexCmd
      );

      if (stdout) {
        // Return cached index
        return Response.json(JSON.parse(stdout));
      }
    } catch (error) {
      // Index doesn't exist or is stale, generate new one
    }

    // Generate new index
    console.log(`🔍 Generating codebase index for workspace ${id}`);

    const indexCmd = ["sh", "/index-codebase.sh", "/workspace"];

    try {
      await dockerManager.execInContainer(workspace.containerId, indexCmd);

      // Read the generated index
      const readIndexCmd = ["cat", "/workspace/.kalpana/codebase-index.json"];
      const { stdout } = await dockerManager.execInContainer(
        workspace.containerId,
        readIndexCmd
      );

      const index = JSON.parse(stdout);
      console.log(
        `✅ Index generated: ${index.stats?.totalFiles || 0} files`
      );

      return Response.json(index);
    } catch (error: any) {
      console.error("Error generating index:", error);
      return Response.json(
        { error: "Failed to generate index", details: error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error fetching codebase index:", error);
    return new Response(error.message || "Failed to fetch index", {
      status: 500,
    });
  }
}

// POST endpoint to trigger manual re-indexing
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

    if (workspace.status !== "RUNNING" || !workspace.containerId) {
      return Response.json({ error: "Workspace not running" }, { status: 400 });
    }

    console.log(`🔄 Manually triggering index for workspace ${id}`);

    // Force regenerate index
    const indexCmd = ["sh", "/index-codebase.sh", "/workspace"];

    await dockerManager.execInContainer(workspace.containerId, indexCmd);

    // Read the generated index
    const readIndexCmd = ["cat", "/workspace/.kalpana/codebase-index.json"];
    const { stdout } = await dockerManager.execInContainer(
      workspace.containerId,
      readIndexCmd
    );

    const index = JSON.parse(stdout);
    console.log(`✅ Index regenerated: ${index.stats?.totalFiles || 0} files`);

    return Response.json(index);
  } catch (error: any) {
    console.error("Error regenerating index:", error);
    return new Response(error.message || "Failed to regenerate index", {
      status: 500,
    });
  }
}

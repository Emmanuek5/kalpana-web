import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { authorizeWorkspaceAccess } from "@/lib/workspace-auth";
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

    // First check if workspace belongs directly to user
    let workspace = await prisma.workspace.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    // If not found by direct ownership, check if it's a team workspace and user is a member
    if (!workspace) {
      // Find the workspace first
      const teamWorkspace = await prisma.workspace.findUnique({
        where: { id },
        include: { team: true },
      });

      if (!teamWorkspace || !teamWorkspace.teamId) {
        return new Response("Workspace not found", { status: 404 });
      }

      // Check if user is a member of the team
      const teamMembership = await prisma.teamMember.findFirst({
        where: {
          teamId: teamWorkspace.teamId,
          userId: session.user.id,
        },
      });

      if (!teamMembership) {
        return new Response("You are not authorized to access this workspace", { status: 403 });
      }
      
      workspace = teamWorkspace;
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

      if (stdout && stdout.trim()) {
        try {
          // Return cached index
          const cachedIndex = JSON.parse(stdout.trim());
          console.log(`📦 Using cached index: ${cachedIndex.stats?.totalFiles || 0} files`);
          return Response.json(cachedIndex);
        } catch (parseError) {
          console.log("Cached index is corrupted, regenerating...");
        }
      }
    } catch (error) {
      // Index doesn't exist or is stale, generate new one
    }

    // Generate new index
    console.log(`🔍 Generating codebase index for workspace ${id}`);

    const indexCmd = ["sh", "/index-codebase.sh", "/workspace"];

    try {
      const { stdout: indexOutput, stderr: indexError } = await dockerManager.execInContainer(
        workspace.containerId, 
        indexCmd
      );
      
      // Log any output from the indexing script
      if (indexOutput) console.log("Index script output:", indexOutput);
      if (indexError) console.log("Index script stderr:", indexError);

      // Read the generated index file
      const readIndexCmd = ["cat", "/workspace/.kalpana/codebase-index.json"];
      const { stdout, stderr } = await dockerManager.execInContainer(
        workspace.containerId,
        readIndexCmd
      );

      if (!stdout || stdout.trim() === "") {
        console.error("Index file is empty or missing, returning empty index");
        return Response.json({
          lastUpdated: new Date().toISOString(),
          files: [],
          symbols: { functions: [], classes: [], exports: [] },
          stats: { totalFiles: 0, totalLines: 0 }
        });
      }

      let index;
      try {
        index = JSON.parse(stdout.trim());
      } catch (parseError: any) {
        console.error("Failed to parse index JSON:", parseError.message);
        console.error("Raw stdout:", stdout.substring(0, 500));
        return Response.json({
          lastUpdated: new Date().toISOString(),
          files: [],
          symbols: { functions: [], classes: [], exports: [] },
          stats: { totalFiles: 0, totalLines: 0 }
        });
      }

      console.log(
        `✅ Index generated: ${index.stats?.totalFiles || 0} files, ${index.stats?.totalFunctions || 0} functions`
      );

      return Response.json(index);
    } catch (error: any) {
      console.error("Error generating index:", error);
      return Response.json({
        lastUpdated: new Date().toISOString(),
        files: [],
        symbols: { functions: [], classes: [], exports: [] },
        stats: { totalFiles: 0, totalLines: 0 }
      });
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

    // First check if workspace belongs directly to user
    let workspace = await prisma.workspace.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    // If not found by direct ownership, check if it's a team workspace and user is a member
    if (!workspace) {
      // Find the workspace first
      const teamWorkspace = await prisma.workspace.findUnique({
        where: { id },
        include: { team: true },
      });

      if (!teamWorkspace || !teamWorkspace.teamId) {
        return new Response("Workspace not found", { status: 404 });
      }

      // Check if user is a member of the team
      const teamMembership = await prisma.teamMember.findFirst({
        where: {
          teamId: teamWorkspace.teamId,
          userId: session.user.id,
        },
      });

      if (!teamMembership) {
        return new Response("You are not authorized to access this workspace", { status: 403 });
      }
      
      workspace = teamWorkspace;
    }

    if (workspace.status !== "RUNNING" || !workspace.containerId) {
      return Response.json({ error: "Workspace not running" }, { status: 400 });
    }

    console.log(`🔄 Manually triggering index for workspace ${id}`);

    // Force regenerate index
    const indexCmd = ["sh", "/index-codebase.sh", "/workspace"];

    const { stdout: indexOutput, stderr: indexError } = await dockerManager.execInContainer(
      workspace.containerId, 
      indexCmd
    );
    
    // Log any output from the indexing script
    if (indexOutput) console.log("Index script output:", indexOutput);
    if (indexError) console.log("Index script stderr:", indexError);

    // Read the generated index
    const readIndexCmd = ["cat", "/workspace/.kalpana/codebase-index.json"];
    const { stdout } = await dockerManager.execInContainer(
      workspace.containerId,
      readIndexCmd
    );

    if (!stdout || stdout.trim() === "") {
      console.error("Index file is empty or missing");
      return Response.json(
        { error: "Index file is empty or was not generated" },
        { status: 500 }
      );
    }

    const index = JSON.parse(stdout.trim());
    console.log(`✅ Index regenerated: ${index.stats?.totalFiles || 0} files, ${index.stats?.totalFunctions || 0} functions`);

    return Response.json(index);
  } catch (error: any) {
    console.error("Error regenerating index:", error);
    return Response.json(
      { error: "Failed to regenerate index", details: error.message },
      { status: 500 }
    );
  }
}

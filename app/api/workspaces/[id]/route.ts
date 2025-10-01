import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dockerManager } from "@/lib/docker/manager";
import { NextRequest, NextResponse } from "next/server";

// GET /api/workspaces/[id] - Get single workspace
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Update last accessed
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { lastAccessedAt: new Date() },
    });

    return NextResponse.json(workspace);
  } catch (error) {
    console.error("Error fetching workspace:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/[id] - Delete workspace
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Check if user wants to delete volume (permanent data deletion)
    const url = new URL(req.url);
    const deleteVolume = url.searchParams.get("deleteVolume") === "true";

    // Stop and remove container if it exists
    if (workspace.containerId) {
      try {
        console.log(`🗑️  Stopping and removing container for workspace ${id}`);
        
        // Use destroyWorkspace to clean up container and optionally volume
        await dockerManager.destroyWorkspace(id, deleteVolume);
        
        if (deleteVolume) {
          console.log(`✅ Container and volume removed for workspace ${id}`);
        } else {
          console.log(`✅ Container removed for workspace ${id} (volume preserved)`);
        }
      } catch (error) {
        console.error(`Error removing container for workspace ${id}:`, error);
        // Continue with database deletion even if container removal fails
      }
    }

    await prisma.workspace.delete({
      where: { id: workspace.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting workspace:", error);
    return NextResponse.json(
      { error: "Failed to delete workspace" },
      { status: 500 }
    );
  }
}

// PATCH /api/workspaces/[id] - Update workspace
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, description, githubRepo, template, nixConfig } = body;

    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(githubRepo !== undefined && { githubRepo }),
        ...(template !== undefined && { template }),
        ...(nixConfig !== undefined && { nixConfig }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating workspace:", error);
    return NextResponse.json(
      { error: "Failed to update workspace" },
      { status: 500 }
    );
  }
}

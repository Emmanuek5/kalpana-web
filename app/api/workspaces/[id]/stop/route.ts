import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dockerManager } from "@/lib/docker/manager";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
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

    if (workspace.status === "STOPPED") {
      return NextResponse.json(
        { error: "Workspace is already stopped" },
        { status: 400 }
      );
    }

    // Stop the workspace container
    await dockerManager.stopWorkspace(workspace.id);

    const updated = await prisma.workspace.findUnique({
      where: { id: workspace.id },
    });

    return NextResponse.json({
      success: true,
      workspace: updated,
    });
  } catch (error) {
    console.error("Error stopping workspace:", error);
    return NextResponse.json(
      { error: "Failed to stop workspace" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    if (workspace.status !== "RUNNING") {
      return NextResponse.json(
        { error: "Workspace must be running to restart" },
        { status: 400 }
      );
    }

    // Restart workspace (re-runs start.sh)
    await dockerManager.restartWorkspace(id);

    return NextResponse.json({
      success: true,
      message: "Workspace restarted successfully",
    });
  } catch (error: any) {
    console.error("Error restarting workspace:", error);
    return NextResponse.json(
      { error: error.message || "Failed to restart workspace" },
      { status: 500 }
    );
  }
}

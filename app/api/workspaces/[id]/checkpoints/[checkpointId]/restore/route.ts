import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkpointService } from "@/lib/checkpoint-service";

// POST /api/workspaces/:id/checkpoints/:checkpointId/restore - Restore a checkpoint
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; checkpointId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId, checkpointId } = await context.params;

    // Restore checkpoint
    await checkpointService.restoreCheckpoint(workspaceId, checkpointId);

    return NextResponse.json({
      success: true,
      message: "Checkpoint restored successfully",
      checkpointId,
    });
  } catch (error: any) {
    console.error("Error restoring checkpoint:", error);
    return NextResponse.json(
      { error: error.message || "Failed to restore checkpoint" },
      { status: 500 }
    );
  }
}

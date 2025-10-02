import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkpointService } from "@/lib/checkpoint-service";

// POST /api/workspaces/:id/checkpoints - Create a checkpoint
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId } = await context.params;
    const body = await request.json();
    const { messageId, previewText } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: "messageId is required" },
        { status: 400 }
      );
    }

    // Create checkpoint
    const checkpoint = await checkpointService.createCheckpoint(
      workspaceId,
      messageId,
      previewText
    );

    return NextResponse.json({
      success: true,
      checkpoint,
    });
  } catch (error: any) {
    console.error("Error creating checkpoint:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkpoint" },
      { status: 500 }
    );
  }
}

// GET /api/workspaces/:id/checkpoints - List all checkpoints
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId } = await context.params;

    // List checkpoints
    const checkpoints = await checkpointService.listCheckpoints(workspaceId);

    return NextResponse.json({
      checkpoints,
      count: checkpoints.length,
    });
  } catch (error: any) {
    console.error("Error listing checkpoints:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list checkpoints" },
      { status: 500 }
    );
  }
}

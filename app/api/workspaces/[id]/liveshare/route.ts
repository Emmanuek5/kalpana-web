import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authorizeWorkspaceAccess } from "@/lib/workspace-auth";
import { prisma } from "@/lib/db";

// POST - Start Live Share session
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  const { id } = await params;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check workspace access (owner or team member)
  const workspace = await prisma.workspace.findFirst({
    where: {
      id,
      OR: [
        { userId: session.user.id },
        {
          team: {
            members: {
              some: { userId: session.user.id },
            },
          },
        },
      ],
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (!workspace.agentPort) {
    return NextResponse.json(
      { error: "Workspace not running" },
      { status: 400 }
    );
  }

  try {
    // Send command to agent bridge, which will relay to VSCode extension via WebSocket
    const response = await fetch(
      `http://localhost:${workspace.agentPort}/command`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `liveshare-start-${Date.now()}`,
          type: "startLiveShare",
          payload: {},
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        errorData.error || "Failed to communicate with workspace"
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to start Live Share");
    }

    return NextResponse.json({
      success: true,
      shareLink:
        data.data?.shareLink || "https://vscode.dev/liveshare/join/session-id",
    });
  } catch (error: any) {
    console.error("Error starting Live Share:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start Live Share" },
      { status: 500 }
    );
  }
}

// DELETE - End Live Share session
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  const { id } = await params;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      id,
      OR: [
        { userId: session.user.id },
        {
          team: {
            members: {
              some: { userId: session.user.id },
            },
          },
        },
      ],
    },
  });

  if (!workspace || !workspace.agentPort) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    await fetch(`http://localhost:${workspace.agentPort}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: `liveshare-end-${Date.now()}`,
        type: "endLiveShare",
        payload: {},
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error ending Live Share:", error);
    return NextResponse.json(
      { error: error.message || "Failed to end Live Share" },
      { status: 500 }
    );
  }
}

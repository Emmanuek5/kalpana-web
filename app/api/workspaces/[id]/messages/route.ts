import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/workspaces/:id/messages - Get all messages for a workspace
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify workspace belongs to user
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

    // Get all messages for this workspace
    const messages = await prisma.message.findMany({
      where: {
        workspaceId: id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Parse JSON content for each message
    const parsedMessages = messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      parts: JSON.parse(msg.content),
      createdAt: msg.createdAt,
    }));

    return NextResponse.json({ messages: parsedMessages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/workspaces/:id/messages - Save a message
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify workspace belongs to user
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

    const body = await request.json();
    const { role, parts } = body;

    if (!role || !parts) {
      return NextResponse.json(
        { error: "Role and parts are required" },
        { status: 400 }
      );
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        workspaceId: id,
        role,
        content: JSON.stringify(parts),
      },
    });

    return NextResponse.json({
      message: {
        id: message.id,
        role: message.role,
        parts: JSON.parse(message.content),
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    console.error("Error saving message:", error);
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/:id/messages - Clear all messages for a workspace
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify workspace belongs to user
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

    // Delete all messages for this workspace
    await prisma.message.deleteMany({
      where: {
        workspaceId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing messages:", error);
    return NextResponse.json(
      { error: "Failed to clear messages" },
      { status: 500 }
    );
  }
}

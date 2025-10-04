import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authorizeWorkspaceAccess } from "@/lib/workspace-auth";
import { prisma } from "@/lib/db";

// GET /api/workspaces/:id/messages - Get all messages for a chat
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
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required" },
        { status: 400 }
      );
    }

    // Verify chat belongs to user's workspace
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        workspaceId,
        workspace: {
          userId: session.user.id,
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Get all messages for this chat
    const messages = await prisma.message.findMany({
      where: {
        chatId,
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

    const { id: workspaceId } = await context.params;
    const body = await request.json();
    const { chatId, role, parts } = body;

    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required" },
        { status: 400 }
      );
    }

    if (!role || !parts) {
      return NextResponse.json(
        { error: "Role and parts are required" },
        { status: 400 }
      );
    }

    // Verify chat belongs to user's workspace
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        workspaceId,
        workspace: {
          userId: session.user.id,
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        chatId,
        role,
        content: JSON.stringify(parts),
      },
    });

    // Update chat's lastMessageAt
    await prisma.chat.update({
      where: { id: chatId },
      data: { lastMessageAt: new Date() },
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
    // Verify user has access to this workspace
    const workspace = await authorizeWorkspaceAccess(workspaceId, session.user.id);
    if (!workspace) {
      return NextResponse.json(
        { error: "You are not authorized to access this workspace" },
        { status: 403 }
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

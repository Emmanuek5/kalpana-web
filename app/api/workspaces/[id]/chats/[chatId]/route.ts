import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/workspaces/:id/chats/:chatId - Get a specific chat
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; chatId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId, chatId } = await context.params;

    // Get chat with messages
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        workspaceId,
        workspace: {
          userId: session.user.id,
        },
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Parse message content
    const parsedMessages = chat.messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      parts: JSON.parse(msg.content),
      createdAt: msg.createdAt,
    }));

    return NextResponse.json({
      chat: {
        id: chat.id,
        title: chat.title,
        description: chat.description,
        isPinned: chat.isPinned,
        messages: parsedMessages,
        createdAt: chat.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching chat:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat" },
      { status: 500 }
    );
  }
}

// PATCH /api/workspaces/:id/chats/:chatId - Update chat
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; chatId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId, chatId } = await context.params;
    const body = await request.json();
    const { title, description, isPinned } = body;

    // Verify chat belongs to user
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

    // Update chat
    const updatedChat = await prisma.chat.update({
      where: { id: chatId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(isPinned !== undefined && { isPinned }),
      },
    });

    return NextResponse.json({
      chat: {
        id: updatedChat.id,
        title: updatedChat.title,
        description: updatedChat.description,
        isPinned: updatedChat.isPinned,
      },
    });
  } catch (error) {
    console.error("Error updating chat:", error);
    return NextResponse.json(
      { error: "Failed to update chat" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/:id/chats/:chatId - Delete chat
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; chatId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId, chatId } = await context.params;

    // Verify chat belongs to user
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

    // Delete chat (messages will cascade delete)
    await prisma.chat.delete({
      where: { id: chatId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 }
    );
  }
}

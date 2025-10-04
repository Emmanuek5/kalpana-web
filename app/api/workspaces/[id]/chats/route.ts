import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authorizeWorkspaceAccess } from "@/lib/workspace-auth";
import { prisma } from "@/lib/db";

// GET /api/workspaces/:id/chats - Get all chats for a workspace
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

    // First check if workspace belongs directly to user
    let workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId: session.user.id,
      },
    });

    // If not found by direct ownership, check if it's a team workspace and user is a member
    if (!workspace) {
      // Find the workspace first
      const teamWorkspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { team: true },
      });

      if (!teamWorkspace || !teamWorkspace.teamId) {
        return NextResponse.json(
          { error: "Workspace not found" },
          { status: 404 }
        );
      }

      // Check if user is a member of the team
      const teamMembership = await prisma.teamMember.findFirst({
        where: {
          teamId: teamWorkspace.teamId,
          userId: session.user.id,
        },
      });

      if (!teamMembership) {
        return NextResponse.json(
          { error: "You are not authorized to access this workspace" },
          { status: 403 }
        );
      }
      
      workspace = teamWorkspace;
    }

    // Get all chats for this workspace
    const chats = await prisma.chat.findMany({
      where: {
        workspaceId,
      },
      include: {
        messages: {
          select: {
            id: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: [
        { isPinned: "desc" },
        { lastMessageAt: "desc" },
      ],
    });

    const chatsWithCount = chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      description: chat.description,
      isPinned: chat.isPinned,
      messageCount: chat.messages.length,
      lastMessageAt: chat.lastMessageAt,
      createdAt: chat.createdAt,
    }));

    return NextResponse.json({ chats: chatsWithCount });
  } catch (error) {
    console.error("Error fetching chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}

// POST /api/workspaces/:id/chats - Create a new chat
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

    // First check if workspace belongs directly to user
    let workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId: session.user.id,
      },
    });

    // If not found by direct ownership, check if it's a team workspace and user is a member
    if (!workspace) {
      // Find the workspace first
      const teamWorkspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { team: true },
      });

      if (!teamWorkspace || !teamWorkspace.teamId) {
        return NextResponse.json(
          { error: "Workspace not found" },
          { status: 404 }
        );
      }

      // Check if user is a member of the team
      const teamMembership = await prisma.teamMember.findFirst({
        where: {
          teamId: teamWorkspace.teamId,
          userId: session.user.id,
        },
      });

      if (!teamMembership) {
        return NextResponse.json(
          { error: "You are not authorized to access this workspace" },
          { status: 403 }
        );
      }
      
      workspace = teamWorkspace;
    }

    const body = await request.json();
    const { title, description } = body;

    // Create new chat
    const chat = await prisma.chat.create({
      data: {
        workspaceId,
        title: title || "New Chat",
        description,
      },
    });

    return NextResponse.json({
      chat: {
        id: chat.id,
        title: chat.title,
        description: chat.description,
        isPinned: chat.isPinned,
        messageCount: 0,
        lastMessageAt: chat.lastMessageAt,
        createdAt: chat.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating chat:", error);
    return NextResponse.json(
      { error: "Failed to create chat" },
      { status: 500 }
    );
  }
}

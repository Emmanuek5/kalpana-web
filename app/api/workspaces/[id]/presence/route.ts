import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authorizeWorkspaceAccess } from "@/lib/workspace-auth";
import { prisma } from "@/lib/db";
import { getPresenceManager, getUserColor } from "@/lib/presence-manager";

// Per-workspace presence managers
// Format: Map<workspaceId, PresenceManager>
const workspacePresenceManagers = new Map<
  string,
  ReturnType<typeof getPresenceManager>
>();

// Get or create presence manager for workspace
function getWorkspacePresenceManager(workspaceId: string) {
  if (!workspacePresenceManagers.has(workspaceId)) {
    workspacePresenceManagers.set(workspaceId, getPresenceManager());
  }
  return workspacePresenceManagers.get(workspaceId)!;
}

// Cleanup empty workspace managers every 5 minutes
setInterval(() => {
  for (const [workspaceId, manager] of workspacePresenceManagers.entries()) {
    if (manager.getUserCount() === 0) {
      manager.destroy();
      workspacePresenceManagers.delete(workspaceId);
    }
  }
}, 300000);

// POST - Register presence (heartbeat)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  const { id } = await params;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check workspace access
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
    include: {
      team: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Get or create presence manager for this workspace
  const presenceManager = getWorkspacePresenceManager(id);

  // Update user presence
  presenceManager.updateUser({
    userId: session.user.id,
    userName: session.user.name || "Anonymous",
    userEmail: session.user.email,
    role: presenceManager.getUserCount() === 0 ? "host" : "guest",
    color: getUserColor(session.user.id),
    joinedAt: Date.now(),
  });

  // Get all active users
  const activeUsers = presenceManager.getUsers();

  // Check if Live Share should be auto-enabled
  // Enable if: workspace has a team AND multiple team members are viewing
  const shouldEnableLiveShare =
    workspace.teamId &&
    activeUsers.length >= 2 &&
    activeUsers.every((user) =>
      workspace.team?.members.some((m) => m.userId === user.userId)
    );

  // Determine current user's role
  const currentUserRole = presenceManager.isHost(session.user.id)
    ? "host"
    : "guest";

  return NextResponse.json({
    success: true,
    activeUsers: activeUsers.map((u) => ({
      id: u.userId,
      name: u.userName,
      email: u.userEmail,
      role: u.role,
      color: u.color,
      isYou: u.userId === session.user.id,
    })),
    count: activeUsers.length,
    shouldEnableLiveShare,
    isTeamWorkspace: !!workspace.teamId,
    yourRole: currentUserRole,
  });
}

// DELETE - Remove presence
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  const { id } = await params;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Remove user from presence
  const presenceManager = getWorkspacePresenceManager(id);
  presenceManager.removeUser(session.user.id);

  return NextResponse.json({ success: true });
}

// GET - Get active viewers
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  const { id } = await params;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const presenceManager = getWorkspacePresenceManager(id);
  const activeUsers = presenceManager.getUsers();

  return NextResponse.json({
    activeUsers: activeUsers.map((u) => ({
      id: u.userId,
      name: u.userName,
      email: u.userEmail,
      role: u.role,
      color: u.color,
    })),
    count: activeUsers.length,
  });
}

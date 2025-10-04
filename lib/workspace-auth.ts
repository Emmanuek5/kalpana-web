import { prisma } from "@/lib/db";


/**
 * Helper function to check if a user has access to a workspace
 * This checks both direct ownership and team membership
 * 
 * @param workspaceId The ID of the workspace to check
 * @param userId The ID of the user to check
 * @returns The workspace object if the user has access, null otherwise
 */
export async function authorizeWorkspaceAccess(workspaceId: string, userId: string) {
  // First check if workspace belongs directly to user
  let workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      userId,
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
      return null;
    }

    // Check if user is a member of the team
    const teamMembership = await prisma.teamMember.findFirst({
      where: {
        teamId: teamWorkspace.teamId,
        userId,
      },
    });

    if (!teamMembership) {
      return null;
    }
    
    workspace = teamWorkspace;
  }

  return workspace;
}

/**
 * Helper function to check if a user has admin access to a workspace
 * This checks both direct ownership and team admin/owner membership
 * 
 * @param workspaceId The ID of the workspace to check
 * @param userId The ID of the user to check
 * @returns The workspace object if the user has admin access, null otherwise
 */
export async function authorizeWorkspaceAdminAccess(workspaceId: string, userId: string) {
  // First check if workspace belongs directly to user
  let workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      userId,
    },
  });

  // If not found by direct ownership, check if it's a team workspace and user is an admin/owner
  if (!workspace) {
    // Find the workspace first
    const teamWorkspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { team: true },
    });

    if (!teamWorkspace || !teamWorkspace.teamId) {
      return null;
    }

    // Check if user is an admin or owner of the team
    const teamMembership = await prisma.teamMember.findFirst({
      where: {
        teamId: teamWorkspace.teamId,
        userId,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!teamMembership) {
      return null;
    }
    
    workspace = teamWorkspace;
  }

  return workspace;
}

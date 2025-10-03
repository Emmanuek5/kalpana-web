import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/workspaces - Get all workspaces for current user or team
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamId = req.nextUrl.searchParams.get("teamId");

    let workspaces;

    if (teamId) {
      // Check if user is a team member
      const member = await prisma.teamMember.findFirst({
        where: { teamId, userId: session.user.id },
      });

      if (!member) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Fetch team workspaces
      workspaces = await prisma.workspace.findMany({
        where: { teamId },
        orderBy: { lastAccessedAt: "desc" },
      });
    } else {
      // Fetch personal workspaces (no teamId filter - just userId)
      workspaces = await prisma.workspace.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: { lastAccessedAt: "desc" },
      });
      
      // Filter out team workspaces on the client side
      workspaces = workspaces.filter((w: any) => !w.teamId);
    }

    return NextResponse.json(workspaces);
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}

// POST /api/workspaces - Create new workspace
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, githubRepo, template, nixConfig, preset, teamId, githubSource } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Workspace name is required" },
        { status: 400 }
      );
    }

    // Check workspace limit
    const workspaceCount = await prisma.workspace.count({
      where: { userId: session.user.id },
    });

    const maxWorkspaces = parseInt(process.env.MAX_WORKSPACES_PER_USER || "5");

    if (workspaceCount >= maxWorkspaces) {
      return NextResponse.json(
        { error: `Maximum ${maxWorkspaces} workspaces allowed` },
        { status: 403 }
      );
    }

    // If teamId provided, verify user is a member
    if (teamId) {
      const member = await prisma.teamMember.findFirst({
        where: { teamId, userId: session.user.id },
      });

      if (!member) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
        description,
        githubRepo,
        githubSource: githubSource || "personal",
        template,
        nixConfig,
        preset: preset || "default",
        userId: session.user.id,
        teamId: teamId || undefined,
        status: "STOPPED",
      },
    });

    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    console.error("Error creating workspace:", error);
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    );
  }
}

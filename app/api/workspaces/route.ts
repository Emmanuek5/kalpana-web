import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/workspaces - Get all workspaces for current user
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaces = await prisma.workspace.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        lastAccessedAt: "desc",
      },
    });

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
    const { name, description, githubRepo, template, nixConfig, preset } = body;

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

    const workspace = await prisma.workspace.create({
      data: {
        name,
        description,
        githubRepo,
        template,
        nixConfig,
        preset: preset || "default",
        userId: session.user.id,
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

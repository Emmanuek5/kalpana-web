import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { DatabaseManager } from "@/lib/docker/database-manager";
import { prisma } from "@/lib/db";

const dbManager = new DatabaseManager();

// GET /api/workspaces/[id]/databases - List workspace databases
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: workspaceId } = await params;
    
    // Verify workspace ownership
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    const databases = await dbManager.listWorkspaceDatabases(workspaceId);
    return NextResponse.json({ databases });
  } catch (error: any) {
    console.error("Error listing workspace databases:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list databases" },
      { status: 500 }
    );
  }
}

// POST /api/workspaces/[id]/databases - Create workspace-linked database
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: workspaceId } = await params;
    
    // Verify workspace ownership
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
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
    const {
      name,
      type,
      domainId,
      subdomain,
      username,
      password,
      database,
      version,
    } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    // Validate database type
    const validTypes = ["POSTGRES", "MYSQL", "MONGODB", "REDIS", "SQLITE"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid database type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify domain ownership if domainId is provided
    if (domainId) {
      const domain = await prisma.domain.findFirst({
        where: {
          id: domainId,
          userId: session.user.id,
        },
      });

      if (!domain) {
        return NextResponse.json(
          { error: "Domain not found or you don't have access" },
          { status: 404 }
        );
      }

      if (!domain.verified) {
        return NextResponse.json(
          { error: "Domain must be verified before linking to a database" },
          { status: 400 }
        );
      }
    }

    // Create workspace-linked database
    const databaseInfo = await dbManager.createDatabase({
      name,
      type,
      userId: session.user.id,
      workspaceId, // Link to workspace
      teamId: workspace.teamId || undefined,
      domainId,
      subdomain,
      username,
      password,
      database,
      version,
    });

    return NextResponse.json({ database: databaseInfo }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating workspace database:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create database" },
      { status: 500 }
    );
  }
}

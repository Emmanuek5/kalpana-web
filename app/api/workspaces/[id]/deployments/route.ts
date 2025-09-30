import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { deploymentManager } from "@/lib/docker/deployment-manager";

// GET /api/workspaces/:id/deployments - List deployments
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

  // Get all deployments for this workspace
  const deployments = await prisma.deployment.findMany({
    where: { workspaceId },
    include: {
      builds: {
        orderBy: { createdAt: "desc" },
        take: 1, // Get latest build
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ deployments });
}

// POST /api/workspaces/:id/deployments - Create deployment
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

  try {
    const body = await request.json();
    const {
      name,
      description,
      buildCommand,
      startCommand,
      workingDir,
      port,
      envVars,
      subdomain,
      autoRebuild,
    } = body;

    // Validate required fields
    if (!name || !startCommand || !port) {
      return NextResponse.json(
        { error: "Missing required fields: name, startCommand, port" },
        { status: 400 }
      );
    }

    // Create deployment
    const deploymentId = await deploymentManager.createDeployment(workspaceId, {
      name,
      description,
      buildCommand,
      startCommand,
      workingDir,
      port: parseInt(port),
      envVars,
      subdomain,
      autoRebuild: autoRebuild || false,
    });

    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    return NextResponse.json({ deployment }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating deployment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create deployment" },
      { status: 500 }
    );
  }
}
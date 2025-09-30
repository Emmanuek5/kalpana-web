import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { deploymentManager } from "@/lib/docker/deployment-manager";

// GET /api/deployments/:id - Get deployment details
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

  const { id: deploymentId } = await params;

  const deployment = await prisma.deployment.findFirst({
    where: {
      id: deploymentId,
      workspace: {
        userId: session.user.id,
      },
    },
    include: {
      workspace: true,
      builds: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!deployment) {
    return NextResponse.json(
      { error: "Deployment not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ deployment });
}

// DELETE /api/deployments/:id - Delete deployment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: deploymentId } = await params;

  // Verify ownership
  const deployment = await prisma.deployment.findFirst({
    where: {
      id: deploymentId,
      workspace: {
        userId: session.user.id,
      },
    },
  });

  if (!deployment) {
    return NextResponse.json(
      { error: "Deployment not found" },
      { status: 404 }
    );
  }

  try {
    await deploymentManager.deleteDeployment(deploymentId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting deployment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete deployment" },
      { status: 500 }
    );
  }
}

// PATCH /api/deployments/:id - Update deployment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: deploymentId } = await params;

  // Verify ownership
  const deployment = await prisma.deployment.findFirst({
    where: {
      id: deploymentId,
      workspace: {
        userId: session.user.id,
      },
    },
  });

  if (!deployment) {
    return NextResponse.json(
      { error: "Deployment not found" },
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

    const updated = await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(buildCommand !== undefined && { buildCommand }),
        ...(startCommand && { startCommand }),
        ...(workingDir !== undefined && { workingDir }),
        ...(port && { port: parseInt(port) }),
        ...(envVars && { envVars: JSON.stringify(envVars) }),
        ...(subdomain !== undefined && { subdomain }),
        ...(autoRebuild !== undefined && { autoRebuild }),
      },
    });

    return NextResponse.json({ deployment: updated });
  } catch (error: any) {
    console.error("Error updating deployment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update deployment" },
      { status: 500 }
    );
  }
}
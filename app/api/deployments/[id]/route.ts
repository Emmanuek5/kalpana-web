import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { deploymentManager } from "@/lib/docker/deployment-manager";
import { encryptEnvVars, decryptEnvVars } from "@/lib/crypto";

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
      userId: session.user.id, // Direct ownership check for both standalone and workspace deployments
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      domain: true,
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

  // Decrypt environment variables before sending to client
  const decryptedDeployment = {
    ...deployment,
    envVars: deployment.envVars
      ? JSON.stringify(decryptEnvVars(deployment.envVars))
      : null,
  };

  return NextResponse.json({ deployment: decryptedDeployment });
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
      userId: session.user.id, // Direct ownership check
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
      userId: session.user.id, // Direct ownership check
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
      installCommand,
      workingDir,
      port,
      envVars,
      subdomain,
      domainId,
      autoRebuild,
    } = body;

    const updated = await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(buildCommand !== undefined && { buildCommand }),
        ...(startCommand && { startCommand }),
        ...(installCommand !== undefined && { installCommand }),
        ...(workingDir !== undefined && { workingDir }),
        ...(port && { port: parseInt(port) }),
        ...(envVars !== undefined && {
          envVars: envVars ? encryptEnvVars(JSON.parse(envVars)) : null,
        }),
        ...(subdomain !== undefined && { subdomain }),
        ...(domainId !== undefined && { domainId }),
        ...(autoRebuild !== undefined && { autoRebuild }),
      },
      include: {
        domain: true,
        workspace: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    // Decrypt environment variables before sending to client
    const decryptedUpdated = {
      ...updated,
      envVars: updated.envVars
        ? JSON.stringify(decryptEnvVars(updated.envVars))
        : null,
    };

    return NextResponse.json({ deployment: decryptedUpdated });
  } catch (error: any) {
    console.error("Error updating deployment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update deployment" },
      { status: 500 }
    );
  }
}

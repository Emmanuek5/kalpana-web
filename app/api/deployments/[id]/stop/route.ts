import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { deploymentManager } from "@/lib/docker/deployment-manager";

// POST /api/deployments/:id/stop - Stop deployment
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
    await deploymentManager.stopDeployment(deploymentId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error stopping deployment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to stop deployment" },
      { status: 500 }
    );
  }
}
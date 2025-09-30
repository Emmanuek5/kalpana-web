import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { deploymentManager } from "@/lib/docker/deployment-manager";

// GET /api/deployments/:id/logs - Get deployment logs
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
    const { searchParams } = new URL(request.url);
    const tail = parseInt(searchParams.get("tail") || "100");

    const logs = await deploymentManager.getDeploymentLogs(deploymentId, tail);
    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("Error getting deployment logs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get logs" },
      { status: 500 }
    );
  }
}
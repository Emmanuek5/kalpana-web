import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { deploymentManager } from "@/lib/docker/deployment-manager";

// POST /api/deployments/:id/builds/:buildId/stop - Stop a running build
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; buildId: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: deploymentId, buildId } = await params;

  // Verify ownership
  const deployment = await prisma.deployment.findFirst({
    where: {
      id: deploymentId,
      userId: session.user.id,
    },
  });

  if (!deployment) {
    return NextResponse.json(
      { error: "Deployment not found" },
      { status: 404 }
    );
  }

  // Check if build exists and is running
  const build = await prisma.build.findFirst({
    where: {
      id: buildId,
      deploymentId,
    },
  });

  if (!build) {
    return NextResponse.json({ error: "Build not found" }, { status: 404 });
  }

  if (build.status !== "BUILDING") {
    return NextResponse.json(
      { error: "Build is not running" },
      { status: 400 }
    );
  }

  try {
    await deploymentManager.stopBuild(deploymentId, buildId);

    return NextResponse.json({
      message: "Build stopped successfully",
    });
  } catch (error: any) {
    console.error("Error stopping build:", error);
    return NextResponse.json(
      { error: error.message || "Failed to stop build" },
      { status: 500 }
    );
  }
}

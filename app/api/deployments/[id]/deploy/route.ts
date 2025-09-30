import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { deploymentManager } from "@/lib/docker/deployment-manager";

// POST /api/deployments/:id/deploy - Deploy application (build + start)
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

  // Use Server-Sent Events for streaming logs
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: string, data: any) => {
        const message = `data: ${JSON.stringify({ type, ...data })}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      try {
        sendEvent("status", { message: "Starting deployment..." });

        await deploymentManager.deployApplication(
          deploymentId,
          "manual",
          (log) => {
            sendEvent("log", { message: log });
          }
        );

        sendEvent("complete", { message: "Deployment completed successfully" });
      } catch (error: any) {
        sendEvent("error", { message: error.message });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
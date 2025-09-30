import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deploymentManager } from "@/lib/docker/deployment-manager";
import crypto from "crypto";

// POST /api/deployments/:id/webhook - GitHub webhook handler
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deploymentId } = await params;

  try {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { workspace: true },
    });

    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    if (!deployment.autoRebuild) {
      return NextResponse.json(
        { error: "Auto-rebuild not enabled" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const signature = request.headers.get("x-hub-signature-256");
    const body = await request.text();

    if (deployment.webhookSecret && signature) {
      const hmac = crypto.createHmac("sha256", deployment.webhookSecret);
      hmac.update(body);
      const calculatedSignature = `sha256=${hmac.digest("hex")}`;

      if (signature !== calculatedSignature) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(body);

    // Handle push event
    if (payload.ref && payload.commits) {
      const branch = payload.ref.replace("refs/heads/", "");
      const commitHash = payload.after;
      const commitMessage = payload.commits[0]?.message || "Webhook rebuild";

      // Check if this is the branch we're watching
      if (
        deployment.workspace.githubBranch &&
        branch !== deployment.workspace.githubBranch
      ) {
        return NextResponse.json({
          message: `Ignoring push to ${branch}, watching ${deployment.workspace.githubBranch}`,
        });
      }

      // Trigger rebuild asynchronously
      deploymentManager
        .deployApplication(deploymentId, "webhook", (log) => {
          console.log(`[Webhook Deploy ${deploymentId}]`, log);
        })
        .catch((error) => {
          console.error("Webhook deployment failed:", error);
        });

      // Update build record with commit info
      const latestBuild = await prisma.build.findFirst({
        where: { deploymentId },
        orderBy: { createdAt: "desc" },
      });

      if (latestBuild) {
        await prisma.build.update({
          where: { id: latestBuild.id },
          data: {
            commitHash,
            commitMessage,
            branch,
          },
        });
      }

      return NextResponse.json({
        message: "Deployment triggered",
        commitHash,
        branch,
      });
    }

    return NextResponse.json({ message: "Event ignored" });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}
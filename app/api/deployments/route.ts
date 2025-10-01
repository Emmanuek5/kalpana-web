import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { encryptEnvVars } from "@/lib/crypto";

// GET /api/deployments - List all user's deployments
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all deployments for this user (both standalone and workspace-based)
    const deployments = await prisma.deployment.findMany({
      where: {
        userId: session.user.id,
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
        builds: {
          orderBy: { createdAt: "desc" },
          take: 1, // Get latest build
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ deployments });
  } catch (error: any) {
    console.error("Error fetching deployments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch deployments" },
      { status: 500 }
    );
  }
}

// POST /api/deployments - Create standalone deployment
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      githubRepo,
      githubBranch,
      rootDirectory,
      buildCommand,
      startCommand,
      installCommand,
      workingDir,
      port,
      envVars,
      subdomain,
      domainId,
      autoRebuild,
      framework,
    } = body;

    // Validate required fields
    if (!name || !githubRepo || !startCommand || !port) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: name, githubRepo, startCommand, port",
        },
        { status: 400 }
      );
    }

    // If domainId is provided, verify it belongs to the user
    if (domainId) {
      const domain = await prisma.domain.findFirst({
        where: {
          id: domainId,
          userId: session.user.id,
          verified: true,
        },
      });

      if (!domain) {
        return NextResponse.json(
          { error: "Invalid or unverified domain" },
          { status: 400 }
        );
      }
    }

    // Generate webhook secret if auto-rebuild is enabled
    const webhookSecret = autoRebuild
      ? require("crypto").randomBytes(32).toString("hex")
      : null;

    // Create deployment with encrypted environment variables
    const deployment = await prisma.deployment.create({
      data: {
        name,
        description,
        githubRepo,
        githubBranch: githubBranch || "main",
        rootDirectory,
        buildCommand,
        startCommand,
        installCommand: installCommand || "npm install",
        workingDir: workingDir || "/app",
        port: parseInt(port),
        envVars: envVars ? encryptEnvVars(JSON.parse(envVars)) : undefined,
        subdomain,
        domainId,
        autoRebuild: autoRebuild || false,
        webhookSecret,
        framework,
        userId: session.user.id,
        status: "STOPPED",
      },
      include: {
        domain: true,
      },
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

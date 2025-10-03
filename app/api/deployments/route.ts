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
    const teamId = request.nextUrl.searchParams.get("teamId");

    let deployments;

    if (teamId) {
      // Check if user is a team member
      const member = await prisma.teamMember.findFirst({
        where: { teamId, userId: session.user.id },
      });

      if (!member) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Fetch team deployments
      deployments = await prisma.deployment.findMany({
        where: { teamId },
        include: {
          domain: true,
          workspace: {
            select: { id: true, name: true, status: true },
          },
          builds: {
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Fetch personal deployments
      deployments = await prisma.deployment.findMany({
        where: {
          userId: session.user.id,
        },
        include: {
          domain: true,
          workspace: {
            select: { id: true, name: true, status: true },
          },
          builds: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });
      
      // Filter out team deployments
      deployments = deployments.filter((d: any) => !d.teamId);
    }

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
      githubSource,
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
      teamId,
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

    // If teamId provided, verify user is a member
    if (teamId) {
      const member = await prisma.teamMember.findFirst({
        where: { teamId, userId: session.user.id },
      });

      if (!member) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Create deployment with encrypted environment variables
    const deployment = await prisma.deployment.create({
      data: {
        name,
        githubSource: githubSource || "personal",
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
        teamId: teamId || undefined,
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

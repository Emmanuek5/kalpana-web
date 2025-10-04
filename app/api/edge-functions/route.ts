import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { encryptEnvVars } from "@/lib/crypto";

// GET /api/edge-functions - List user's edge functions
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const functions = await prisma.edgeFunction.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        domain: {
          select: {
            id: true,
            domain: true,
            verified: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ functions });
  } catch (error: any) {
    console.error("Error listing edge functions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list edge functions" },
      { status: 500 }
    );
  }
}

// POST /api/edge-functions - Create a new edge function
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
      code,
      handler,
      runtime,
      envVars,
      timeout,
      memory,
      subdomain,
      path,
      domainId,
      triggerType,
      cronSchedule,
    } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Name and code are required" },
        { status: 400 }
      );
    }

    // Validate name (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        { error: "Function name can only contain letters, numbers, hyphens, and underscores" },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await prisma.edgeFunction.findFirst({
      where: {
        userId: session.user.id,
        name,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Function "${name}" already exists` },
        { status: 400 }
      );
    }

    // Verify domain if provided
    if (domainId) {
      const domain = await prisma.domain.findFirst({
        where: {
          id: domainId,
          userId: session.user.id,
        },
      });

      if (!domain) {
        return NextResponse.json(
          { error: "Domain not found or you don't have access" },
          { status: 404 }
        );
      }

      if (!domain.verified) {
        return NextResponse.json(
          { error: "Domain must be verified before linking" },
          { status: 400 }
        );
      }

      // Check for duplicate subdomain/path combination
      if (subdomain || path) {
        const existingRoute = await prisma.edgeFunction.findFirst({
          where: {
            domainId,
            subdomain: subdomain || null,
            path: path || null,
            id: { not: undefined },
          },
        });

        if (existingRoute) {
          return NextResponse.json(
            { error: `Route ${subdomain ? subdomain + "." : ""}${domain.domain}${path || "/"} is already in use` },
            { status: 400 }
          );
        }
      }
    }

    // Validate timeout
    const validTimeout = Math.min(Math.max(timeout || 10000, 1000), 30000);

    // Validate memory
    const validMemory = Math.min(Math.max(memory || 128, 64), 512);

    // Encrypt environment variables
    const encryptedEnvVars = envVars ? encryptEnvVars(envVars) : undefined;

    // Create edge function
    const func = await prisma.edgeFunction.create({
      data: {
        name,
        description,
        code,
        handler: handler || "handler",
        runtime: runtime || "JAVASCRIPT",
        envVars: encryptedEnvVars,
        timeout: validTimeout,
        memory: validMemory,
        subdomain,
        path,
        domainId: domainId || undefined,
        triggerType: triggerType || "HTTP",
        cronSchedule,
        userId: session.user.id,
        status: "ACTIVE",
        deployedAt: new Date(),
      },
      include: {
        domain: {
          select: {
            id: true,
            domain: true,
            verified: true,
          },
        },
      },
    });

    return NextResponse.json({ function: func }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating edge function:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create edge function" },
      { status: 500 }
    );
  }
}

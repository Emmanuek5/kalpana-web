import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { encryptEnvVars, decryptEnvVars } from "@/lib/crypto";

// GET /api/edge-functions/[id] - Get edge function details
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

  try {
    const { id } = await params;

    const func = await prisma.edgeFunction.findFirst({
      where: {
        id,
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
    });

    if (!func) {
      return NextResponse.json(
        { error: "Edge function not found" },
        { status: 404 }
      );
    }

    // Decrypt environment variables for display
    const envVars = func.envVars ? decryptEnvVars(func.envVars) : {};

    return NextResponse.json({
      function: {
        ...func,
        envVars, // Return decrypted env vars
      },
    });
  } catch (error: any) {
    console.error("Error getting edge function:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get edge function" },
      { status: 500 }
    );
  }
}

// PATCH /api/edge-functions/[id] - Update edge function
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

  try {
    const { id } = await params;

    // Verify ownership
    const func = await prisma.edgeFunction.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!func) {
      return NextResponse.json(
        { error: "Edge function not found" },
        { status: 404 }
      );
    }

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
      status,
    } = body;

    // Validate name if provided
    if (name && !/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        { error: "Function name can only contain letters, numbers, hyphens, and underscores" },
        { status: 400 }
      );
    }

    // Check for duplicate name if changing name
    if (name && name !== func.name) {
      const existing = await prisma.edgeFunction.findFirst({
        where: {
          userId: session.user.id,
          name,
          id: { not: id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: `Function "${name}" already exists` },
          { status: 400 }
        );
      }
    }

    // Verify domain if provided
    if (domainId !== undefined) {
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
        if (subdomain !== undefined || path !== undefined) {
          const checkSubdomain = subdomain !== undefined ? subdomain : func.subdomain;
          const checkPath = path !== undefined ? path : func.path;

          const existingRoute = await prisma.edgeFunction.findFirst({
            where: {
              domainId,
              subdomain: checkSubdomain || null,
              path: checkPath || null,
              id: { not: id },
            },
          });

          if (existingRoute) {
            return NextResponse.json(
              { error: `Route ${checkSubdomain ? checkSubdomain + "." : ""}${domain.domain}${checkPath || "/"} is already in use` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Validate timeout if provided
    const validTimeout = timeout ? Math.min(Math.max(timeout, 1000), 30000) : undefined;

    // Validate memory if provided
    const validMemory = memory ? Math.min(Math.max(memory, 64), 512) : undefined;

    // Encrypt environment variables if provided
    const encryptedEnvVars = envVars ? encryptEnvVars(envVars) : undefined;

    // Update edge function
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (code !== undefined) {
      updateData.code = code;
      updateData.deployedAt = new Date(); // Update deployment time when code changes
    }
    if (handler !== undefined) updateData.handler = handler;
    if (runtime !== undefined) updateData.runtime = runtime;
    if (encryptedEnvVars !== undefined) updateData.envVars = encryptedEnvVars;
    if (validTimeout !== undefined) updateData.timeout = validTimeout;
    if (validMemory !== undefined) updateData.memory = validMemory;
    if (subdomain !== undefined) updateData.subdomain = subdomain;
    if (path !== undefined) updateData.path = path;
    if (domainId !== undefined) updateData.domainId = domainId || undefined;
    if (triggerType !== undefined) updateData.triggerType = triggerType;
    if (cronSchedule !== undefined) updateData.cronSchedule = cronSchedule;
    if (status !== undefined) updateData.status = status;

    const updatedFunc = await prisma.edgeFunction.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({ function: updatedFunc });
  } catch (error: any) {
    console.error("Error updating edge function:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update edge function" },
      { status: 500 }
    );
  }
}

// DELETE /api/edge-functions/[id] - Delete edge function
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

  try {
    const { id } = await params;

    // Verify ownership
    const func = await prisma.edgeFunction.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!func) {
      return NextResponse.json(
        { error: "Edge function not found" },
        { status: 404 }
      );
    }

    // Delete edge function (invocations will be cascade deleted)
    await prisma.edgeFunction.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting edge function:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete edge function" },
      { status: 500 }
    );
  }
}

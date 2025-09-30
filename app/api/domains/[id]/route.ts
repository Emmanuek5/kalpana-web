import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

// DELETE /api/domains/:id - Delete domain
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

  const { id } = await params;

  // Verify ownership
  const domain = await prisma.domain.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      _count: {
        select: { deployments: true },
      },
    },
  });

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  if (domain._count.deployments > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete domain with ${domain._count.deployments} active deployment(s)`,
      },
      { status: 400 }
    );
  }

  await prisma.domain.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

// PATCH /api/domains/:id - Update domain
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

  const { id } = await params;

  // Verify ownership
  const domain = await prisma.domain.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
  });

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { setAsDefault, sslEnabled } = body;

    const updateData: any = {};

    if (setAsDefault !== undefined) {
      if (setAsDefault) {
        // Unset other defaults
        await prisma.domain.updateMany({
          where: {
            userId: session.user.id,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      }
      updateData.isDefault = setAsDefault;
    }

    if (sslEnabled !== undefined) {
      updateData.sslEnabled = sslEnabled;
    }

    const updated = await prisma.domain.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ domain: updated });
  } catch (error: any) {
    console.error("Error updating domain:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update domain" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

// GET /api/edge-functions/[id]/logs - Get function invocation logs
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
    const url = new URL(request.url);
    
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const status = url.searchParams.get("status"); // "success" or "error"

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

    // Build where clause
    const where: any = { functionId: id };
    if (status === "error") {
      where.error = { not: null };
    } else if (status === "success") {
      where.error = null;
    }

    // Get invocations
    const [invocations, total] = await Promise.all([
      prisma.functionInvocation.findMany({
        where,
        orderBy: { invokedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.functionInvocation.count({ where }),
    ]);

    return NextResponse.json({
      invocations,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Error getting function logs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get function logs" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * DEV ONLY: Verify domain without DNS check
 *
 * This endpoint bypasses DNS verification for local testing.
 * Only works in development mode.
 *
 * POST /api/domains/:id/verify-dev
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

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

  if (domain.verified) {
    return NextResponse.json(
      {
        domain,
        message: "Domain already verified",
      },
      { status: 200 }
    );
  }

  try {
    // Mark as verified without DNS check
    const updated = await prisma.domain.update({
      where: { id },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });

    console.log(
      `✅ [DEV] Domain verified without DNS check: ${updated.domain}`
    );

    return NextResponse.json({
      domain: updated,
      message: `Domain verified (dev mode - no DNS check)`,
    });
  } catch (error: any) {
    console.error("Error verifying domain:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify domain" },
      { status: 500 }
    );
  }
}

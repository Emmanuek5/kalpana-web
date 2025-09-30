import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

// POST /api/domains/:id/verify - Verify domain ownership
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
      { error: "Domain already verified" },
      { status: 400 }
    );
  }

  try {
    // In a real implementation, you would verify DNS records here
    // For now, we'll do a simple DNS TXT record check
    const dns = await import("dns").then((m) => m.promises);

    try {
      const records = await dns.resolveTxt(domain.domain);
      const verificationRecord = records
        .flat()
        .find((record) => record.includes(domain.verificationToken!));

      if (!verificationRecord) {
        return NextResponse.json(
          {
            error:
              "Verification failed. Please add the TXT record and try again.",
          },
          { status: 400 }
        );
      }

      // Mark as verified
      const updated = await prisma.domain.update({
        where: { id },
        data: {
          verified: true,
          verifiedAt: new Date(),
        },
      });

      return NextResponse.json({
        domain: updated,
        message: "Domain verified successfully",
      });
    } catch (dnsError) {
      return NextResponse.json(
        {
          error:
            "DNS verification failed. Please ensure TXT record is properly configured.",
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Error verifying domain:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify domain" },
      { status: 500 }
    );
  }
}
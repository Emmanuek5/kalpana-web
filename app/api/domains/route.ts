import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import crypto from "crypto";

// GET /api/domains - List user domains
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const domains = await prisma.domain.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: { deployments: true },
      },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ domains });
}

// POST /api/domains - Add a new domain
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { domain: domainName, setAsDefault } = body;

    if (!domainName) {
      return NextResponse.json(
        { error: "Domain name is required" },
        { status: 400 }
      );
    }

    // Validate domain format
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(domainName)) {
      return NextResponse.json(
        { error: "Invalid domain format" },
        { status: 400 }
      );
    }

    // Check if domain already exists
    const existing = await prisma.domain.findUnique({
      where: { domain: domainName },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Domain already exists" },
        { status: 409 }
      );
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // If setting as default, unset other defaults
    if (setAsDefault) {
      await prisma.domain.updateMany({
        where: {
          userId: session.user.id,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const domain = await prisma.domain.create({
      data: {
        domain: domainName,
        userId: session.user.id,
        verificationToken,
        isDefault: setAsDefault || false,
      },
    });

    return NextResponse.json({ domain }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding domain:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add domain" },
      { status: 500 }
    );
  }
}
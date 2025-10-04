import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { DatabaseManager } from "@/lib/docker/database-manager";
import { prisma } from "@/lib/db";

const dbManager = new DatabaseManager();

// POST /api/databases/[id]/link-domain - Link a domain to a database
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

  try {
    const { id } = await params;
    
    // Verify ownership
    const database = await prisma.database.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!database) {
      return NextResponse.json(
        { error: "Database not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { domainId, subdomain } = body;

    if (!domainId) {
      return NextResponse.json(
        { error: "Domain ID is required" },
        { status: 400 }
      );
    }

    // Verify domain ownership
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

    // Link the domain
    const databaseInfo = await dbManager.linkDatabaseDomain(
      id,
      domainId,
      subdomain
    );

    return NextResponse.json({ database: databaseInfo });
  } catch (error: any) {
    console.error("Error linking domain to database:", error);
    return NextResponse.json(
      { error: error.message || "Failed to link domain" },
      { status: 500 }
    );
  }
}

// DELETE /api/databases/[id]/link-domain - Unlink domain from database
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
    const database = await prisma.database.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!database) {
      return NextResponse.json(
        { error: "Database not found" },
        { status: 404 }
      );
    }

    // Unlink the domain
    const databaseInfo = await dbManager.unlinkDatabaseDomain(id);

    return NextResponse.json({ database: databaseInfo });
  } catch (error: any) {
    console.error("Error unlinking domain from database:", error);
    return NextResponse.json(
      { error: error.message || "Failed to unlink domain" },
      { status: 500 }
    );
  }
}

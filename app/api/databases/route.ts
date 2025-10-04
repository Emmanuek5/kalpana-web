import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { DatabaseManager } from "@/lib/docker/database-manager";

const dbManager = new DatabaseManager();

// GET /api/databases - List user's standalone databases
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const databases = await dbManager.listUserDatabases(session.user.id);
    return NextResponse.json({ databases });
  } catch (error: any) {
    console.error("Error listing databases:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list databases" },
      { status: 500 }
    );
  }
}

// POST /api/databases - Create a new standalone database
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
      type,
      teamId,
      domainId,
      subdomain,
      username,
      password,
      database,
      version,
    } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    // Sanitize name - only alphanumeric, underscore, hyphen
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
    if (sanitizedName !== name) {
      return NextResponse.json(
        { error: "Database name can only contain letters, numbers, underscores, and hyphens" },
        { status: 400 }
      );
    }

    // Validate database type
    const validTypes = ["POSTGRES", "MYSQL", "MONGODB", "REDIS", "SQLITE"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid database type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Sanitize username if provided
    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: "Username can only contain letters, numbers, and underscores" },
        { status: 400 }
      );
    }

    // Sanitize database name if provided
    if (database && !/^[a-zA-Z0-9_]+$/.test(database)) {
      return NextResponse.json(
        { error: "Database name can only contain letters, numbers, and underscores" },
        { status: 400 }
      );
    }

    // Verify domain ownership if domainId is provided
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
          { error: "Domain must be verified before linking to a database" },
          { status: 400 }
        );
      }
    }

    // Create standalone database (no workspaceId)
    const databaseInfo = await dbManager.createDatabase({
      name,
      type,
      userId: session.user.id,
      teamId,
      domainId,
      subdomain,
      username,
      password,
      database,
      version,
    });

    return NextResponse.json({ database: databaseInfo }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating database:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create database" },
      { status: 500 }
    );
  }
}

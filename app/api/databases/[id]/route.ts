import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { DatabaseManager } from "@/lib/docker/database-manager";
import { prisma } from "@/lib/db";

const dbManager = new DatabaseManager();

// GET /api/databases/[id] - Get database details
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

    const databaseInfo = await dbManager.getDatabaseInfo(id);
    return NextResponse.json({ database: databaseInfo });
  } catch (error: any) {
    console.error("Error getting database:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get database" },
      { status: 500 }
    );
  }
}

// PATCH /api/databases/[id] - Update database
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
    const { name, description, password } = body;

    // Validate name if provided
    if (name) {
      const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
      if (sanitizedName !== name) {
        return NextResponse.json(
          { error: "Database name can only contain letters, numbers, underscores, and hyphens" },
          { status: 400 }
        );
      }
    }

    // Update database (handles password change with container restart)
    if (password) {
      await dbManager.updateDatabase(id, { name, description, password });
    } else {
      // Simple update without password change
      await prisma.database.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
        },
      });
    }

    const databaseInfo = await dbManager.getDatabaseInfo(id);
    return NextResponse.json({ database: databaseInfo });
  } catch (error: any) {
    console.error("Error updating database:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update database" },
      { status: 500 }
    );
  }
}

// DELETE /api/databases/[id] - Delete database
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

    const url = new URL(request.url);
    const deleteVolume = url.searchParams.get("deleteVolume") === "true";

    await dbManager.deleteDatabase(id, deleteVolume);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting database:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete database" },
      { status: 500 }
    );
  }
}

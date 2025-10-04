import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { DatabaseManager } from "@/lib/docker/database-manager";
import { prisma } from "@/lib/db";

const dbManager = new DatabaseManager();

// POST /api/databases/[id]/stop - Stop database
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

    await dbManager.stopDatabase(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error stopping database:", error);
    return NextResponse.json(
      { error: error.message || "Failed to stop database" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { DatabaseManager } from "@/lib/docker/database-manager";
import { prisma } from "@/lib/db";

const dbManager = new DatabaseManager();

// GET /api/databases/[id]/logs - Get database logs
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

    const url = new URL(request.url);
    const tail = parseInt(url.searchParams.get("tail") || "100");

    const logs = await dbManager.getDatabaseLogs(id, tail);

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("Error getting database logs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get database logs" },
      { status: 500 }
    );
  }
}

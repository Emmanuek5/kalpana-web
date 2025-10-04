import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bucketManager } from "@/lib/docker/bucket-manager";
import { prisma } from "@/lib/db";

/**
 * GET /api/buckets/[id]/stats - Get bucket statistics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: bucketId } = await params;

    // Verify ownership
    const bucket = await prisma.bucket.findUnique({
      where: { id: bucketId },
    });

    if (!bucket) {
      return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
    }

    if (bucket.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stats = await bucketManager.getBucketStats(bucketId);

    // Convert BigInt to string for JSON serialization
    const serializedStats = {
      ...stats,
      totalSizeBytes: stats.totalSizeBytes.toString(),
      largestObject: stats.largestObject
        ? {
            ...stats.largestObject,
            size: stats.largestObject.size.toString(),
          }
        : undefined,
      recentObjects: stats.recentObjects.map((obj) => ({
        ...obj,
        size: obj.size.toString(),
      })),
    };

    return NextResponse.json({ stats: serializedStats });
  } catch (error: any) {
    console.error("Error getting bucket stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get bucket stats" },
      { status: 500 }
    );
  }
}

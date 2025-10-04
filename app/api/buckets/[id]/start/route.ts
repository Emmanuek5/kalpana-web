import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bucketManager } from "@/lib/docker/bucket-manager";
import { prisma } from "@/lib/db";

/**
 * POST /api/buckets/[id]/start - Start bucket container
 */
export async function POST(
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

    await bucketManager.startBucket(bucketId);

    const bucketInfo = await bucketManager.getBucketInfo(bucketId);

    // Convert BigInt to string for JSON serialization
    const serializedBucket = {
      ...bucketInfo,
      totalSizeBytes: bucketInfo.totalSizeBytes.toString(),
    };

    return NextResponse.json({ bucket: serializedBucket });
  } catch (error: any) {
    console.error("Error starting bucket:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start bucket" },
      { status: 500 }
    );
  }
}

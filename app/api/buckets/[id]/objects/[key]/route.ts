import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bucketManager } from "@/lib/docker/bucket-manager";
import { prisma } from "@/lib/db";

/**
 * GET /api/buckets/[id]/objects/[key] - Download object from bucket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: bucketId, key: encodedKey } = await params;
    const key = decodeURIComponent(encodedKey);

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

    // Download object
    const buffer = await bucketManager.downloadObject(bucketId, key);

    // Get object metadata for content type
    const metadata = await bucketManager.getObjectMetadata(bucketId, key);

    // Return file
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `attachment; filename="${key.split("/").pop()}"`,
      },
    });
  } catch (error: any) {
    console.error("Error downloading object:", error);
    return NextResponse.json(
      { error: error.message || "Failed to download object" },
      { status: 500 }
    );
  }
}

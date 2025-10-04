import { NextRequest, NextResponse } from "next/server";
import { bucketManager } from "@/lib/docker/bucket-manager";
import { prisma } from "@/lib/db";

/**
 * GET /api/public/buckets/[publicUrl]/[...key] - Public file access
 * Access files from buckets with public access enabled
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicUrl: string; key: string[] }> }
) {
  try {
    const { publicUrl, key: keyParts } = await params;
    const key = keyParts.join("/");

    // Find bucket by public URL
    const bucket = await prisma.bucket.findUnique({
      where: { publicUrl },
    });

    if (!bucket) {
      return NextResponse.json(
        { error: "Bucket not found" },
        { status: 404 }
      );
    }

    // Check if public access is enabled
    if (!bucket.publicAccess) {
      return NextResponse.json(
        { error: "Public access is not enabled for this bucket" },
        { status: 403 }
      );
    }

    // Check if bucket is running
    if (bucket.status !== "RUNNING") {
      return NextResponse.json(
        { error: "Bucket is not running" },
        { status: 503 }
      );
    }

    // Download object
    const buffer = await bucketManager.downloadObject(bucket.id, key);

    // Get object metadata for content type
    const metadata = await bucketManager.getObjectMetadata(bucket.id, key);

    // Return file with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    console.error("Error accessing public file:", error);
    
    if (error.message?.includes("does not exist") || error.message?.includes("NoSuchKey")) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to access file" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bucketManager } from "@/lib/docker/bucket-manager";
import { prisma } from "@/lib/db";

/**
 * GET /api/buckets/[id] - Get bucket info
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

    const bucketInfo = await bucketManager.getBucketInfo(bucketId);

    // Convert BigInt to string for JSON serialization
    const serializedBucket = {
      ...bucketInfo,
      totalSizeBytes: bucketInfo.totalSizeBytes.toString(),
    };

    return NextResponse.json({ bucket: serializedBucket });
  } catch (error: any) {
    console.error("Error getting bucket:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get bucket" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/buckets/[id] - Update bucket configuration
 */
export async function PATCH(
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

    const body = await request.json();

    // Handle public access changes (generates/removes public URL)
    if (body.publicAccess !== undefined) {
      const currentBucket = await prisma.bucket.findUnique({
        where: { id: bucketId },
      });
      
      if (currentBucket && currentBucket.publicAccess !== body.publicAccess) {
        await bucketManager.updatePublicAccess(bucketId, body.publicAccess);
      }
    }

    // Update bucket configuration
    const updatedBucket = await prisma.bucket.update({
      where: { id: bucketId },
      data: {
        description: body.description,
        versioning: body.versioning,
        encryption: body.encryption,
        publicAccess: body.publicAccess,
        maxSizeGB: body.maxSizeGB,
      },
    });

    const bucketInfo = await bucketManager.getBucketInfo(bucketId);

    // Convert BigInt to string for JSON serialization
    const serializedBucket = {
      ...bucketInfo,
      totalSizeBytes: bucketInfo.totalSizeBytes.toString(),
    };

    return NextResponse.json({ bucket: serializedBucket });
  } catch (error: any) {
    console.error("Error updating bucket:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update bucket" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/buckets/[id] - Delete bucket
 */
export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const deleteVolume = searchParams.get("deleteVolume") !== "false";

    await bucketManager.deleteBucket(bucketId, deleteVolume);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting bucket:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete bucket" },
      { status: 500 }
    );
  }
}

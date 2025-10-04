import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bucketManager } from "@/lib/docker/bucket-manager";
import { prisma } from "@/lib/db";

/**
 * GET /api/buckets/[id]/objects - List objects in bucket
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

    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get("prefix") || undefined;
    const maxKeys = parseInt(searchParams.get("maxKeys") || "1000");

    const objects = await bucketManager.listObjects(bucketId, prefix, maxKeys);

    // Convert BigInt to string for JSON serialization
    const serializedObjects = objects.map((obj) => ({
      ...obj,
      size: obj.size.toString(),
    }));

    return NextResponse.json({ objects: serializedObjects });
  } catch (error: any) {
    console.error("Error listing objects:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list objects" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/buckets/[id]/objects - Upload object to bucket
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

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const key = formData.get("key") as string;
    const contentType = formData.get("contentType") as string | undefined;

    if (!file || !key) {
      return NextResponse.json(
        { error: "Missing file or key" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload object
    await bucketManager.uploadObject(bucketId, key, buffer, {
      contentType: contentType || file.type,
    });

    return NextResponse.json({ success: true, key });
  } catch (error: any) {
    console.error("Error uploading object:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload object" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/buckets/[id]/objects - Delete object from bucket
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
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    await bucketManager.deleteObject(bucketId, key);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting object:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete object" },
      { status: 500 }
    );
  }
}

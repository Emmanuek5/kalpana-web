import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bucketManager } from "@/lib/docker/bucket-manager";
import { prisma } from "@/lib/db";
import { z } from "zod";

const presignedDownloadSchema = z.object({
  key: z.string().min(1),
  expiresIn: z.number().positive().optional().default(3600),
});

/**
 * POST /api/buckets/[id]/presigned-download - Get presigned download URL
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

    const body = await request.json();
    const { key, expiresIn } = presignedDownloadSchema.parse(body);

    const url = await bucketManager.getPresignedDownloadUrl(
      bucketId,
      key,
      expiresIn
    );

    return NextResponse.json({ url, key, expiresIn });
  } catch (error: any) {
    console.error("Error generating presigned download URL:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to generate presigned download URL" },
      { status: 500 }
    );
  }
}

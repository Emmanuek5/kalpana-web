import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bucketManager } from "@/lib/docker/bucket-manager";
import { z } from "zod";

const createBucketSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, {
      message:
        "Bucket name must be 3-63 characters, lowercase letters, numbers, and hyphens only",
    }),
  description: z.string().optional(),
  workspaceId: z.string().optional(),
  teamId: z.string().optional(),
  domainId: z.string().optional(),
  subdomain: z.string().optional(),
  region: z.string().optional(),
  versioning: z.boolean().optional(),
  encryption: z.boolean().optional(),
  publicAccess: z.boolean().optional(),
  maxSizeGB: z.number().positive().optional(),
});

/**
 * GET /api/buckets - List user's buckets
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    let buckets;
    if (workspaceId) {
      // List buckets for a specific workspace
      buckets = await bucketManager.listWorkspaceBuckets(workspaceId);
    } else {
      // List all user's buckets
      buckets = await bucketManager.listUserBuckets(session.user.id);
    }

    // Convert BigInt to string for JSON serialization
    const serializedBuckets = buckets.map((bucket) => ({
      ...bucket,
      totalSizeBytes: bucket.totalSizeBytes.toString(),
    }));

    return NextResponse.json({ buckets: serializedBuckets });
  } catch (error: any) {
    console.error("Error listing buckets:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list buckets" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/buckets - Create a new bucket
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createBucketSchema.parse(body);

    // Create bucket
    const bucket = await bucketManager.createBucket({
      ...validatedData,
      userId: session.user.id,
    });

    // Convert BigInt to string for JSON serialization
    const serializedBucket = {
      ...bucket,
      totalSizeBytes: bucket.totalSizeBytes.toString(),
    };

    return NextResponse.json({ bucket: serializedBucket }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating bucket:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create bucket" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { bucketManager } from "@/lib/docker/bucket-manager";

// POST /api/buckets/[id]/link-domain - Link a domain to bucket
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
    const body = await request.json();
    const { domainId, subdomain } = body;

    if (!domainId) {
      return NextResponse.json(
        { error: "Domain ID is required" },
        { status: 400 }
      );
    }

    const bucket = await bucketManager.linkBucketDomain(
      id,
      domainId,
      subdomain
    );

    return NextResponse.json({ bucket });
  } catch (error: any) {
    console.error("Error linking domain to bucket:", error);
    return NextResponse.json(
      { error: error.message || "Failed to link domain" },
      { status: 500 }
    );
  }
}

// DELETE /api/buckets/[id]/link-domain - Unlink domain from bucket
export async function DELETE(
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

    const bucket = await bucketManager.unlinkBucketDomain(id);

    return NextResponse.json({ bucket });
  } catch (error: any) {
    console.error("Error unlinking domain from bucket:", error);
    return NextResponse.json(
      { error: error.message || "Failed to unlink domain" },
      { status: 500 }
    );
  }
}

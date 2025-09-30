import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { containerAPI } from "@/lib/container-api";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return new Response("File path is required", { status: 400 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return new Response("Workspace not found", { status: 404 });
    }

    if (workspace.status !== "RUNNING") {
      return new Response("Workspace is not running", { status: 400 });
    }

    // Get file content (readFile returns the content string directly)
    const content = await containerAPI.readFile(workspace.id, filePath);

    return Response.json({ content, path: filePath });
  } catch (error: any) {
    console.error("Error fetching file content:", error);
    return new Response(error.message || "Failed to fetch file content", {
      status: 500,
    });
  }
}

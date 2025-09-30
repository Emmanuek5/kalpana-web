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

    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!workspace) {
      return new Response("Workspace not found", { status: 404 });
    }

    if (workspace.status !== "RUNNING" || !workspace.agentPort) {
      return Response.json({ files: [] });
    }

    // Ensure connection to agent bridge
    try {
      await containerAPI.connect(workspace.id, workspace.agentPort);
    } catch (error) {
      // May already be connected
      console.log("Agent bridge connection for files:", error);
    }

    // Get all files recursively from workspace (fileTree returns nested array)
    const fileTree = await containerAPI.fileTree(workspace.id, "/workspace");

    // Flatten the directory structure into a list of files
    const flattenFiles = (
      items: any[],
      parentPath: string = ""
    ): Array<{ path: string; name: string; type: "file" | "directory" }> => {
      const files: Array<{
        path: string;
        name: string;
        type: "file" | "directory";
      }> = [];

      for (const item of items) {
        const fullPath = parentPath ? `${parentPath}/${item.name}` : item.name;

        if (item.type === "file") {
          files.push({
            path: fullPath,
            name: item.name,
            type: "file",
          });
        } else if (item.type === "directory" && item.children) {
          // Add directory itself
          files.push({
            path: fullPath,
            name: item.name,
            type: "directory",
          });
          // Add children
          files.push(...flattenFiles(item.children, fullPath));
        }
      }

      return files;
    };

    const files = flattenFiles(Array.isArray(fileTree) ? fileTree : []);

    // Filter out common directories we don't want to show
    const filteredFiles = files.filter(
      (file) =>
        !file.path.includes("node_modules") &&
        !file.path.includes(".git") &&
        !file.path.includes("dist") &&
        !file.path.includes("build") &&
        !file.path.includes(".next") &&
        !file.path.startsWith(".")
    );

    return Response.json({ files: filteredFiles });
  } catch (error: any) {
    console.error("Error fetching workspace files:", error);
    return new Response(error.message || "Failed to fetch files", {
      status: 500,
    });
  }
}

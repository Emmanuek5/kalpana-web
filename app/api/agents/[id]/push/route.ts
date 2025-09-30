import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Octokit } from "@octokit/rest";

// POST push agent changes to GitHub branch
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const { id } = await params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agent = await prisma.agent.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Agent has not completed execution" },
        { status: 400 }
      );
    }

    if (!agent.filesEdited) {
      return NextResponse.json(
        { error: "No files were edited" },
        { status: 400 }
      );
    }

    // Get GitHub access token
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: "github",
      },
      select: { accessToken: true },
    });

    if (!account?.accessToken) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 400 }
      );
    }

    await prisma.agent.update({
      where: { id },
      data: { status: "PUSHING" },
    });

    try {
      const octokit = new Octokit({ auth: account.accessToken });
      const [owner, repo] = agent.githubRepo.split("/");
      const filesEdited = JSON.parse(agent.filesEdited);

      // Get the latest commit from source branch
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${agent.sourceBranch}`,
      });

      const latestCommitSha = refData.object.sha;

      // Create a new branch
      try {
        await octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${agent.targetBranch}`,
          sha: latestCommitSha,
        });
      } catch (error: any) {
        // Branch might already exist
        if (error.status !== 422) {
          throw error;
        }
      }

      // Get the tree of the latest commit
      const { data: commitData } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: latestCommitSha,
      });

      // Create blobs for each edited file
      const tree = await Promise.all(
        filesEdited.map(async (file: any) => {
          const { data: blob } = await octokit.git.createBlob({
            owner,
            repo,
            content: file.newContent,
            encoding: "utf-8",
          });

          return {
            path: file.path,
            mode: "100644" as const,
            type: "blob" as const,
            sha: blob.sha,
          };
        })
      );

      // Create new tree
      const { data: newTree } = await octokit.git.createTree({
        owner,
        repo,
        base_tree: commitData.tree.sha,
        tree,
      });

      // Create commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner,
        repo,
        message: `🤖 Agent: ${agent.task}`,
        tree: newTree.sha,
        parents: [latestCommitSha],
      });

      // Update branch reference
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${agent.targetBranch}`,
        sha: newCommit.sha,
        force: true,
      });

      await prisma.agent.update({
        where: { id },
        data: {
          status: "COMPLETED",
          pushedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Changes pushed to GitHub",
        branch: agent.targetBranch,
        url: `https://github.com/${owner}/${repo}/tree/${agent.targetBranch}`,
      });
    } catch (error: any) {
      console.error("Error pushing to GitHub:", error);

      await prisma.agent.update({
        where: { id },
        data: {
          status: "ERROR",
          errorMessage: `Failed to push: ${error.message}`,
        },
      });

      return NextResponse.json(
        { error: "Failed to push to GitHub", details: error.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in push route:", error);
    return NextResponse.json(
      { error: "Failed to push changes" },
      { status: 500 }
    );
  }
}
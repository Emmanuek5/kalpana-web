import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";

// GET /api/teams/[teamId]/github/repos - Get team's GitHub repositories
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    // Check if user is a member
    const member = await prisma.teamMember.findFirst({
      where: { teamId, userId: session.user.id },
      include: {
        team: {
          select: {
            githubAccessToken: true,
            githubUsername: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!member.team.githubAccessToken) {
      return NextResponse.json(
        { error: "Team GitHub not connected" },
        { status: 400 }
      );
    }

    // Decrypt the team's GitHub token
    const githubToken = decrypt(member.team.githubAccessToken);

    // Check if we need branches for a specific repo
    const url = new URL(req.url);
    const owner = url.searchParams.get("owner");
    const repo = url.searchParams.get("repo");
    const branches = url.searchParams.get("branches");

    if (owner && repo && branches === "true") {
      // Fetch branches for specific repo
      const branchesRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!branchesRes.ok) {
        return NextResponse.json(
          { error: "Failed to fetch branches" },
          { status: 500 }
        );
      }

      const branchesData = await branchesRes.json();
      return NextResponse.json({ branches: branchesData });
    }

    // Fetch repositories
    const reposRes = await fetch(
      `https://api.github.com/user/repos?per_page=100&sort=updated`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!reposRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch repositories" },
        { status: 500 }
      );
    }

    const reposData = await reposRes.json();

    const repos = reposData.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      defaultBranch: repo.default_branch,
    }));

    return NextResponse.json({ repos });
  } catch (error) {
    console.error("Error fetching team GitHub repos:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}

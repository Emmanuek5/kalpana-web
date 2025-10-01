import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
  updated_at: string;
  language: string | null;
  stargazers_count: number;
}

// GET user's GitHub repositories or branches
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: "github",
      },
      select: {
        accessToken: true,
      },
    });

    if (!account?.accessToken) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);

    // Check if fetching branches for a specific repo
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const fetchBranches = searchParams.get("branches") === "true";

    if (owner && repo && fetchBranches) {
      // Fetch branches for specific repository
      const branchesRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches`,
        {
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!branchesRes.ok) {
        const error = await branchesRes.text();
        console.error("GitHub API error (branches):", error);
        return NextResponse.json(
          { error: "Failed to fetch branches from GitHub" },
          { status: branchesRes.status }
        );
      }

      const branches = await branchesRes.json();

      return NextResponse.json({
        branches: branches.map((branch: any) => ({
          name: branch.name,
          commit: {
            sha: branch.commit.sha,
          },
        })),
      });
    }

    // Fetch repositories
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("per_page") || "100");
    const sort = searchParams.get("sort") || "updated";
    const type = searchParams.get("type") || "all"; // all, owner, public, private

    const res = await fetch(
      `https://api.github.com/user/repos?page=${page}&per_page=${perPage}&sort=${sort}&type=${type}`,
      {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!res.ok) {
      const error = await res.text();
      console.error("GitHub API error:", error);
      return NextResponse.json(
        { error: "Failed to fetch repositories from GitHub" },
        { status: res.status }
      );
    }

    const repos: GitHubRepo[] = await res.json();

    return NextResponse.json({
      repos: repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
        language: repo.language,
        stars: repo.stargazers_count,
      })),
      page,
      perPage,
    });
  } catch (error) {
    console.error("Error fetching GitHub repos:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET all agents for the user or team
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamId = req.nextUrl.searchParams.get("teamId");

    let agents;

    if (teamId) {
      // Check if user is a team member
      const member = await prisma.teamMember.findFirst({
        where: { teamId, userId: session.user.id },
      });

      if (!member) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Fetch team agents
      agents = await prisma.agent.findMany({
        where: { teamId },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Fetch personal agents
      agents = await prisma.agent.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: { createdAt: "desc" },
      });
      
      // Filter out team agents
      agents = agents.filter((a: any) => !a.teamId);
    }

    return NextResponse.json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

// POST create new agent
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, task, model, githubRepo, sourceBranch, targetBranch, teamId, githubSource } =
      await req.json();

    if (!name || !task || !githubRepo || !targetBranch) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check for required keys - team or user
    let hasGithub = false;
    let hasOpenRouter = false;

    if (teamId) {
      // Verify user is a member and check team keys
      const member = await prisma.teamMember.findFirst({
        where: { teamId, userId: session.user.id },
        include: {
          team: {
            select: {
              githubAccessToken: true,
              openrouterApiKey: true,
            },
          },
        },
      });

      if (!member) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      hasGithub = !!member.team.githubAccessToken;
      hasOpenRouter = !!member.team.openrouterApiKey;
    }

    // Fallback to user keys if team keys not available
    if (!hasGithub || !hasOpenRouter) {
      const [account, user] = await Promise.all([
        prisma.account.findFirst({
          where: {
            userId: session.user.id,
            providerId: "github",
          },
          select: { accessToken: true },
        }),
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: { openrouterApiKey: true },
        }),
      ]);

      if (!hasGithub) {
        hasGithub = !!account?.accessToken;
      }
      if (!hasOpenRouter) {
        hasOpenRouter = !!(user?.openrouterApiKey || process.env.OPENROUTER_API_KEY);
      }
    }

    if (!hasGithub) {
      return NextResponse.json(
        { error: "GitHub not connected. Please connect GitHub in settings or team settings." },
        { status: 400 }
      );
    }

    if (!hasOpenRouter) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured. Please add your API key in settings or team settings." },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.create({
      data: {
        name,
        task,
        model: model || "anthropic/claude-3.5-sonnet",
        githubRepo,
        sourceBranch: sourceBranch || "main",
        targetBranch,
        githubSource: githubSource || "personal",
        userId: session.user.id,
        teamId: teamId || undefined,
      },
    });

    return NextResponse.json(agent);
  } catch (error) {
    console.error("Error creating agent:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}

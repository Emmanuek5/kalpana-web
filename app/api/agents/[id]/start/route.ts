import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { agentRunner } from "@/lib/agents/agent-runner";
import { decrypt } from "@/lib/crypto";

// POST start agent execution
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
      include: {
        team: {
          select: {
            githubAccessToken: true,
            openrouterApiKey: true,
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.status === "RUNNING") {
      return NextResponse.json(
        { error: "Agent is already running" },
        { status: 400 }
      );
    }

    // Get keys based on githubSource preference
    let githubToken: string | undefined;
    let openrouterApiKey: string | undefined;

    // Determine which GitHub source to use
    const useTeamGithub = agent.githubSource === "team" && agent.teamId && (agent as any).team;

    if (useTeamGithub) {
      // Use team GitHub if specified
      const teamData = (agent as any).team;
      githubToken = teamData.githubAccessToken ? decrypt(teamData.githubAccessToken) : undefined;
    }

    // Always check team OpenRouter if agent belongs to team
    if (agent.teamId && (agent as any).team) {
      const teamData = (agent as any).team;
      openrouterApiKey = teamData.openrouterApiKey ? decrypt(teamData.openrouterApiKey) : undefined;
    }

    // Fallback to user keys if not using team or team keys not available
    if (!githubToken || !openrouterApiKey) {
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

      if (!githubToken) {
        githubToken = account?.accessToken!;
      }
      if (!openrouterApiKey) {
        openrouterApiKey = user?.openrouterApiKey || process.env.OPENROUTER_API_KEY;
      }
    }

    if (!githubToken) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 400 }
      );
    }

    if (!openrouterApiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 400 }
      );
    }

    // Start the agent execution in background
    agentRunner
      .startAgent(id, githubToken, openrouterApiKey)
      .catch((error) => {
        console.error(`Error running agent ${id}:`, error);
      });

    return NextResponse.json({ success: true, message: "Agent started" });
  } catch (error) {
    console.error("Error starting agent:", error);
    return NextResponse.json(
      { error: "Failed to start agent" },
      { status: 500 }
    );
  }
}

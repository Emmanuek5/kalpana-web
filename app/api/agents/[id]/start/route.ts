import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { agentRunner } from "@/lib/agents/agent-runner";

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

    // Get GitHub access token and OpenRouter API key
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

    if (!account?.accessToken) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 400 }
      );
    }

    // Use user's API key if available, otherwise use default
    const openrouterApiKey =
      user?.openrouterApiKey || process.env.OPENROUTER_API_KEY!;

    if (!openrouterApiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 400 }
      );
    }

    // Start the agent execution in background
    agentRunner
      .startAgent(id, account.accessToken, openrouterApiKey)
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

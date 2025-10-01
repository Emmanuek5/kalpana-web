import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { agentRunner } from "@/lib/agents/agent-runner";

// POST send message to agent container (uses the actual agent with tools)
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

    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Invalid message" },
        { status: 400 }
      );
    }

    // Get user's API key
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { openrouterApiKey: true },
    });

    const apiKey = user?.openrouterApiKey || process.env.OPENROUTER_API_KEY!;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 400 }
      );
    }

    // Use the agent runner to send message to the container
    // This will use the actual agent with all its tools
    await agentRunner.resumeAgent(id, message, apiKey);

    // Return success - the SSE stream will handle all updates
    return NextResponse.json({ success: true, streaming: true });
  } catch (error: any) {
    console.error("Error in agent chat:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send message" },
      { status: 500 }
    );
  }
}

// GET conversation history
export async function GET(
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
      select: {
        conversationHistory: true,
        task: true,
        filesEdited: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const history = agent.conversationHistory
      ? JSON.parse(agent.conversationHistory)
      : [];

    return NextResponse.json({
      history,
      task: agent.task,
      filesEdited: agent.filesEdited ? JSON.parse(agent.filesEdited) : [],
    });
  } catch (error) {
    console.error("Error fetching conversation history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { agentRunner } from "@/lib/agents/agent-runner";

// POST resume agent with new task (maintains context)
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

    // Agent can be resumed if IDLE, COMPLETED, or ERROR
    if (!["IDLE", "COMPLETED", "ERROR"].includes(agent.status)) {
      return NextResponse.json(
        { error: "Agent is currently running" },
        { status: 400 }
      );
    }

    const { newTask } = await req.json();

    if (!newTask || typeof newTask !== "string") {
      return NextResponse.json(
        { error: "New task is required" },
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

    // Add user's new task to conversation history
    const conversationHistory = agent.conversationHistory
      ? JSON.parse(agent.conversationHistory)
      : [];

    conversationHistory.push({
      role: "user",
      content: newTask,
      timestamp: new Date().toISOString(),
      type: "resume_task",
    });

    // Update agent with new task and status
    await prisma.agent.update({
      where: { id },
      data: {
        task: `${agent.task}\n\nContinued: ${newTask}`,
        conversationHistory: JSON.stringify(conversationHistory),
        status: "IDLE", // Reset to IDLE before starting
        errorMessage: null,
        lastMessageAt: new Date(),
      },
    });

    // Start the agent execution with context
    agentRunner
      .resumeAgent(id, newTask, account.accessToken)
      .catch((error) => {
        console.error(`Error resuming agent ${id}:`, error);
      });

    return NextResponse.json({
      success: true,
      message: "Agent resumed with new task",
    });
  } catch (error) {
    console.error("Error resuming agent:", error);
    return NextResponse.json(
      { error: "Failed to resume agent" },
      { status: 500 }
    );
  }
}
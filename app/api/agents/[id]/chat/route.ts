import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// POST send message to agent with context
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

    // Get conversation history
    const conversationHistory = agent.conversationHistory
      ? JSON.parse(agent.conversationHistory)
      : [];

    // Add user message to history
    const userMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    conversationHistory.push(userMessage);

    // Get user's API key or use default
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { openrouterApiKey: true, defaultModel: true },
    });

    const apiKey = user?.openrouterApiKey || process.env.OPENROUTER_API_KEY!;
    const openrouter = createOpenRouter({ apiKey });
    const model = user?.defaultModel || "anthropic/claude-3.5-sonnet";

    // Build context-aware system prompt
    const systemPrompt = `You are an autonomous coding agent working on the GitHub repository: ${agent.githubRepo}

Original Task: ${agent.task}

${
  agent.filesEdited
    ? `Files you've edited so far:\n${JSON.parse(agent.filesEdited)
        .map((f: any) => `- ${f.path}`)
        .join("\n")}`
    : "No files edited yet."
}

The user is continuing the conversation with you. You have full context of your previous work and can:
- Discuss what you've done
- Make additional changes
- Answer questions about the codebase
- Continue or modify your previous work

Maintain context from the conversation history and provide helpful, contextual responses.`;

    // Prepare messages for AI (exclude timestamps for the AI)
    const messages = conversationHistory.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Stream AI response
    const result = streamText({
      model: openrouter(model),
      messages,
      system: systemPrompt,
      temperature: 0.7,
      async onFinish({ text }) {
        // Add assistant response to history
        const assistantMessage = {
          role: "assistant",
          content: text,
          timestamp: new Date().toISOString(),
        };

        conversationHistory.push(assistantMessage);

        // Update agent with new conversation history
        await prisma.agent.update({
          where: { id },
          data: {
            conversationHistory: JSON.stringify(conversationHistory),
            lastMessageAt: new Date(),
          },
        });
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Error in agent chat:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
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
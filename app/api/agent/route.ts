import { streamText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { containerAPI } from "@/lib/container-api";
import { createAgentTools } from "@/lib/agent-tools";
import { NextRequest } from "next/server";
import { getSystemPrompt } from "@/lib/system";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { messages, workspaceId, model, images } = await req.json();

    // Verify workspace belongs to user and get user settings
    const [workspace, user] = await Promise.all([
      prisma.workspace.findFirst({
        where: {
          id: workspaceId,
          userId: session.user.id,
        },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { openrouterApiKey: true },
      }),
    ]);

    if (!workspace) {
      return new Response("Workspace not found", { status: 404 });
    }

    if (workspace.status !== "RUNNING" || !workspace.agentPort) {
      return new Response("Workspace not running", { status: 400 });
    }

    // Ensure connection to agent bridge
    try {
      await containerAPI.connect(workspaceId, workspace.agentPort);
    } catch (error) {
      // May already be connected
      console.log("Agent bridge connection:", error);
    }

    // Use user's API key if available, otherwise use default
    const apiKey = user?.openrouterApiKey || process.env.OPENROUTER_API_KEY!;
    const openrouterClient = createOpenRouter({ apiKey });

    // Use requested model or fall back to default
    const selectedModel = model || "anthropic/claude-3.5-sonnet";

    // Create workspace-specific tools
    const tools = createAgentTools(workspaceId);

    // Collect reasoning tokens
    let reasoningCollected = "";

    // Stream AI response with tools and multi-step support
    // Transform the last message to include images if provided
    const transformedMessages = [...messages];
    if (images && images.length > 0 && transformedMessages.length > 0) {
      const lastMessage = transformedMessages[transformedMessages.length - 1];
      if (lastMessage.role === "user") {
        // Convert to multimodal format with text and images
        lastMessage.content = [
          { type: "text", text: lastMessage.content },
          ...images.map((img: any) => ({
            type: "image",
            image: `data:${img.mimeType};base64,${img.base64}`,
          })),
        ];
      }
    }

    const systemPrompt = getSystemPrompt(workspace);
    const result = streamText({
      model: openrouterClient(selectedModel),
      messages: transformedMessages,
      system: systemPrompt,
      tools,
      stopWhen: stepCountIs(10), // Enable multi-step calls - continue after tool execution
      onChunk: (event: any) => {
        try {
          const t = String(event?.type || "");
          const isReasoning =
            t.includes("reasoning") || event?.part?.type === "reasoning";

          if (!isReasoning) return;

          const candidates: unknown[] = [
            event?.delta,
            event?.text,
            event?.content,
            event?.reasoningDelta,
            event?.reasoningText,
            event?.part?.text,
            event?.part?.content,
            event?.delta?.text,
            event?.delta?.content,
          ];

          for (const c of candidates) {
            if (typeof c === "string" && c) {
              reasoningCollected += c;
              return;
            }
          }
        } catch {}
      },
    });

    // Return UI message stream response with reasoning enabled
    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      sendSources: true,
    });
  } catch (error) {
    console.error("AI agent error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

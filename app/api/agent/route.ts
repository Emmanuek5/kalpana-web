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

    const { messages, workspaceId, chatId, model, images } = await req.json();

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
    }

    // Use user's API key if available, otherwise use default
    const apiKey = user?.openrouterApiKey || process.env.OPENROUTER_API_KEY!;
    const openrouterClient = createOpenRouter({ apiKey });

    // Use requested model or fall back to default
    const selectedModel = model || "anthropic/claude-3.5-sonnet";

    // Create workspace-specific tools with the same API key and model
    const tools = createAgentTools(workspaceId, apiKey, selectedModel);

    // Collect reasoning tokens and message parts
    let reasoningCollected = "";
    let textCollected = "";
    const toolCallsCollected: any[] = [];
    const toolResultsCollected: any[] = [];
    
    // Track message IDs for progressive updates
    let userMessageId: string | null = null;
    let assistantMessageId: string | null = null;

    if (chatId) {
      try {
        const assistantMessage = await prisma.message.create({
          data: {
            chatId,
            role: "assistant",
            content: JSON.stringify([]),
            status: "streaming",
          },
        });
        assistantMessageId = assistantMessage.id;
      } catch (error) {
        console.error("Failed to create assistant message placeholder", error);
      }
    }

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

    // Fetch codebase index if available
    let codebaseIndex = null;
    try {
      const indexRes = await fetch(
        `${req.nextUrl.origin}/api/workspaces/${workspaceId}/codebase-index`,
        { headers: req.headers }
      );
      if (indexRes.ok) {
        codebaseIndex = await indexRes.json();
      }
    } catch (error) {
      // Index not available
    }

    const systemPrompt = getSystemPrompt(workspace, codebaseIndex);
    
    // Create custom SSE stream for better control
    const encoder = new TextEncoder();
    const abortController = new AbortController();
    
    const persistenceStatus = { current: "streaming" as
      "streaming" | "complete" | "error" | "cancelled" };

    const persistAssistantMessage = async (
      status: "streaming" | "complete" | "error" | "cancelled" = "streaming"
    ) => {
      if (!assistantMessageId) return;

      if (persistenceStatus.current !== status) {
        persistenceStatus.current = status;
      }

      const assistantParts: any[] = [];

      if (textCollected) {
        assistantParts.push({ type: "text", text: textCollected });
      }

      if (reasoningCollected) {
        assistantParts.push({ type: "reasoning", text: reasoningCollected });
      }

      for (const toolCall of toolCallsCollected) {
        assistantParts.push({ type: "tool-call", ...toolCall });
      }

      for (const toolResult of toolResultsCollected) {
        assistantParts.push({ type: "tool-result", ...toolResult });
      }

      try {
        await prisma.message.update({
          where: { id: assistantMessageId },
          data: {
            content: JSON.stringify(assistantParts),
            status,
          },
        });
      } catch (persistError) {
        console.error("Failed to persist assistant message", persistError);
      }
    };

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = streamText({
            model: openrouterClient(selectedModel),
            messages: transformedMessages,
            system: systemPrompt,
            tools,
            stopWhen: stepCountIs(20),
            abortSignal: abortController.signal,
          });

          // Use fullStream to get all events including tool calls
          for await (const chunk of result.fullStream) {
            // Handle tool calls (before execution)
            if (chunk.type === 'tool-call') {
          
              
              // Collect for database
              toolCallsCollected.push({
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                args: chunk.input,
              });

              await persistAssistantMessage();
              
              // Stream to client immediately
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "tool-call",
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    args: chunk.input,
                  })}\n\n`
                )
              );
            }
            
            // Handle tool results (after execution)
            else if (chunk.type === 'tool-result') {
           
              
              // Collect for database
              toolResultsCollected.push({
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                result: chunk.output,
              });

              await persistAssistantMessage();
              
              // Stream to client
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "tool-result",
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    result: chunk.output,
                  })}\n\n`
                )
              );
            }
            
            // Handle text deltas
            else if (chunk.type === 'text-delta') {
              const text = (chunk as any).text || "";
              textCollected += text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "text-delta",
                    textDelta: text,
                  })}\n\n`
                )
              );

              await persistAssistantMessage();
            }
            
            // Handle reasoning
            else if (chunk.type === 'reasoning-delta') {
              const text = (chunk as any).text || "";
              reasoningCollected += text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "reasoning-delta",
                    textDelta: text,
                  })}\n\n`
                )
              );

              await persistAssistantMessage();
            }
            
            // Handle errors
            else if (chunk.type === 'error') {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "error",
                    error: chunk.error,
                  })}\n\n`
                )
              );
            }
          }

          await persistAssistantMessage("complete");

          // Send finish event
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "finish" })}\n\n`)
          );

          controller.close();
        } catch (error: any) {
          // Check if it was aborted
          if (error.name === 'AbortError') {
            console.log("🛑 Stream aborted by client");
            await persistAssistantMessage("cancelled");
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", error: "Generation stopped by user" })}\n\n`
              )
            );
          } else {
            await persistAssistantMessage("error");
            
            // Check for OpenRouter credits error
            const isCreditsError = error.statusCode === 402 || 
                                   error.message?.includes("Insufficient credits") ||
                                   error.responseBody?.includes("Insufficient credits");
            
            const errorMessage = isCreditsError 
              ? "Insufficient OpenRouter credits. Please add more credits at https://openrouter.ai/settings/credits"
              : error.message;
            
            const errorType = isCreditsError ? "credits_error" : "error";
            
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ 
                  type: errorType, 
                  error: errorMessage,
                  statusCode: error.statusCode,
                  isCreditsError 
                })}\n\n`
              )
            );
          }
          controller.close();
        }
      },
      cancel() {
        // Called when the client disconnects or aborts
        console.log("🛑 Client disconnected, aborting stream");
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI agent error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

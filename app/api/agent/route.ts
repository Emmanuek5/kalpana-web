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
            prepareStep: async ({ stepNumber, steps }) => {
              // Return empty object to use default settings
              return {};
            },
            onStepFinish: ({ toolCalls, toolResults, text }) => {
              // Send tool calls first (if any)
              if (toolCalls && toolCalls.length > 0) {
                for (const toolCall of toolCalls) {
                  // Extract args - try multiple possible properties
                  let toolArgs = (toolCall as any).args 
                    || (toolCall as any).arguments 
                    || (toolCall as any).input
                    || (toolCall as any).parameters
                    || {};
                  
                  // If toolArgs is still empty, check if the toolCall itself contains the args
                  if (Object.keys(toolArgs).length === 0) {
                    // Create a copy without known metadata fields
                    const { toolCallId, toolName, type, ...possibleArgs } = toolCall as any;
                    if (Object.keys(possibleArgs).length > 0) {
                      toolArgs = possibleArgs;
                    }
                  }
                  
                  // Collect for database
                  toolCallsCollected.push({
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    args: toolArgs,
                  });
                  
                  // Stream tool call to user
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool-call",
                        toolCallId: toolCall.toolCallId,
                        toolName: toolCall.toolName,
                        args: toolArgs,
                      })}\n\n`
                    )
                  );
                }
              }
              
              // Send tool results after execution completes (if any)
              if (toolResults && toolResults.length > 0) {
                for (let i = 0; i < toolResults.length; i++) {
                  const toolResult = toolResults[i];
                  const toolCall = toolCalls[i];
                  
                  // Extract result - could be in result property or the object itself
                  const resultData = (toolResult as any).result !== undefined 
                    ? (toolResult as any).result 
                    : toolResult;
                  
                  // Collect for database
                  toolResultsCollected.push({
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    result: resultData,
                  });
                  
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool-result",
                        toolCallId: toolCall.toolCallId,
                        toolName: toolCall.toolName,
                        result: resultData,
                      })}\n\n`
                    )
                  );
                }
              }
            },
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

          // NOTE: Messages are already saved by the frontend before calling this API
          // We don't need to create them again here to avoid duplicates

          // Stream text chunks and update database periodically
          let chunkCount = 0;
          let lastDbUpdate = Date.now();
          const DB_UPDATE_INTERVAL = 1000; // Update DB every 1 second
          
          for await (const textChunk of result.textStream) {
            chunkCount++;
            textCollected += textChunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text-delta", textDelta: textChunk })}\n\n`)
            );
            
            // Update database periodically during streaming
            const now = Date.now();
            if (now - lastDbUpdate > DB_UPDATE_INTERVAL && assistantMessageId) {
              lastDbUpdate = now;
              const currentParts = [
                { type: "text", text: textCollected, status: "streaming" },
                ...toolCallsCollected.map(tc => ({ type: "tool-call", ...tc })),
                ...toolResultsCollected.map(tr => ({ type: "tool-result", ...tr })),
              ];
              
              await prisma.message.update({
                where: { id: assistantMessageId },
                data: { content: JSON.stringify(currentParts) },
              }).catch(err => console.error("Failed to update message:", err));
            }
          }

          // Wait for all steps to complete (tool calls finish)
          await result.text;

          // Send reasoning if collected
          if (reasoningCollected) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "reasoning-delta",
                  reasoningDelta: reasoningCollected,
                })}\n\n`
              )
            );
          }

          // Update assistant message with FINAL content
          const assistantParts: any[] = [];
          
          if (textCollected) {
            assistantParts.push({ type: "text", text: textCollected, status: "complete" });
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

          if (assistantMessageId) {
            await prisma.message.update({
              where: { id: assistantMessageId },
              data: { content: JSON.stringify(assistantParts) },
            });
          }

          // Send finish event after everything is done
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "finish" })}\n\n`)
          );

          controller.close();
        } catch (error: any) {
          // Check if it was aborted
          if (error.name === 'AbortError') {
            console.log("🛑 Stream aborted by client");
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", error: "Generation stopped by user" })}\n\n`
              )
            );
          } else {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`
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

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { agentRunner, AgentStreamEvent } from "@/lib/agents/agent-runner";

// GET /api/agents/[id]/stream - Server-Sent Events endpoint
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const { id } = await params;

    console.log(`[Stream Route] 🎯 SSE connection request for agent ${id}`);

    if (!session) {
      console.log(`[Stream Route] ❌ Unauthorized - no session`);
      return new Response("Unauthorized", { status: 401 });
    }

    // Verify agent belongs to user
    const agent = await prisma.agent.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!agent) {
      console.log(`[Stream Route] ❌ Agent ${id} not found`);
      return new Response("Agent not found", { status: 404 });
    }
    
    console.log(`[Stream Route] ✅ Agent ${id} found, status: ${agent.status}`);

    // Set up SSE headers with real-time event streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial state
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "init",
              status: agent.status,
              timestamp: new Date().toISOString(),
            })}\n\n`
          )
        );

        // Send existing data from database
        try {
          // Send conversation history FIRST (so messages appear before tool calls)
          if (agent.conversationHistory) {
            const conversation = JSON.parse(agent.conversationHistory);
            // Filter out temporary streaming messages
            const cleanConversation = conversation.filter((msg: any) => !msg.streaming);
            if (Array.isArray(cleanConversation)) {
              for (const message of cleanConversation) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "message",
                      message,
                    })}\n\n`
                  )
                );
              }
            }
          }

          // Send tool calls AFTER messages (so they appear in correct order)
          if (agent.toolCalls) {
            const toolCalls = JSON.parse(agent.toolCalls);
            if (Array.isArray(toolCalls)) {
              for (const toolCall of toolCalls) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "tool-call",
                      toolCall,
                    })}\n\n`
                  )
                );
                
                // If tool is complete, also send the result
                if (toolCall.state === "complete" && toolCall.result) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool-result",
                        toolCallId: toolCall.id,
                        toolName: toolCall.function?.name || toolCall.type,
                        result: toolCall.result,
                      })}\n\n`
                    )
                  );
                }
              }
            }
          }

          if (agent.filesEdited) {
            const filesEdited = JSON.parse(agent.filesEdited);
            if (Array.isArray(filesEdited) && filesEdited.length > 0) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "files",
                    files: filesEdited,
                  })}\n\n`
                )
              );
            }
          }
        } catch (e) {
          console.error("Error sending initial agent state:", e);
        }

        // Subscribe to real-time events from agent runner
        console.log(`[Stream Route] 📡 Subscribing to agent ${id} events...`);
        const unsubscribe = agentRunner.subscribeToAgent(
          id,
          (event: AgentStreamEvent) => {
            console.log(`[Stream Route] ✅ Received event:`, event.type, `for agent:`, event.agentId);
            console.log(`[Stream Route] Event data:`, JSON.stringify(event.data).substring(0, 200));
            try {
              switch (event.type) {
                case "text":
                  // Stream text chunks in real-time
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "streaming",
                        content: event.data.content,
                      })}\n\n`
                    )
                  );
                  break;

                case "message":
                  // Complete message (assistant response)
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "message",
                        message: event.data.message,
                      })}\n\n`
                    )
                  );
                  break;

                case "tool-call":
                  console.log(`[Stream Route] Forwarding tool-call:`, event.data);
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool-call",
                        toolCallId: event.data.toolCallId,
                        toolName: event.data.toolName,
                        args: event.data.args,
                      })}\n\n`
                    )
                  );
                  break;

                case "tool-result":
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool-result",
                        toolCallId: event.data.toolCallId,
                        toolName: event.data.toolName,
                        result: event.data.result,
                      })}\n\n`
                    )
                  );
                  break;

                case "status":
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "status",
                        status: event.data.status,
                        error: event.data.error,
                      })}\n\n`
                    )
                  );
                  break;

                case "files":
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "files",
                        files: event.data.files,
                      })}\n\n`
                    )
                  );
                  break;

                case "done":
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "done",
                        status: event.data.status,
                        filesEditedCount: event.data.filesEditedCount,
                        toolCallsCount: event.data.toolCallsCount,
                      })}\n\n`
                    )
                  );
                  // Keep stream open for potential resume
                  break;

                case "error":
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "error",
                        error: event.data.error,
                      })}\n\n`
                    )
                  );
                  // Keep stream open even on error
                  break;
              }
            } catch (error) {
              console.error("Error encoding SSE event:", error);
            }
          }
        );
        
        console.log(`[Stream Route] ✅ Subscription active for agent ${id}`);

        // Clean up on client disconnect
        req.signal.addEventListener("abort", () => {
          console.log(`[Stream Route] 🔌 Client disconnected, unsubscribing from agent ${id}`);
          unsubscribe();
          controller.close();
        });
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
    console.error("Error in agent stream endpoint:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

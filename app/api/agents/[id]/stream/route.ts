import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/agents/[id]/stream - Server-Sent Events endpoint
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const { id } = await params;

    if (!session) {
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
      return new Response("Agent not found", { status: 404 });
    }

    // Set up SSE headers
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let lastUpdate = agent.lastMessageAt || agent.updatedAt;
        let lastToolCallsCount = 0;
        let lastConversationLength = 0;

        // Parse initial state
        try {
          const toolCalls = agent.toolCalls ? JSON.parse(agent.toolCalls) : [];
          const conversation = agent.conversationHistory
            ? JSON.parse(agent.conversationHistory)
            : [];
          lastToolCallsCount = Array.isArray(toolCalls) ? toolCalls.length : 0;
          lastConversationLength = conversation.length;
        } catch (e) {
          console.error("Error parsing initial agent state:", e);
        }

        // Send initial state
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "init",
              status: agent.status,
              lastUpdate: lastUpdate?.toISOString(),
            })}\n\n`
          )
        );

        // Poll for updates every second
        const interval = setInterval(async () => {
          try {
            const updatedAgent = await prisma.agent.findUnique({
              where: { id },
            });

            if (!updatedAgent) {
              controller.close();
              clearInterval(interval);
              return;
            }

            // Check if status changed
            if (updatedAgent.status !== agent.status) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "status",
                    status: updatedAgent.status,
                    error: updatedAgent.errorMessage,
                  })}\n\n`
                )
              );
            }

            // Check for new tool calls
            if (updatedAgent.toolCalls) {
              try {
                const toolCalls = JSON.parse(updatedAgent.toolCalls);
                const newToolCallsCount = Array.isArray(toolCalls)
                  ? toolCalls.length
                  : 0;

                if (newToolCallsCount > lastToolCallsCount) {
                  // Send new tool calls
                  const newToolCalls = toolCalls.slice(lastToolCallsCount);
                  for (const toolCall of newToolCalls) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: "tool-call",
                          toolCall,
                        })}\n\n`
                      )
                    );
                  }
                  lastToolCallsCount = newToolCallsCount;
                }
              } catch (e) {
                console.error("Error parsing tool calls:", e);
              }
            }

            // Check for new conversation messages
            if (updatedAgent.conversationHistory) {
              try {
                const conversation = JSON.parse(
                  updatedAgent.conversationHistory
                );
                const newConversationLength = conversation.length;

                if (newConversationLength > lastConversationLength) {
                  // Send new messages
                  const newMessages = conversation.slice(
                    lastConversationLength
                  );
                  for (const message of newMessages) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: "message",
                          message,
                        })}\n\n`
                      )
                    );
                  }
                  lastConversationLength = newConversationLength;
                } else if (
                  newConversationLength === lastConversationLength &&
                  conversation.length > 0
                ) {
                  // Check if last message is still streaming (has streaming: true flag)
                  const lastMessage = conversation[conversation.length - 1];
                  if (
                    lastMessage.streaming &&
                    lastMessage.role === "assistant"
                  ) {
                    // Send streaming update
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: "streaming",
                          content: lastMessage.content,
                        })}\n\n`
                      )
                    );
                  }
                }
              } catch (e) {
                console.error("Error parsing conversation:", e);
              }
            }

            // Check for files edited
            if (updatedAgent.filesEdited) {
              try {
                const filesEdited = JSON.parse(updatedAgent.filesEdited);
                if (filesEdited.length > 0) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "files",
                        files: filesEdited,
                      })}\n\n`
                    )
                  );
                }
              } catch (e) {
                console.error("Error parsing files edited:", e);
              }
            }

            // Update references
            Object.assign(agent, updatedAgent);
            if (updatedAgent.lastMessageAt) {
              lastUpdate = updatedAgent.lastMessageAt;
            }

            // Stop streaming if agent completed or errored
            if (
              updatedAgent.status === "COMPLETED" ||
              updatedAgent.status === "ERROR"
            ) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "done",
                    status: updatedAgent.status,
                    error: updatedAgent.errorMessage,
                  })}\n\n`
                )
              );
              controller.close();
              clearInterval(interval);
            }
          } catch (error) {
            console.error("Error in SSE stream:", error);
            controller.error(error);
            clearInterval(interval);
          }
        }, 300); // Check every 300ms for smoother streaming

        // Clean up on client disconnect
        req.signal.addEventListener("abort", () => {
          clearInterval(interval);
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

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

    // Set up SSE headers with real-time event streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        console.log(`📡 [Stream API] Client connected for agent ${id}`);

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
              }
            }
          }

          if (agent.conversationHistory) {
            const conversation = JSON.parse(agent.conversationHistory);
            if (Array.isArray(conversation)) {
              for (const message of conversation) {
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
        const unsubscribe = agentRunner.subscribeToAgent(
          id,
          (event: AgentStreamEvent) => {
            try {
              console.log(`📨 [Stream API] Event for agent ${id}:`, event.type);

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

                case "tool-call":
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool-call",
                        toolCall: event.data.toolCall,
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
                        filesEdited: event.data.filesEdited,
                        toolCallsCount: event.data.toolCallsCount,
                      })}\n\n`
                    )
                  );
                  // Close the stream when done
                  setTimeout(() => {
                    unsubscribe();
                    controller.close();
                  }, 100);
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
                  // Close the stream on error
                  setTimeout(() => {
                    unsubscribe();
                    controller.close();
                  }, 100);
                  break;
              }
            } catch (error) {
              console.error("Error encoding SSE event:", error);
            }
          }
        );

        // Clean up on client disconnect
        req.signal.addEventListener("abort", () => {
          console.log(`🔌 [Stream API] Client disconnected for agent ${id}`);
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

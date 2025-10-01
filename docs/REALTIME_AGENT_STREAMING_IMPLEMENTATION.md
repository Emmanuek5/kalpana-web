# Real-time Agent Streaming Implementation

## Overview

This document describes the implementation of real-time streaming for the AI agent system. The new architecture uses EventEmitter-based real-time streaming from the container to the client, while still persisting data to the database.

## Changes Made

### 1. **Agent Executor** (`container/agent-bridge/agent-executor.ts`)

#### Fixed Tool Call Arguments Tracking

**Problem:** Tool call arguments were not being properly captured and sent.

**Solution:**

- Updated `onStepFinish` callback to properly access tool call arguments
- Arguments are now accessed from the toolCall object directly using `(toolCall as any).args`
- Added detailed logging for tool calls with arguments

```typescript
// Before: Arguments were missing or incorrect
const args = toolResult?.args || {}; // ❌ toolResult doesn't have args

// After: Arguments are properly accessed
const args = (toolCall as any).args || {}; // ✅ Arguments from toolCall
```

**Impact:** All tool calls now properly display their arguments in the UI, making it easier to debug and understand agent behavior.

---

### 2. **Agent Runner** (`lib/agents/agent-runner.ts`)

#### Implemented Real-time Event Streaming

**Problem:** The system was using HTTP polling, creating delays and inefficiency.

**Solution:** Implemented EventEmitter-based real-time streaming:

```typescript
import { EventEmitter } from "events";

export interface AgentStreamEvent {
  type: "text" | "tool-call" | "status" | "files" | "done" | "error";
  agentId: string;
  data?: any;
  timestamp: string;
}

class AgentRunner {
  private eventEmitter: EventEmitter = new EventEmitter();

  /**
   * Subscribe to real-time agent events for streaming
   */
  subscribeToAgent(
    agentId: string,
    callback: (event: AgentStreamEvent) => void
  ): () => void {
    const listener = (event: AgentStreamEvent) => {
      if (event.agentId === agentId) {
        callback(event);
      }
    };

    this.eventEmitter.on("agent-event", listener);

    // Return unsubscribe function
    return () => {
      this.eventEmitter.off("agent-event", listener);
    };
  }

  /**
   * Emit an agent event for real-time streaming
   */
  private emitAgentEvent(
    agentId: string,
    type: AgentStreamEvent["type"],
    data?: any
  ): void {
    const event: AgentStreamEvent = {
      type,
      agentId,
      data,
      timestamp: new Date().toISOString(),
    };
    this.eventEmitter.emit("agent-event", event);
  }
}
```

#### Dual-mode Operation: Real-time + Database

**Key Feature:** The system now operates in dual mode:

1. **Real-time streaming** via EventEmitter for instant updates
2. **Database persistence** for data durability and resume functionality

**Implementation:**

```typescript
// Emit real-time events while streaming
if (data.type === "text") {
  fullResponse += data.content;

  // ✅ Emit to real-time subscribers
  this.emitAgentEvent(agentId, "text", { content: data.content });

  // ✅ Save to database periodically
  const now = Date.now();
  if (now - lastSaveTime > SAVE_INTERVAL_MS) {
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        conversationHistory: JSON.stringify(tempHistory),
        toolCalls: JSON.stringify(toolCallsCollected),
        lastMessageAt: new Date(),
      },
    });
  }
}
```

**Events Emitted:**

- `status`: Agent status changes (RUNNING, COMPLETED, ERROR)
- `text`: Text chunks as they're generated
- `tool-call`: When tools are executed with full arguments
- `files`: When files are edited
- `done`: When execution completes
- `error`: When errors occur

---

### 3. **Stream API Endpoint** (`app/api/agents/[id]/stream/route.ts`)

#### Replaced Database Polling with Real-time Events

**Before:** Polled database every 300ms for updates (inefficient)

**After:** Subscribe to real-time events from AgentRunner (instant)

```typescript
import { agentRunner, AgentStreamEvent } from "@/lib/agents/agent-runner";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial state from database
      // ... send existing tool calls, messages, files

      // ✅ Subscribe to real-time events
      const unsubscribe = agentRunner.subscribeToAgent(
        id,
        (event: AgentStreamEvent) => {
          switch (event.type) {
            case "text":
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

            // ... handle other event types
          }
        }
      );

      // ✅ Clean up on client disconnect
      req.signal.addEventListener("abort", () => {
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
}
```

---

## Architecture Flow

### Old Architecture (Polling)

```
Container → HTTP Response → Database
                              ↓ (poll every 300ms)
                           Frontend
```

### New Architecture (Real-time)

```
Container → Agent Runner → EventEmitter ──┬─→ Stream API → Frontend (SSE)
                              ↓           └─→ Database (periodic save)
```

---

## Benefits

### 1. **Instant Updates**

- No polling delay
- Text streams character-by-character as generated
- Tool calls appear immediately when executed

### 2. **Better Performance**

- Reduced database queries
- Lower CPU usage (no constant polling)
- More efficient network usage

### 3. **Improved UX**

- Live "streaming" indicator in UI
- Real-time tool call arguments visible
- Smooth text streaming experience

### 4. **Data Durability**

- Database still persists all data
- Agents can be resumed with full context
- Audit trail maintained

### 5. **Scalability**

- EventEmitter can handle multiple subscribers
- No database bottleneck from polling
- Better resource utilization

---

## Testing the Implementation

### 1. Start an Agent

```bash
# The agent should show "Live" indicator immediately
# Status changes should appear instantly
```

### 2. Watch Tool Calls

- Each tool call should show immediately with full arguments
- No delay between execution and display

### 3. Monitor Text Streaming

- Assistant responses should stream smoothly
- No chunking or buffering delays

### 4. Check Database Persistence

- After completion, refresh the page
- All data should still be present
- Conversation can be resumed

---

## Event Flow Example

```typescript
// 1. Agent starts
emitAgentEvent(agentId, "status", { status: "RUNNING" });

// 2. Agent calls a tool
emitAgentEvent(agentId, "tool-call", {
  toolCall: {
    id: "call_123",
    type: "function",
    function: {
      name: "read_file",
      arguments: '{"path": "src/app.ts"}'
    },
    timestamp: "2025-10-01T12:00:00.000Z"
  }
});

// 3. Agent generates text
emitAgentEvent(agentId, "text", { content: "I'll analyze the file..." });

// 4. Agent completes
emitAgentEvent(agentId, "done", {
  status: "COMPLETED",
  filesEdited: [...],
  toolCallsCount: 5
});
```

---

## Frontend Integration

The frontend `app/dashboard/agents/[id]/page.tsx` already handles SSE events:

```typescript
const connectToStream = () => {
  const eventSource = new EventSource(`/api/agents/${agentId}/stream`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case "streaming":
        setStreamingText(data.content); // ✅ Real-time text
        break;
      case "tool-call":
        setToolCalls((prev) => [...prev, data.toolCall]); // ✅ Instant tool calls
        break;
      // ... other events
    }
  };
};
```

---

## Future Improvements

1. **WebSocket Support** (optional)

   - For bidirectional communication
   - More efficient than SSE for some use cases

2. **Rate Limiting**

   - Prevent event flood from very fast agents
   - Batch small text chunks

3. **Event Replay**

   - Store events in Redis for reconnection
   - Resume streaming from last event

4. **Metrics**
   - Track event emission rates
   - Monitor subscriber counts
   - Measure latency

---

## Troubleshooting

### Tool Call Arguments Not Showing

**Check:** `container/agent-bridge/agent-executor.ts` line 152

```typescript
const args = (toolCall as any).args || {}; // Should see args in logs
```

### No Real-time Updates

**Check:** EventEmitter subscription in `app/api/agents/[id]/stream/route.ts`

```typescript
const unsubscribe = agentRunner.subscribeToAgent(id, callback);
```

### Database Not Saving

**Check:** Periodic save logic in `lib/agents/agent-runner.ts`

```typescript
if (now - lastSaveTime > SAVE_INTERVAL_MS) {
  await prisma.agent.update({ ... });
}
```

---

## Summary

The real-time agent streaming implementation provides:

- ✅ Instant agent updates via EventEmitter
- ✅ Proper tool call arguments tracking
- ✅ Dual-mode operation (real-time + database)
- ✅ Improved performance and UX
- ✅ Backward compatibility with existing UI

All changes are backward compatible and require no changes to the frontend. The system now provides a professional, real-time agent experience while maintaining data durability.

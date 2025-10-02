# Streaming & Message Persistence

## Overview

Enhanced the AI agent streaming system with proper tool call logging and real-time message persistence to the database.

## Features

### 1. Tool Call Logging

**Console Output:**
```
🔧 Tool Call: webResearch { query: "latest AI models", domain: "openai.com" }
✅ Tool Result: webResearch { success: true, resultLength: 1234 }
🔧 Tool Call: readFile { path: "src/app.ts" }
✅ Tool Result: readFile { success: true, resultLength: 567 }
```

**What's Logged:**
- Tool name
- Tool arguments
- Success status
- Result size

### 2. Real-time Message Persistence

**When Messages Are Saved:**
- User message: Saved immediately when stream starts
- Assistant message: Saved after stream completes
- Includes all parts: text, reasoning, tool calls, tool results

**Database Structure:**
```json
{
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Let me search for that..." },
    { "type": "tool-call", "toolName": "webResearch", "args": {...} },
    { "type": "tool-result", "toolName": "webResearch", "result": {...} },
    { "type": "text", "text": "Based on my research..." },
    { "type": "reasoning", "text": "..." }
  ]
}
```

### 3. Stream Completion Fix

**Problem:**
- Messages were completing on next send
- Tool calls weren't visible
- Stream closed too early

**Solution:**
- Added `await result.text` after text streaming
- Waits for all tool executions to complete
- Finish event sent only after everything is done

## Implementation

### Backend Changes

**File:** `app/api/agent/route.ts`

**1. Collect Message Parts:**
```typescript
let textCollected = "";
const toolCallsCollected: any[] = [];
const toolResultsCollected: any[] = [];
```

**2. Log Tool Calls:**
```typescript
onStepFinish: ({ toolCalls, toolResults, text }) => {
  for (const toolCall of toolCalls) {
    console.log(`🔧 Tool Call: ${toolCall.toolName}`, args);
    toolCallsCollected.push(toolCall);
  }
  
  for (const toolResult of toolResults) {
    console.log(`✅ Tool Result: ${toolName}`, { success, resultLength });
    toolResultsCollected.push(toolResult);
  }
}
```

**3. Save to Database:**
```typescript
// After streaming completes
await prisma.message.create({
  data: {
    workspaceId,
    role: "assistant",
    content: JSON.stringify([
      { type: "text", text: textCollected },
      { type: "reasoning", text: reasoningCollected },
      ...toolCallsCollected,
      ...toolResultsCollected,
    ]),
  },
});
```

## Benefits

### For Debugging
- ✅ **Visibility** - See all tool calls in server logs
- ✅ **Timing** - Track when tools are called
- ✅ **Results** - Verify tool outputs
- ✅ **Errors** - Catch tool failures

### For Users
- ✅ **Persistence** - Messages saved automatically
- ✅ **History** - Full conversation preserved
- ✅ **Reload** - Messages persist across page refreshes
- ✅ **Context** - Tool calls included in history

### For AI Agent
- ✅ **Complete context** - Sees full conversation history
- ✅ **Tool history** - Knows what was already searched/done
- ✅ **Better responses** - Can reference previous results

## Streaming Flow

```
1. User sends message
   ↓
2. User message saved to DB
   ↓
3. AI starts streaming text
   ↓ (text collected in textCollected)
4. AI calls tools (webResearch, readFile, etc.)
   ↓ (logged to console)
5. Tools execute and return results
   ↓ (logged to console)
6. AI continues streaming text
   ↓
7. await result.text (wait for completion)
   ↓
8. Save assistant message to DB
   ↓ (includes text + reasoning + tool calls + results)
9. Send finish event
   ↓
10. Stream closes
```

## Console Output Example

```bash
🔧 Tool Call: webResearch { query: 'latest AI models 2024', domain: undefined }
✅ Tool Result: webResearch { success: true, resultLength: 2456 }
🔧 Tool Call: readFile { path: 'README.md' }
✅ Tool Result: readFile { success: true, resultLength: 1234 }
💾 Messages saved to database (5 parts)
```

## Database Schema

**Message Model:**
```prisma
model Message {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  workspaceId String   @db.ObjectId
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  role        String   // "user" or "assistant"
  content     String   // JSON stringified message parts array
  
  createdAt   DateTime @default(now())
  
  @@index([workspaceId])
  @@index([createdAt])
}
```

**Content Structure:**
```typescript
type MessagePart = 
  | { type: "text", text: string }
  | { type: "reasoning", text: string }
  | { type: "tool-call", toolCallId: string, toolName: string, args: any }
  | { type: "tool-result", toolCallId: string, toolName: string, result: any }
```

## Troubleshooting

### Tool Calls Not Showing

**Check server logs:**
```bash
# Should see:
🔧 Tool Call: webResearch ...
✅ Tool Result: webResearch ...
```

**If not appearing:**
- Verify `onStepFinish` is firing
- Check if tools are defined in `createAgentTools`
- Ensure model supports tool calling

### Messages Not Saving

**Check database:**
```typescript
await prisma.message.findMany({
  where: { workspaceId },
  orderBy: { createdAt: 'desc' },
  take: 10
});
```

**Check logs:**
```bash
# Should see:
💾 Messages saved to database (5 parts)
```

### Stream Not Completing

**Check if:**
- `await result.text` is being called
- No errors in try/catch block
- Finish event is sent

## Performance

### Message Size
- **Text only**: ~1-5 KB
- **With tool calls**: ~5-50 KB
- **With large results**: ~50-500 KB

### Database Impact
- **Writes per conversation**: 2 per message (user + assistant)
- **Read on load**: 1 query for all messages
- **Index**: Optimized with workspaceId + createdAt

### Memory
- Message parts collected in memory during stream
- Cleared after database save
- No memory leaks

## Future Enhancements

### Planned
- [ ] Incremental saves (save text as it streams)
- [ ] Message editing/deletion
- [ ] Export conversation history
- [ ] Search within messages

### Possible
- [ ] Message reactions/feedback
- [ ] Conversation branching
- [ ] Message templates
- [ ] Auto-summarization of long conversations

## Summary

✅ **Tool call logging** - Console output for debugging
✅ **Message persistence** - Automatic database saves
✅ **Stream completion** - Proper async handling
✅ **Full context** - All message parts preserved

The AI agent now has complete logging and persistence! 🎉

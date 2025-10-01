# Agent Execution Fixes

## Issues Found

1. **Resume was calling wrong endpoint** - `/agent/chat` expects agentExecutor to exist
2. **Missing detailed logging** - Hard to debug what's happening
3. **API key handling** - Needed fallback to container environment variable

## Fixes Applied

### 1. Always Use `/agent/execute` (lib/agents/agent-runner.ts)

```typescript
// Before: Used /agent/chat for resume (failed if executor not initialized)
const endpoint = newTask
  ? `http://localhost:${agentPort}/agent/chat`
  : `http://localhost:${agentPort}/agent/execute`;

// After: Always use /agent/execute with conversation history
const endpoint = `http://localhost:${agentPort}/agent/execute`;
```

**Why**: This ensures the agent executor is properly initialized every time, whether it's a new task or a resume.

### 2. Enhanced Logging (container/agent-bridge/server.ts)

Added detailed logging at every step:

```typescript
console.log(`📥 Received task request:`, {
  taskLength: task?.length || 0,
  hasApiKey: !!apiKey,
  model: model || "default",
  historyLength: conversationHistory?.length || 0,
});

console.log(`🤖 Initializing agent with model: ${model}`);
console.log(`📚 Restoring ${conversationHistory.length} conversation messages`);
console.log(
  `▶️ Starting agent execution for task: ${task.substring(0, 100)}...`
);

// After execution:
console.log(`✅ Agent execution completed:`, {
  chunksStreamed: chunkCount,
  toolCalls: state.toolCallsCount,
  filesEdited: state.filesEdited.length,
});
```

### 3. API Key Fallback

```typescript
// Use provided API key or fall back to environment variable
const effectiveApiKey = apiKey || process.env.OPENROUTER_API_KEY;
```

## Testing the Fixes

### 1. Rebuild Container

```bash
npm run build-container
```

### 2. Check Docker Logs

```bash
docker logs -f agent-{id}
```

You should now see:

- `📥 Received task request` - Confirms request received
- `🤖 Initializing agent` - Confirms executor created
- `▶️ Starting agent execution` - Confirms task started
- Streaming output from the AI model
- `✅ Agent execution completed` - With counts of chunks, tools, files

### 3. Expected Behavior

**Start Agent:**

1. Container created and repo cloned
2. POST to /agent/execute with initial task
3. AI model processes task
4. Tools are called (read_file, write_file, etc.)
5. Changes are made
6. Response streamed back
7. Database updated with results

**Resume Agent:**

1. Container already exists
2. POST to /agent/execute with new task + conversation history
3. AI continues from where it left off
4. More tools called
5. More changes made
6. Response streamed back
7. Database updated

## Debugging Checklist

If agent still doesn't work:

1. **Check API Key**

   ```bash
   # In container
   docker exec agent-{id} env | grep OPENROUTER
   ```

2. **Check Container Logs**

   ```bash
   docker logs -f agent-{id}
   ```

   Look for:

   - "Agent bridge running" message
   - "Received task request" messages
   - Any error messages

3. **Test Container Endpoint Directly**

   ```bash
   curl -X POST http://localhost:{agentPort}/agent/execute \
     -H "Content-Type: application/json" \
     -d '{
       "task": "List all files in the repository",
       "apiKey": "YOUR_KEY",
       "model": "anthropic/claude-3.5-sonnet"
     }'
   ```

4. **Check OpenRouter Account**
   - Verify API key is valid
   - Check you have credits
   - Check model is available

## Next Steps

- Update UI to match workspace agent panel design ✅ (Coming next)
- Add real-time streaming to frontend
- Add tool call display in UI
- Add file change preview

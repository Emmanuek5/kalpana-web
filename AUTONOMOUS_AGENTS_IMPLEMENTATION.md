# Autonomous Agent Implementation (Option A)

## Architecture Overview

We've implemented **Option A: AI runs inside the container** for autonomous coding agents. This provides complete isolation and true autonomy.

```
┌─────────────────────────────────────────────────┐
│  Agent Container (stays alive)                  │
│  ┌───────────────────────────────────────────┐  │
│  │  Agent Bridge Server (port 3001)          │  │
│  │  ├─ HTTP + WebSocket server               │  │
│  │  ├─ Agent executor endpoints:             │  │
│  │  │  - POST /agent/execute (start)         │  │
│  │  │  - POST /agent/chat (continue)         │  │
│  │  │  - GET  /agent/status                  │  │
│  │  └─ Streams SSE responses                 │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  AI Agent Executor                        │  │
│  │  ├─ OpenRouter client                     │  │
│  │  ├─ AI SDK with tool calling              │  │
│  │  ├─ Conversation state (in memory)        │  │
│  │  └─ Streams responses via SSE             │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  Agent Tools (modular)                    │  │
│  │  ├─ File ops (read/write/list)            │  │
│  │  ├─ Search (ripgrep)                      │  │
│  │  ├─ Git ops (status/diff/log)             │  │
│  │  └─ Command execution (npm/git/etc)       │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  📁 /workspace (cloned repository)              │
└─────────────────────────────────────────────────┘
         ↑
         │ HTTP/SSE (streams AI responses)
         │
┌─────────────────────────────────────────────────┐
│  Next.js Server (agent-runner.ts)              │
│  ├─ startAgent()                               │
│  │  - Creates container ONCE                   │
│  │  - Waits for repo clone                     │
│  │  - POSTs to /agent/execute                  │
│  │  - Streams responses to database            │
│  │                                              │
│  ├─ resumeAgent()                              │
│  │  - Container already exists! ✅             │
│  │  - POSTs to /agent/chat with new message   │
│  │  - Maintains conversation context           │
│  │                                              │
│  └─ stopAgent()                                │
│     - Only when user explicitly stops          │
│     - Destroys container                       │
└─────────────────────────────────────────────────┘
```

## Key Features

### 1. **Container Stays Alive** 🔥

- Containers are **NOT** destroyed between agent tasks
- Resume doesn't recreate containers - uses existing ones
- Much faster subsequent interactions
- Maintains filesystem state

### 2. **True Autonomy** 🤖

- AI model runs inside the container
- API keys passed via environment variables
- Self-directed tool execution
- 15 steps maximum (configurable via stopWhen)

### 3. **Model Selection** 🎯

- Per-agent model configuration in database
- Defaults to `anthropic/claude-3.5-sonnet`
- User can override with their own OpenRouter key

### 4. **Streaming Responses** 📡

- Server-Sent Events (SSE) from container
- Real-time streaming to Next.js server
- Responses saved to database
- Tool calls and file edits tracked

### 5. **Modular Tools** 🛠️

- Tools in separate file (`agent-tools.ts`)
- Easy to add new tools
- Type-safe with Zod schemas
- Security whitelists for commands

### 6. **Enhanced System Prompt** 📝

- Detailed working strategy
- Clear tool documentation
- Best practices guidance
- Step-by-step methodology

## Implementation Files

### Container Files

```
container/agent-bridge/
├── agent-executor.ts    # AI agent execution engine
├── agent-tools.ts       # Modular tool definitions
├── server.ts            # HTTP + WebSocket server
└── package.json         # Dependencies (ai, @openrouter/ai-sdk-provider, zod)
```

### Server Files

```
lib/agents/
└── agent-runner.ts      # Container lifecycle management

app/api/agents/[id]/
├── start/route.ts       # POST - Start agent (creates container)
├── resume/route.ts      # POST - Resume agent (uses existing container)
├── chat/route.ts        # POST - Send message to agent
└── route.ts             # DELETE - Stop agent (destroys container)
```

### Database Schema

```prisma
model Agent {
  // ... existing fields
  model           String  @default("anthropic/claude-3.5-sonnet")
  // ... rest of fields
}
```

## Available Tools

### File Operations

- `read_file` - Read file contents
- `write_file` - Create/modify files (auto-creates directories)
- `list_directory` - List directory contents

### Search

- `search_files` - Ripgrep-powered search with patterns & case-sensitivity

### Git Operations

- `git_status` - View modified files
- `git_diff` - View changes (staged/unstaged)
- `git_log` - View commit history

### Command Execution

- `run_command` - Execute whitelisted shell commands

## API Flow

### Starting an Agent

```typescript
POST /api/agents/{id}/start
→ Creates container with:
  - GITHUB_TOKEN (for cloning)
  - OPENROUTER_API_KEY (for AI)
  - AGENT_MODEL (model to use)
  - GIT_USER_NAME / GIT_USER_EMAIL
→ Waits for repo clone
→ POSTs to container: /agent/execute
→ Streams response back
→ Saves to database
```

### Resuming an Agent

```typescript
POST /api/agents/{id}/resume
Body: { newTask: "Fix the bug in..." }
→ Checks container exists ✅
→ POSTs to container: /agent/chat
→ Maintains conversation context
→ Streams response back
→ Updates database
```

### Stopping an Agent

```typescript
DELETE /api/agents/{id}
→ Stops and removes container
→ Releases allocated port
→ Updates status to IDLE
```

## Environment Variables

```env
# Required for agent execution
OPENROUTER_API_KEY=your_key_here

# Container settings
DEFAULT_CONTAINER_MEMORY=2147483648  # 2GB
DEFAULT_CONTAINER_CPU=1000000000     # 1 CPU
```

## Security Features

1. **Path Traversal Protection**: All file paths sanitized
2. **Command Whitelist**: Only approved commands can execute
3. **Timeout Limits**: 30s for commands, 15 steps for AI
4. **Container Isolation**: Each agent in separate container
5. **Port Allocation**: Dynamic port assignment with retries

## Future Enhancements

### Easy to Add

- More tools (database queries, API calls, etc.)
- Streaming to frontend (WebSocket)
- Tool usage analytics
- Cost tracking per agent
- Multi-model support per step
- Memory/context compression for long conversations

### Tools to Consider

```typescript
// Database tools
-query_database -
  update_schema -
  // API tools
  make_http_request -
  call_external_api -
  // Analysis tools
  run_linter -
  run_type_check -
  analyze_performance -
  // Deployment tools
  build_project -
  run_tests -
  create_pr;
```

## Benefits of Option A

✅ Complete isolation - API keys never leave container
✅ True autonomy - Agent can work independently
✅ Scalable - One container = one agent
✅ Stateful - Container maintains filesystem between tasks
✅ Fast resume - No container recreation overhead
✅ Security - Each agent sandboxed
✅ Flexible - Easy to add new tools and capabilities

## Usage Example

```typescript
// 1. Create agent
const agent = await prisma.agent.create({
  data: {
    name: "Bug Fixer",
    task: "Fix the authentication bug in login.ts",
    githubRepo: "owner/repo",
    sourceBranch: "main",
    targetBranch: "fix/auth-bug",
    model: "anthropic/claude-3.5-sonnet",
    userId: user.id,
  },
});

// 2. Start agent (creates container, clones repo, executes)
await fetch(`/api/agents/${agent.id}/start`, { method: "POST" });

// 3. Resume with more context (uses existing container)
await fetch(`/api/agents/${agent.id}/resume`, {
  method: "POST",
  body: JSON.stringify({
    newTask: "Also update the tests to cover the fix",
  }),
});

// 4. Stop when done (destroys container)
await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
```

## Testing the Implementation

```bash
# 1. Generate Prisma client
npx prisma generate

# 2. Rebuild container with new dependencies
npm run build-container

# 3. Start an agent via API
curl -X POST http://localhost:3000/api/agents/{id}/start

# 4. Check container logs
docker logs agent-{id}

# 5. Resume the agent
curl -X POST http://localhost:3000/api/agents/{id}/resume \
  -H "Content-Type: application/json" \
  -d '{"newTask": "Add more features"}'
```

## Monitoring

```bash
# View agent container
docker ps | grep agent-

# Stream agent logs
docker logs -f agent-{id}

# Check agent status
curl http://localhost:{agentPort}/agent/status

# Health check
curl http://localhost:{agentPort}/health
```

---

**Implementation Complete!** 🎉

The autonomous agent system is now fully functional with:

- ✅ AI running in containers
- ✅ Persistent containers (no restarts on resume)
- ✅ Model selection per agent
- ✅ Modular tool system
- ✅ Enhanced system prompts
- ✅ Streaming responses
- ✅ Complete isolation and security

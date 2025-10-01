# Autonomous Coding Agents

## Overview

The Agents feature allows you to create autonomous coding agents that can work on your GitHub repositories. These agents:

- Clone repositories from your linked GitHub account
- Execute coding tasks autonomously
- Track all file changes with diffs
- Log all tool calls and actions
- Push changes to a new branch for review
- Support queued instructions while running

## How It Works

### 1. Create an Agent

Navigate to the Agents page and click "New Agent". You'll need to provide:

- **Agent Name**: A descriptive name for your agent
- **Task Description**: What you want the agent to do (e.g., "Refactor all React components to use TypeScript")
- **GitHub Repository**: Select from your linked repositories
- **Source Branch**: The branch to work from (default: main)
- **Target Branch**: The branch to push changes to (e.g., "agent-refactor")

### 2. Start the Agent

Once created, click "Start" to begin execution. The agent will:

1. **Clone**: Clone the repository into an isolated container
2. **Run**: Execute the task autonomously using AI
3. **Track**: Record all file changes and tool calls
4. **Remember**: Initialize conversation history for context
5. **Complete**: Mark as completed when done

### 3. Monitor Progress

The agent detail page shows:

- **Left Panel**: Diff viewer showing all edited files
  - Browse through edited files
  - View side-by-side diffs
  - See exactly what changed

- **Right Panel**: Dual-tab interface
  - **Activity Tab**: System logs and tool calls with timestamps
  - **Chat Tab**: Full conversation history with the agent

### 4. Chat with Your Agent

**NEW!** You can now have contextual conversations with your agent:

**During Execution:**
- Switch to Chat tab
- Ask "What are you doing?"
- Get real-time explanations
- Guide with additional context

**After Completion:**
- Ask "Why did you make these changes?"
- Request "Explain the pattern you used"
- Get insights into decisions made
- Understand the codebase better

### 5. Resume with Context

**NEW!** When an agent completes, you can resume it with a new task while maintaining full context:

```
Original Task: "Refactor components to TypeScript"
[Agent completes, modifies 8 files]

Chat: "What approach did you use?"
[Agent explains TypeScript conversion strategy]

Resume: "Add PropTypes for backward compatibility"
[Agent REMEMBERS the 8 files and adds PropTypes to them]
```

The agent:
- Remembers all previous file changes
- Knows what it already accomplished
- Builds upon its previous work
- Maintains consistency across iterations

### 6. Queue Instructions (While Running)

While an agent is running, you can:

- Send additional instructions via Activity tab
- Instructions are queued and processed in order
- Agent continues working without interruption

### 7. Push to GitHub

When the agent completes:

1. Click "Push to GitHub"
2. Changes are committed to the target branch
3. Branch is created if it doesn't exist
4. You can review the changes on GitHub
5. Create a PR when ready to merge

## Agent Architecture

### Container Isolation

Each agent runs in an isolated Docker container with:

- Full repository clone
- No code execution (files only)
- Persistent storage
- Agent bridge for communication

### GitHub Integration

- Uses your linked GitHub account
- Requires GitHub OAuth connection
- Pushes using your credentials
- Creates commits in your name

### Security

- Agents cannot execute code
- Container isolation prevents side effects
- All changes reviewed before merge
- Full audit trail of all actions

## Conversation & Context

### Persistent Memory

Every agent maintains a complete conversation history that includes:
- Initial task assignment
- All chat messages (user and agent)
- Resume tasks
- Execution logs

This history is preserved across:
- Page refreshes
- Multiple sessions
- Days or weeks of iteration

### Contextual Intelligence

When you chat with an agent or resume it, the agent has access to:
- All previous conversations
- Files it previously edited
- Decisions it made and why
- Original goals and context
- Current repository state

### Use Cases

**Iterative Development:**
```
Round 1: "Refactor authentication"
Round 2: "Add rate limiting" (knows auth structure)
Round 3: "Add OAuth support" (knows both previous changes)
```

**Learning & Documentation:**
```
Task: "Migrate to new framework"
Chat: "Explain your migration strategy"
Chat: "What are the breaking changes?"
Resume: "Add migration guide documentation"
```

**Code Review:**
```
Task: "Update API endpoints"
Chat: "Are these backward compatible?"
Chat: "What should we deprecate?"
Resume: "Add deprecation warnings"
```

## API Endpoints

### Agent Management

- `GET /api/agents` - List all agents
- `POST /api/agents` - Create new agent
- `GET /api/agents/:id` - Get agent details
- `DELETE /api/agents/:id` - Delete agent
- `PATCH /api/agents/:id` - Update agent

### Agent Actions

- `POST /api/agents/:id/start` - Start agent execution
- `POST /api/agents/:id/instruct` - Add instruction to queue
- `POST /api/agents/:id/push` - Push changes to GitHub

### Conversation (NEW)

- `POST /api/agents/:id/chat` - Send contextual message to agent
- `GET /api/agents/:id/chat` - Get conversation history
- `POST /api/agents/:id/resume` - Resume agent with new task (maintains context)

## Database Schema

```prisma
model Agent {
  id                  String        @id @default(auto()) @map("_id") @db.ObjectId
  name                String
  task                String
  githubRepo          String
  sourceBranch        String        @default("main")
  targetBranch        String
  containerId         String?
  agentPort           Int?
  status              AgentStatus   @default(IDLE)
  toolCalls           String?       // JSON array
  filesEdited         String?       // JSON array with diffs
  errorMessage        String?
  conversationHistory String?       // JSON array (NEW - conversation context)
  instructionQueue    String?       // JSON array
  userId              String        @db.ObjectId
  user                User          @relation(fields: [userId], references: [id])
  startedAt           DateTime?
  completedAt         DateTime?
  pushedAt            DateTime?
  lastMessageAt       DateTime?     // NEW - last interaction timestamp
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
}

enum AgentStatus {
  IDLE
  CLONING
  RUNNING
  COMPLETED
  ERROR
  PUSHING
}
```

## UI Components

### Agents Dashboard (`/dashboard/agents`)

- List of all agents
- Status badges
- Create new agent
- Quick actions (Start, Delete)

### Agent Detail Page (`/dashboard/agents/:id`)

- Split view: Diffs (left) + Activity log (right)
- File browser for edited files
- Diff viewer with syntax highlighting
- Tool call timeline
- Instruction input (while running)
- Push to GitHub button (when completed)

## Future Enhancements

- [ ] Multi-step agent workflows
- [ ] Agent templates for common tasks
- [ ] Automatic PR creation
- [ ] Code review integration
- [ ] Agent collaboration (multiple agents on same repo)
- [ ] Custom tool integration
- [ ] Agent scheduling
- [ ] Rollback functionality
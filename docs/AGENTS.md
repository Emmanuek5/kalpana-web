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
4. **Complete**: Mark as completed when done

### 3. Monitor Progress

The agent detail page shows:

- **Left Panel**: Diff viewer showing all edited files
  - Browse through edited files
  - View side-by-side diffs
  - See exactly what changed

- **Right Panel**: Activity log
  - All tool calls and actions
  - Timestamps for each action
  - Real-time updates

### 4. Queue Instructions

While an agent is running, you can:

- Send additional instructions
- Instructions are queued and processed in order
- Agent continues working without interruption

### 5. Push to GitHub

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

## Database Schema

```prisma
model Agent {
  id               String        @id @default(auto()) @map("_id") @db.ObjectId
  name             String
  task             String
  githubRepo       String
  sourceBranch     String        @default("main")
  targetBranch     String
  containerId      String?
  agentPort        Int?
  status           AgentStatus   @default(IDLE)
  toolCalls        String?       // JSON array
  filesEdited      String?       // JSON array with diffs
  errorMessage     String?
  instructionQueue String?       // JSON array
  userId           String        @db.ObjectId
  user             User          @relation(fields: [userId], references: [id])
  startedAt        DateTime?
  completedAt      DateTime?
  pushedAt         DateTime?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
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
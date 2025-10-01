# Agent Conversation Context & Memory

## Overview

Agents now maintain full conversation context across their entire lifecycle. You can chat with agents, ask questions, and resume them with new tasks - they'll remember everything from previous interactions.

## Key Features

### 1. Persistent Conversation History

Every interaction with an agent is stored and maintained:
- Initial task assignment
- Questions you ask
- Agent's responses
- Resume commands with new tasks
- Complete execution logs

### 2. Contextual Chat

**Chat with Running Agents:**
- Ask questions about what it's doing
- Get explanations of changes
- Discuss the codebase
- Guide the agent with additional context

**Chat with Completed Agents:**
- Ask about what was done
- Understand the changes made
- Get insights into the codebase
- Request clarifications

### 3. Resume with Context

When an agent completes its task, you can resume it with a new task while maintaining full context:

```
Original Task: "Add TypeScript types to all components"
[Agent completes]

Resume Task: "Now add JSDoc comments to all typed functions"
[Agent remembers the files it modified and continues from there]
```

The agent will:
- Remember all previous file changes
- Know what it already accomplished
- Build upon its previous work
- Maintain consistency across iterations

## How It Works

### Database Schema

```prisma
model Agent {
  // ... other fields
  conversationHistory String?   // JSON array of messages
  lastMessageAt       DateTime? // Last interaction timestamp
}
```

Each message includes:
```typescript
{
  role: "user" | "assistant",
  content: string,
  timestamp: string,
  type?: "initial_task" | "resume_task" | "execution" | "chat"
}
```

### API Endpoints

#### Chat with Agent
**POST** `/api/agents/:id/chat`
```json
{
  "message": "What files did you change?"
}
```

The agent receives:
- Full conversation history
- Current repository state
- Previous file changes
- Original task context

Response is streamed back with AI-powered answers.

#### Resume Agent
**POST** `/api/agents/:id/resume`
```json
{
  "newTask": "Add unit tests for the refactored components"
}
```

Starts a new execution with:
- All previous conversation context
- Knowledge of previous changes
- Continuity from last run

#### Get Conversation History
**GET** `/api/agents/:id/chat`

Returns complete conversation history.

## UI Features

### Split Panel Interface

**Activity Tab:**
- Tool calls and system actions
- Function executions
- Technical logs
- Timestamps

**Chat Tab:**
- Full conversation history
- User messages (right-aligned, green)
- Agent responses (left-aligned)
- Real-time streaming responses

### Context-Aware Input

The input adapts based on agent status:

**When Running:**
- "Chat with the agent"
- Send messages to running agent
- Get real-time responses

**When Completed/Idle:**
- "Resume with new task or ask questions"
- Two buttons:
  - **Resume Agent**: Starts new execution with context
  - **Ask**: Chat without re-running

### Visual Indicators

- Message count badge in Chat tab: `Chat (5)`
- Timestamp on every message
- Different styling for user vs agent messages
- Loading states for streaming responses

## Example Workflows

### Workflow 1: Iterative Development

```
1. Create agent: "Refactor authentication system"
   → Agent completes, edits 5 files

2. Chat: "What approach did you use?"
   → Agent explains the refactoring strategy

3. Resume: "Add error handling to all auth functions"
   → Agent builds on previous changes

4. Chat: "Can you show me what error types you added?"
   → Agent discusses the implementation
```

### Workflow 2: Code Review

```
1. Agent completes task: "Update API endpoints"

2. Chat: "Why did you change the user endpoint?"
   → Agent explains the reasoning

3. Chat: "Are these changes backward compatible?"
   → Agent analyzes and responds

4. Resume: "Add deprecation warnings for old endpoints"
   → Agent adds warnings while maintaining compatibility
```

### Workflow 3: Learning & Documentation

```
1. Agent completes: "Migrate to new state management"

2. Chat: "What patterns did you use?"
   → Agent explains patterns

3. Chat: "Generate documentation for the changes"
   → Agent creates docs based on its work

4. Resume: "Add inline comments explaining the patterns"
   → Agent adds educational comments
```

## Benefits

### 1. Continuity
- No need to repeat context
- Agent builds on previous work
- Seamless multi-step tasks

### 2. Transparency
- Full audit trail
- Understand agent decisions
- Ask clarifying questions anytime

### 3. Flexibility
- Adjust direction mid-task
- Resume with new requirements
- Iterative refinement

### 4. Learning
- Ask agent to explain its work
- Understand codebase changes
- Get insights into best practices

## Technical Implementation

### Context Passing

When executing a task, the agent receives:

```typescript
{
  systemPrompt: `
    You are an autonomous coding agent working on: ${githubRepo}
    
    Original Task: ${originalTask}
    
    Files you've edited:
    - src/auth/login.ts
    - src/auth/signup.ts
    
    Conversation History:
    ${previousMessages}
    
    User's latest message: ${currentMessage}
  `,
  messages: conversationHistory,
  tools: agentTools
}
```

### State Persistence

After each interaction:
1. User message added to history
2. Agent processes with full context
3. Agent response added to history
4. History saved to database
5. UI updates in real-time

### Memory Management

- Conversation history stored as JSON
- Efficient retrieval with pagination
- Automatic context summarization (future)
- Clean old conversations (optional)

## Future Enhancements

- [ ] Automatic context summarization for long conversations
- [ ] Conversation branching (create new threads)
- [ ] Export conversation as documentation
- [ ] Share conversation links
- [ ] Conversation search and filtering
- [ ] Context-aware suggestions
- [ ] Multi-agent conversations
- [ ] Memory optimization for long-running agents

## Best Practices

### 1. Clear Initial Tasks
Start with a well-defined task that sets the context.

### 2. Ask Before Resuming
Chat with the agent to understand its work before giving it more tasks.

### 3. Iterative Refinement
Use resume for building on previous work, not for unrelated tasks.

### 4. Verify Context
Check the conversation history to ensure the agent has the right context.

### 5. Save Conversations
Important conversations are automatically saved - use them as documentation.

## Conclusion

Agent conversation context transforms autonomous coding from one-shot tasks to continuous, collaborative development. Agents become persistent team members that remember, learn, and build on their previous work.
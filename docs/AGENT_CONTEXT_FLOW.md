# Agent Conversation Context - Visual Flow Guide

## Overview

Visual guide to understanding how conversation context flows through the agent system.

## UI Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Detail Page                                          │
│  ┌─────────────────────┐  ┌──────────────────────────────┐ │
│  │  Diff Viewer (Left) │  │  Right Panel                 │ │
│  │                     │  │  ┌────────┬────────┐         │ │
│  │  File Browser       │  │  │Activity│  Chat  │         │ │
│  │  ├─ src/auth.ts    │  │  └────────┴────────┘         │ │
│  │  ├─ src/login.ts   │  │                              │ │
│  │  └─ src/signup.ts  │  │  💬 Conversation Display     │ │
│  │                     │  │  ┌──────────────────────┐   │ │
│  │  Diff Display       │  │  │ User: What did you   │   │ │
│  │  ┌─────────────────┐│  │  │       change?        │   │ │
│  │  │ - old line      ││  │  └──────────────────────┘   │ │
│  │  │ + new line      ││  │  ┌──────────────────────┐   │ │
│  │  │ - old line      ││  │  │🤖 I refactored the    │   │ │
│  │  │ + new line      ││  │  │  authentication...    │   │ │
│  │  └─────────────────┘│  │  └──────────────────────┘   │ │
│  │                     │  │                              │ │
│  └─────────────────────┘  │  Input Box                   │ │
│                            │  [Type message...]  [Send]   │ │
│                            │  [Resume Agent]              │ │
│                            └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Conversation Flow

### Initial Agent Creation

```
User Creates Agent
       ↓
   ┌───────────────────────┐
   │ Agent Model Created   │
   │ conversationHistory:  │
   │ []                    │
   └───────────────────────┘
       ↓
   Start Agent
       ↓
   ┌───────────────────────┐
   │ Add Initial Task      │
   │ conversationHistory:  │
   │ [{                    │
   │   role: "user",       │
   │   content: task,      │
   │   type: "initial"     │
   │ }]                    │
   └───────────────────────┘
       ↓
   Execute with Context
```

### Chat During Execution

```
Agent Running
       ↓
User Sends Message
       ↓
   ┌─────────────────────────────────┐
   │ POST /api/agents/:id/chat       │
   │                                 │
   │ 1. Load conversation history    │
   │ 2. Add user message             │
   │ 3. Build context prompt         │
   │ 4. Stream AI response           │
   │ 5. Add assistant message        │
   │ 6. Save to database            │
   └─────────────────────────────────┘
       ↓
   ┌───────────────────────┐
   │ Updated History:      │
   │ [                     │
   │   {initial_task},     │
   │   {user_message},     │
   │   {assistant_reply}   │
   │ ]                     │
   └───────────────────────┘
       ↓
Display in Chat Tab
```

### Resume After Completion

```
Agent Completed
       ↓
User Switches to Chat Tab
       ↓
User Types New Task
       ↓
Clicks "Resume Agent"
       ↓
   ┌─────────────────────────────────┐
   │ POST /api/agents/:id/resume     │
   │                                 │
   │ 1. Load full conversation       │
   │ 2. Add resume task              │
   │ 3. Create new container         │
   │ 4. Clone repo                   │
   │ 5. Execute with FULL CONTEXT    │
   └─────────────────────────────────┘
       ↓
   ┌───────────────────────┐
   │ Agent Knows:          │
   │ - Original task       │
   │ - Files modified      │
   │ - All conversations   │
   │ - New task context    │
   └───────────────────────┘
       ↓
Execution with Memory
```

## Data Structure

### Message Object

```typescript
{
  role: "user" | "assistant",
  content: string,
  timestamp: "2025-09-30T10:00:00Z",
  type?: "initial_task" | "resume_task" | "execution" | "chat"
}
```

### Complete Conversation Example

```json
{
  "conversationHistory": [
    {
      "role": "user",
      "content": "Refactor authentication system",
      "timestamp": "2025-09-30T10:00:00Z",
      "type": "initial_task"
    },
    {
      "role": "assistant",
      "content": "Analyzing repository and executing task...",
      "timestamp": "2025-09-30T10:00:05Z",
      "type": "execution"
    },
    {
      "role": "user",
      "content": "What approach did you use?",
      "timestamp": "2025-09-30T10:15:00Z",
      "type": "chat"
    },
    {
      "role": "assistant",
      "content": "I converted the authentication to use JWT tokens with refresh token rotation...",
      "timestamp": "2025-09-30T10:15:02Z",
      "type": "chat"
    },
    {
      "role": "user",
      "content": "Add rate limiting to auth endpoints",
      "timestamp": "2025-09-30T10:20:00Z",
      "type": "resume_task"
    },
    {
      "role": "assistant",
      "content": "Executing with context from previous authentication refactoring...",
      "timestamp": "2025-09-30T10:20:05Z",
      "type": "execution"
    }
  ]
}
```

## Context Building

### System Prompt Construction

When agent receives a message, the system builds context:

```
System Prompt:
─────────────────────────────────────────────
You are an autonomous coding agent working on:
Repository: user/my-project

Original Task: {initial_task}

Files you've edited:
- src/auth/login.ts (refactored JWT implementation)
- src/auth/signup.ts (added token generation)
- src/auth/middleware.ts (added auth middleware)

Conversation History:
{all_previous_messages}

The user is continuing the conversation with you.
You have full context of your previous work.

User's Current Message: {current_message}
─────────────────────────────────────────────
```

## User Journey Map

### Journey 1: First-Time User

```
1. Create Agent
   └→ Enter task: "Add TypeScript to components"
   
2. Agent Runs
   └→ Watch progress in Activity tab
   
3. Agent Completes
   └→ See 8 files modified
   
4. Switch to Chat
   └→ Ask: "Why did you change the PropTypes?"
   
5. Agent Explains
   └→ "I converted PropTypes to TypeScript interfaces..."
   
6. Resume Agent
   └→ New task: "Add JSDoc comments to typed components"
   
7. Agent Resumes
   └→ Knows which 8 files to document
   
8. Success!
   └→ Progressive improvement with context
```

### Journey 2: Iterative Development

```
Round 1: "Refactor state management"
         ↓
      Completes
         ↓
      Chat: "What pattern did you use?"
         ↓
      "I used Redux Toolkit with slices..."
         ↓
Round 2: "Add Redux DevTools integration"
         ↓
      (Knows Redux Toolkit is already set up)
         ↓
      Adds DevTools to existing setup
         ↓
      Chat: "How do I use the DevTools?"
         ↓
      Gets specific instructions
```

### Journey 3: Learning & Exploration

```
Agent: Implements feature
       ↓
You:  "Explain each file you changed"
       ↓
Agent: Provides detailed breakdown
       ↓
You:  "Why did you choose this pattern?"
       ↓
Agent: Explains architectural decisions
       ↓
You:  "Add comments explaining the pattern"
       ↓
Agent: Adds educational comments
       ↓
Result: Self-documenting code + learning
```

## State Transitions

```
┌──────┐  start   ┌─────────┐  complete  ┌───────────┐
│ IDLE │ ───────→ │ RUNNING │ ─────────→ │ COMPLETED │
└──────┘          └─────────┘            └───────────┘
    ↑                  ↑                        │
    │                  │                        │
    └──────────────────┴────────────────────────┘
              resume with context
              
During any state:
- Chat available
- Context maintained
- History preserved
```

## Message Flow Sequence

```
┌────┐            ┌─────┐           ┌──────────┐        ┌────────┐
│User│            │ UI  │           │   API    │        │   DB   │
└─┬──┘            └──┬──┘           └────┬─────┘        └───┬────┘
  │                  │                   │                  │
  │ Type message     │                   │                  │
  │─────────────────→│                   │                  │
  │                  │ POST /chat        │                  │
  │                  │──────────────────→│                  │
  │                  │                   │ Load history     │
  │                  │                   │─────────────────→│
  │                  │                   │                  │
  │                  │                   │ History          │
  │                  │                   │←─────────────────│
  │                  │                   │                  │
  │                  │                   │ Build context    │
  │                  │                   │ Call AI API      │
  │                  │                   │ Stream response  │
  │                  │                   │                  │
  │                  │ Stream chunks     │                  │
  │                  │←──────────────────│                  │
  │                  │                   │                  │
  │ Display response │                   │ Save updated     │
  │←─────────────────│                   │ history          │
  │                  │                   │─────────────────→│
  │                  │                   │                  │
  │                  │                   │ Saved            │
  │                  │                   │←─────────────────│
```

## Context Preservation

### Across Page Refreshes

```
1. User refreshes page
   ↓
2. UI calls GET /api/agents/:id
   ↓
3. Agent data includes conversationHistory
   ↓
4. UI parses and displays conversation
   ↓
5. Full context restored
```

### Across Multiple Sessions

```
Session 1: Day 1
- Create agent
- Complete initial task
- Chat about results
→ Save conversation

Session 2: Day 2
- Open same agent
- Load conversation history
- Resume with new task
→ Agent remembers Day 1 work

Session 3: Day 3
- Open agent again
- Full history available
- Continue iterating
→ Perfect continuity
```

## Key Interactions

### Ask Question (No Execution)

```
User in Chat tab → Type question → Click "Ask"
                                      ↓
                            POST /api/agents/:id/chat
                                      ↓
                              AI responds with context
                                      ↓
                              No new execution
                                      ↓
                           Conversation updated
```

### Resume Agent (New Execution)

```
User in Chat tab → Type task → Click "Resume Agent"
                                       ↓
                           POST /api/agents/:id/resume
                                       ↓
                              New container created
                                       ↓
                              Repository cloned
                                       ↓
                         Agent executes with full context
                                       ↓
                            Conversation updated
                                       ↓
                              Results saved
```

## Best Practices Workflow

```
1. Start with Clear Task
   └→ "Refactor components to TypeScript"

2. Monitor Execution
   └→ Watch in Activity tab

3. Review Changes
   └→ Check Diff viewer

4. Ask Questions
   └→ Switch to Chat tab
   └→ "What patterns did you use?"

5. Verify Understanding
   └→ "Can you explain the changes to UserProfile?"

6. Resume with Related Task
   └→ "Add PropTypes for backward compatibility"

7. Continue Iteration
   └→ Agent knows what to add compatibility to

8. Final Review
   └→ Review all diffs
   └→ Chat for any clarifications
   └→ Push to GitHub
```

## Conclusion

The conversation context system creates a continuous, intelligent workflow where agents become persistent collaborators that remember, learn, and build upon their previous work.

Every interaction is preserved, every decision is traceable, and every new task benefits from the complete history of what came before.
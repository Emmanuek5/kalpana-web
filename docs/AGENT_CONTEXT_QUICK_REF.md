# Agent Conversation Context - Quick Reference

## 🚀 Quick Start

### Create Agent with Context
```typescript
// Agent automatically initializes conversation history
const agent = await prisma.agent.create({
  data: {
    name: "My Agent",
    task: "Refactor components",
    githubRepo: "user/repo",
    targetBranch: "agent-changes",
    userId: session.user.id
  }
});
```

### Chat with Agent
```typescript
// POST /api/agents/:id/chat
{
  "message": "What files did you change?"
}
// Response: Streaming AI answer with full context
```

### Resume Agent
```typescript
// POST /api/agents/:id/resume
{
  "newTask": "Add tests for refactored components"
}
// Agent starts new run with memory of previous work
```

## 📊 Data Structure

### Conversation Message
```typescript
interface ConversationMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string  // ISO 8601
  type?: "initial_task" | "resume_task" | "execution" | "chat"
}
```

### Agent Model (New Fields)
```prisma
conversationHistory String?   // JSON array
lastMessageAt       DateTime? // Last interaction
```

## 🎯 Common Use Cases

### 1. Ask Questions After Completion
```typescript
// Agent completes task
// User switches to Chat tab
User: "What approach did you use?"
Agent: [Explains with context of files modified]
```

### 2. Iterative Development
```typescript
Task 1: "Refactor auth"
        → Completes
Chat:   "What changed?"
        → Explains
Task 2: "Add rate limiting"
        → Knows auth structure from Task 1
```

### 3. Code Review
```typescript
Task:   "Update API endpoints"
        → Completes
Chat:   "Are these backward compatible?"
        → Agent analyzes with context
Resume: "Add deprecation warnings"
        → Agent knows which endpoints
```

## 🔌 API Reference

### Chat Endpoint
**POST** `/api/agents/:id/chat`

Request:
```json
{
  "message": "string"
}
```

Response: `text/event-stream` (streaming)

### Resume Endpoint
**POST** `/api/agents/:id/resume`

Request:
```json
{
  "newTask": "string"
}
```

Response:
```json
{
  "success": true,
  "message": "Agent resumed with new task"
}
```

### Get History
**GET** `/api/agents/:id/chat`

Response:
```json
{
  "history": [
    {
      "role": "user",
      "content": "...",
      "timestamp": "2025-09-30T10:00:00Z"
    }
  ],
  "task": "...",
  "filesEdited": [...]
}
```

## 🎨 UI Components

### Chat Tab Toggle
```typescript
const [showChat, setShowChat] = useState(false);

// Toggle between Activity and Chat
<button onClick={() => setShowChat(true)}>
  Chat ({conversation.length})
</button>
```

### Message Display
```typescript
{conversation.map((msg) => (
  <div className={msg.role === "user" ? "right" : "left"}>
    <Card>{msg.content}</Card>
    <time>{new Date(msg.timestamp).toLocaleTimeString()}</time>
  </div>
))}
```

### Context-Aware Input
```typescript
{agent.status === "COMPLETED" || agent.status === "IDLE" ? (
  <>
    <Button onClick={handleResumeAgent}>Resume Agent</Button>
    <Button onClick={handleSendChat}>Ask</Button>
  </>
) : (
  <Button onClick={handleSendChat}>Send</Button>
)}
```

## 🔄 Agent Runner Integration

### Start with Context
```typescript
async startAgent(agentId: string, githubToken: string) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  
  // Initialize conversation
  const conversationHistory = agent.conversationHistory
    ? JSON.parse(agent.conversationHistory)
    : [];
  
  // Add initial task if first run
  if (conversationHistory.length === 0) {
    conversationHistory.push({
      role: "user",
      content: agent.task,
      timestamp: new Date().toISOString(),
      type: "initial_task"
    });
  }
  
  // Execute with context
  await this.executeAgentTask(agentId, containerId, conversationHistory);
}
```

### Resume with Context
```typescript
async resumeAgent(agentId: string, newTask: string, githubToken: string) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  
  // Load existing conversation
  const conversationHistory = JSON.parse(agent.conversationHistory || "[]");
  
  // Execute with full context
  await this.executeAgentTask(agentId, containerId, conversationHistory);
}
```

## 🎯 Context Building

### System Prompt Template
```typescript
const systemPrompt = `
You are an autonomous coding agent working on: ${agent.githubRepo}

Original Task: ${agent.task}

Files you've edited:
${filesEdited.map(f => `- ${f.path}`).join('\n')}

The user is continuing the conversation with you.
You have full context of your previous work.

Maintain context from the conversation history and provide helpful responses.
`;
```

### Message Preparation
```typescript
// For AI API
const messages = conversationHistory.map(msg => ({
  role: msg.role,
  content: msg.content
  // Strip timestamps/metadata
}));
```

## 🔧 Common Patterns

### Pattern 1: Save Conversation
```typescript
// After chat response
const updatedHistory = [
  ...conversationHistory,
  { role: "user", content: message, timestamp: new Date().toISOString() },
  { role: "assistant", content: response, timestamp: new Date().toISOString() }
];

await prisma.agent.update({
  where: { id: agentId },
  data: {
    conversationHistory: JSON.stringify(updatedHistory),
    lastMessageAt: new Date()
  }
});
```

### Pattern 2: Load and Display
```typescript
// In UI component
useEffect(() => {
  const fetchAgent = async () => {
    const res = await fetch(`/api/agents/${agentId}`);
    const agent = await res.json();
    
    if (agent.conversationHistory) {
      setConversation(JSON.parse(agent.conversationHistory));
    }
  };
  
  fetchAgent();
}, [agentId]);
```

### Pattern 3: Stream Chat Response
```typescript
const handleSendChat = async () => {
  const res = await fetch(`/api/agents/${agentId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message: chatMessage })
  });
  
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    // Display chunk in UI
  }
  
  // Refresh to get saved conversation
  await fetchAgent();
};
```

## 🎨 Styling Tips

### Message Bubbles
```css
/* User message */
.user-message {
  margin-left: auto;
  background: emerald-600/20;
  border: emerald-500/30;
}

/* Agent message */
.agent-message {
  margin-right: auto;
  background: zinc-900/50;
  border: zinc-800/50;
}
```

### Chat Layout
```jsx
<div className="flex flex-col h-full">
  {/* Messages */}
  <div className="flex-1 overflow-y-auto p-4">
    {conversation.map(msg => <Message {...msg} />)}
  </div>
  
  {/* Input */}
  <div className="border-t p-4">
    <Input />
    <Button>Send</Button>
  </div>
</div>
```

## ⚡ Performance Tips

1. **Pagination** (Future)
   ```typescript
   // Load recent messages first
   const recent = conversation.slice(-50);
   ```

2. **Lazy Loading**
   ```typescript
   // Load on scroll
   const loadMore = () => {
     // Fetch older messages
   };
   ```

3. **Caching**
   ```typescript
   // Cache conversation in state
   const [conversationCache, setCache] = useState(new Map());
   ```

## 🐛 Debugging

### Check Conversation
```typescript
console.log("Conversation:", 
  JSON.parse(agent.conversationHistory || "[]")
);
```

### Verify Context
```typescript
console.log("Agent knows about:", {
  filesEdited: agent.filesEdited ? JSON.parse(agent.filesEdited) : [],
  messageCount: JSON.parse(agent.conversationHistory || "[]").length
});
```

### Test Resume
```typescript
// Check if context is passed
console.log("Executing with context:", {
  previousMessages: conversationHistory.length,
  latestTask: conversationHistory[conversationHistory.length - 1]
});
```

## 📝 Type Definitions

```typescript
// Full type definitions
interface Agent {
  id: string
  name: string
  task: string
  conversationHistory?: string
  lastMessageAt?: Date
  // ... other fields
}

interface ConversationMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
  type?: "initial_task" | "resume_task" | "execution" | "chat"
}

interface ChatRequest {
  message: string
}

interface ResumeRequest {
  newTask: string
}

interface ChatResponse {
  history: ConversationMessage[]
  task: string
  filesEdited: EditedFile[]
}
```

## ✅ Checklist

Before deploying:
- [ ] Prisma schema includes conversationHistory
- [ ] Prisma client regenerated
- [ ] Chat API endpoint created
- [ ] Resume API endpoint created
- [ ] UI has Chat tab
- [ ] Agent runner passes context
- [ ] Conversation persists across refreshes
- [ ] Resume builds on previous work

## 🎓 Learning Resources

- `AGENT_CONVERSATION_CONTEXT.md` - Full feature docs
- `CONVERSATION_CONTEXT_IMPLEMENTATION.md` - Implementation guide
- `AGENT_CONTEXT_FLOW.md` - Visual flow diagrams
- `FINAL_CONTEXT_IMPLEMENTATION_SUMMARY.md` - Complete summary

## 🆘 Troubleshooting

**Problem**: Conversation not loading
```typescript
// Check if field exists
console.log(agent.conversationHistory); // Should be string or null
```

**Problem**: Context not working in resume
```typescript
// Verify history is passed
console.log("History passed:", conversationHistory.length);
```

**Problem**: TypeScript errors
```bash
# Regenerate Prisma client
npx prisma generate

# Restart dev server
npm run dev
```

## 🚀 Next Steps

1. Try creating an agent
2. Complete a task
3. Switch to Chat tab
4. Ask a question
5. Resume with new task
6. See the magic! ✨
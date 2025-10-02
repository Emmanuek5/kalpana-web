# Checkpoint & Resume Implementation Guide

## Overview

This document describes the checkpoint/resume system for agent message generation, allowing:
1. **Progressive message saving** - Messages are saved immediately and updated during streaming
2. **Crash recovery** - Resume from last checkpoint if process crashes
3. **Graceful shutdown** - Let in-flight jobs finish or timeout
4. **SKIP LOCKED pattern** - Multiple workers can process jobs without conflicts

## Database Schema

### Message Model (Enhanced)
```prisma
model Message {
  status          String?   @default("complete") // "streaming", "complete", "error"
  checkpointData  String?   // JSON stringified checkpoint state
  updatedAt       DateTime  @updatedAt
}
```

### AgentCheckpoint Model (New)
```prisma
model AgentCheckpoint {
  id              String    @id
  workspaceId     String
  messageId       String    // Associated message being generated
  
  // Checkpoint state
  stepNumber      Int       // Current step number
  textCollected   String
  toolCalls       String    // JSON array
  toolResults     String    // JSON array
  reasoning       String
  
  // Status tracking (for SKIP LOCKED)
  status          String    // "pending", "processing", "completed", "error"
  lockedAt        DateTime?
  lockedBy        String?   // Process/worker ID
  
  // Metadata
  model           String
  maxSteps        Int
  
  @@index([status, lockedAt]) // Critical for SKIP LOCKED queries
}
```

## Implementation Flow

### 1. Start Message Generation

```typescript
// Create user message immediately
const userMessage = await prisma.message.create({
  data: {
    workspaceId,
    role: "user",
    content: JSON.stringify([{ type: "text", text: userInput }]),
  },
});

// Create assistant message with "streaming" status
const assistantMessage = await prisma.message.create({
  data: {
    workspaceId,
    role: "assistant",
    content: JSON.stringify([{ type: "text", text: "", status: "streaming" }]),
    status: "streaming", // Mark as in-progress
  },
});

// Create checkpoint for this generation
const checkpoint = await prisma.agentCheckpoint.create({
  data: {
    workspaceId,
    messageId: assistantMessage.id,
    stepNumber: 0,
    model: selectedModel,
    maxSteps: 10,
    status: "processing",
    lockedBy: process.pid.toString(), // Or worker ID
    lockedAt: new Date(),
  },
});
```

### 2. Update Checkpoint After Each Step

```typescript
// In prepareStep callback
prepareStep: async ({ stepNumber, steps }) => {
  if (checkpointId) {
    await prisma.agentCheckpoint.update({
      where: { id: checkpointId },
      data: {
        stepNumber,
        textCollected,
        toolCalls: JSON.stringify(toolCallsCollected),
        toolResults: JSON.stringify(toolResultsCollected),
        reasoning: reasoningCollected,
        updatedAt: new Date(),
      },
    });
  }
  return {};
},
```

### 3. Update Message Periodically During Streaming

```typescript
// Every 1 second during text streaming
if (now - lastDbUpdate > 1000 && assistantMessageId) {
  const currentParts = [
    { type: "text", text: textCollected, status: "streaming" },
    ...toolCallsCollected.map(tc => ({ type: "tool-call", ...tc })),
    ...toolResultsCollected.map(tr => ({ type: "tool-result", ...tr })),
  ];
  
  await prisma.message.update({
    where: { id: assistantMessageId },
    data: { 
      content: JSON.stringify(currentParts),
      status: "streaming",
    },
  });
}
```

### 4. Complete Generation

```typescript
// Mark checkpoint as completed
await prisma.agentCheckpoint.update({
  where: { id: checkpointId },
  data: {
    status: "completed",
    completedAt: new Date(),
    lockedAt: null,
    lockedBy: null,
  },
});

// Mark message as complete
await prisma.message.update({
  where: { id: assistantMessageId },
  data: {
    content: JSON.stringify(finalParts),
    status: "complete",
  },
});
```

## Resume from Checkpoint

### Worker Process to Resume Stalled Jobs

```typescript
// Find stalled checkpoints (locked > 5 minutes ago)
async function findStalledCheckpoints() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  return await prisma.agentCheckpoint.findMany({
    where: {
      status: "processing",
      lockedAt: {
        lt: fiveMinutesAgo, // Locked more than 5 minutes ago
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 10, // Process 10 at a time
  });
}

// Resume a checkpoint
async function resumeCheckpoint(checkpoint: AgentCheckpoint) {
  // Lock it for this worker (SKIP LOCKED pattern)
  const locked = await prisma.agentCheckpoint.updateMany({
    where: {
      id: checkpoint.id,
      status: "processing",
      OR: [
        { lockedAt: null },
        { lockedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
      ],
    },
    data: {
      lockedBy: process.pid.toString(),
      lockedAt: new Date(),
    },
  });
  
  if (locked.count === 0) {
    // Another worker got it
    return;
  }
  
  // Load checkpoint state
  const toolCallsCollected = JSON.parse(checkpoint.toolCalls);
  const toolResultsCollected = JSON.parse(checkpoint.toolResults);
  const textCollected = checkpoint.textCollected;
  const reasoningCollected = checkpoint.reasoning;
  
  // Resume generation from stepNumber + 1
  // ... continue with streamText from where it left off
}
```

### SKIP LOCKED Query (PostgreSQL/MongoDB)

```typescript
// For MongoDB, use findOneAndUpdate with atomic operations
const checkpoint = await prisma.$runCommandRaw({
  findAndModify: "AgentCheckpoint",
  query: {
    status: "pending",
    $or: [
      { lockedAt: null },
      { lockedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
    ],
  },
  update: {
    $set: {
      status: "processing",
      lockedBy: workerId,
      lockedAt: new Date(),
    },
  },
  new: true, // Return updated document
});
```

## Graceful Shutdown

```typescript
let isShuttingDown = false;
const activeJobs = new Set<string>();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, starting graceful shutdown...');
  isShuttingDown = true;
  
  // Wait for active jobs to finish (with timeout)
  const shutdownTimeout = setTimeout(() => {
    console.log('Shutdown timeout reached, forcing exit');
    process.exit(1);
  }, 30000); // 30 second timeout
  
  // Wait for all active jobs
  while (activeJobs.size > 0) {
    console.log(`Waiting for ${activeJobs.size} jobs to complete...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  clearTimeout(shutdownTimeout);
  console.log('All jobs completed, exiting gracefully');
  process.exit(0);
});

// Track jobs
async function processMessage(messageId: string) {
  activeJobs.add(messageId);
  try {
    // ... process message
  } finally {
    activeJobs.delete(messageId);
  }
}
```

## Benefits

### 1. **Immediate UI Feedback**
- User sees message appear immediately
- Streaming updates show progress in real-time
- On page refresh, incomplete messages are visible

### 2. **Crash Recovery**
- If server crashes, checkpoint allows resuming
- No lost work - can continue from last step
- Worker process can pick up stalled jobs

### 3. **Horizontal Scaling**
- Multiple workers can process checkpoints
- SKIP LOCKED prevents duplicate processing
- Load balancing across workers

### 4. **Graceful Degradation**
- If generation fails, partial results are saved
- User can see what was generated before failure
- Can retry from checkpoint

## Migration Steps

1. **Update Prisma Schema**
   ```bash
   npx prisma db push
   ```

2. **Update Agent Route** (Already done)
   - Save messages immediately
   - Update during streaming
   - Create checkpoints

3. **Create Resume Worker** (Optional)
   ```typescript
   // worker.ts
   setInterval(async () => {
     const stalled = await findStalledCheckpoints();
     for (const checkpoint of stalled) {
       await resumeCheckpoint(checkpoint);
     }
   }, 60000); // Check every minute
   ```

4. **Add Graceful Shutdown** (Production)
   - Handle SIGTERM
   - Track active jobs
   - Wait for completion

## Testing

1. **Test Progressive Saving**
   - Start message generation
   - Refresh page mid-stream
   - Verify incomplete message appears

2. **Test Crash Recovery**
   - Kill process during generation
   - Run resume worker
   - Verify generation continues

3. **Test SKIP LOCKED**
   - Start multiple workers
   - Create multiple pending checkpoints
   - Verify no duplicate processing

## Next Steps

1. Implement resume worker as separate process
2. Add monitoring for stalled checkpoints
3. Add retry logic with exponential backoff
4. Implement checkpoint cleanup (delete old completed checkpoints)
5. Add metrics/observability for checkpoint health

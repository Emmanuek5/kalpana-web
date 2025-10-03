/**
 * Standalone Socket.io Server for Kalpana Agents
 * Runs in a Docker container, connects to Redis, and serves WebSocket connections
 */

const { Server } = require('socket.io');
const { createServer } = require('http');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { PrismaClient } = require('@prisma/client');

const PORT = process.env.PORT || 3002;
const REDIS_URL = process.env.REDIS_URL || 'redis://host.docker.internal:6379';
const DATABASE_URL = process.env.DATABASE_URL;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

console.log('🚀 Starting Socket.io server...');
console.log(`   Port: ${PORT}`);
console.log(`   Redis: ${REDIS_URL}`);
console.log(`   Database: ${DATABASE_URL ? 'Connected' : 'Not configured'}`);
console.log(`   CORS: ${CORS_ORIGIN}`);

// Initialize Prisma
const prisma = new PrismaClient();

// Create HTTP server
const httpServer = createServer();

// Create Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Redis clients for adapter
let pubClient, subClient, redisSubscriber;

async function initializeRedis() {
  console.log('📡 Connecting to Redis...');
  
  pubClient = createClient({ url: REDIS_URL });
  subClient = createClient({ url: REDIS_URL });
  redisSubscriber = createClient({ url: REDIS_URL });
  
  pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
  subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));
  redisSubscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
  
  await Promise.all([
    pubClient.connect(),
    subClient.connect(),
    redisSubscriber.connect()
  ]);
  
  console.log('✅ Redis connected');
  
  // Set up Redis adapter for Socket.io
  io.adapter(createAdapter(pubClient, subClient));
  console.log('✅ Socket.io Redis adapter configured');
}

// In-memory state tracking
const agentStates = new Map();
const agentSnapshots = new Map();
const agentSubscribers = new Map(); // agentId -> Set<socketId>
const agentStreamOffsets = new Map(); // agentId -> last processed stream ID

function getOrCreateSnapshot(agentId) {
  if (!agentSnapshots.has(agentId)) {
    agentSnapshots.set(agentId, {
      status: 'IDLE',
      conversationHistory: [],
      toolCalls: [],
      filesEdited: [],
    });
  }
  return agentSnapshots.get(agentId);
}

function finalizeStreamingMessage(messages) {
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.streaming) {
    delete lastMessage.streaming;
  }
}

function applyEventToSnapshot(snapshot, event) {
  if (!event || !event.type) return;

  switch (event.type) {
    case 'text-delta': {
      if (!event.textDelta) return;

      const messages = snapshot.conversationHistory;
      const lastMessage = messages[messages.length - 1];

      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.streaming) {
        lastMessage.content += event.textDelta;
      } else {
        messages.push({
          role: 'assistant',
          content: event.textDelta,
          timestamp: new Date().toISOString(),
          streaming: true,
        });
      }
      break;
    }

    case 'tool-call': {
      const existing = snapshot.toolCalls.find((tc) => tc.id === event.toolCallId);
      if (!existing) {
        snapshot.toolCalls.push({
          id: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          state: 'executing',
          timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
        });
      }
      finalizeStreamingMessage(snapshot.conversationHistory);
      break;
    }

    case 'tool-result': {
      snapshot.toolCalls = snapshot.toolCalls.map((tc) =>
        tc.id === event.toolCallId
          ? { ...tc, state: 'complete', result: event.result }
          : tc
      );
      break;
    }

    case 'file-edit': {
      if (event.fileEdit) {
        snapshot.filesEdited.push(event.fileEdit);
      }
      break;
    }

    case 'status': {
      if (event.status) {
        snapshot.status = event.status;
      }
      if (event.status !== 'RUNNING') {
        finalizeStreamingMessage(snapshot.conversationHistory);
      }
      break;
    }

    case 'finish': {
      snapshot.status = 'COMPLETED';
      finalizeStreamingMessage(snapshot.conversationHistory);
      break;
    }

    case 'error': {
      snapshot.status = 'FAILED';
      finalizeStreamingMessage(snapshot.conversationHistory);
      break;
    }

    default:
      break;
  }
}

function updateAgentState(agentId, event) {
  if (!agentStates.has(agentId)) {
    agentStates.set(agentId, {
      status: 'IDLE',
      lastUpdate: Date.now(),
      pendingUpdate: false
    });
  }
  
  const state = agentStates.get(agentId);
  
  // Update status from events
  if (event.type === 'status') {
    state.status = event.status;
    state.pendingUpdate = true;
  } else if (event.type === 'finish') {
    // Finish event should mark as completed
    state.status = 'COMPLETED';
    state.pendingUpdate = true;
  } else if (event.type === 'error') {
    // Error event should mark as failed
    state.status = 'FAILED';
    state.pendingUpdate = true;
  }
  
  state.lastUpdate = Date.now();
}

async function saveAgentStateToDB(agentId) {
  const state = agentStates.get(agentId);
  if (!state || !state.pendingUpdate) return;
  
  try {
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: state.status,
        lastMessageAt: new Date()
      }
    });
    
    state.pendingUpdate = false;
    console.log(`💾 Updated database status for agent ${agentId}: ${state.status}`);
  } catch (error) {
    // Agent might have been deleted
    if (error.code === 'P2025') {
      agentStates.delete(agentId);
      console.log(`🗑️ Removed state for deleted agent ${agentId}`);
    } else {
      console.error(`❌ Error updating agent ${agentId}:`, error.message);
    }
  }
}

// Periodic database sync (every 5 seconds)
setInterval(async () => {
  for (const [agentId] of agentStates) {
    await saveAgentStateToDB(agentId);
  }
}, 5000);

async function startRedisSubscriber() {
  console.log('🚀 Starting Redis subscriber...');
  
  // Subscribe to all agent event channels
  await redisSubscriber.pSubscribe('agent:*:events', async (message, channel) => {
    try {
      const event = JSON.parse(message);
      
      // Extract agentId from channel name (agent:${agentId}:events)
      const agentId = channel.split(':')[1];
      
      if (!agentId) {
        console.error('❌ Could not extract agentId from channel:', channel);
        return;
      }
      
      // Update in-memory state
      updateAgentState(agentId, event);
      
      // Update aggregated snapshot
      const snapshot = getOrCreateSnapshot(agentId);
      applyEventToSnapshot(snapshot, event);

      // Forward events to clients for real-time updates
      io.to(`agent:${agentId}`).emit('agent-event', event);
      
      // Save to database on important events
      if (event.type === 'status' || event.type === 'finish' || event.type === 'error') {
        await saveAgentStateToDB(agentId);
      }

      try {
        const latestEntry = await pubClient.xRevRange(
          `agent:${agentId}:stream`,
          '+',
          '-',
          { COUNT: 1 }
        );
        if (latestEntry.length > 0) {
          agentStreamOffsets.set(agentId, latestEntry[0].id);
        }
      } catch (streamError) {
        console.error('⚠️ Failed to refresh stream offset:', streamError);
      }
      
      // Log for debugging (skip text-delta to reduce noise)
      if (event.type !== 'text-delta') {
        console.log(`📡 Forwarded ${event.type} event for agent ${agentId}`);
      }
    } catch (error) {
      console.error('❌ Error processing Redis message:', error);
    }
  });
  
  console.log('✅ Redis subscriber started');
}

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Client subscribes to agent
  socket.on('subscribe-agent', async (agentId) => {
    console.log(`📡 Client ${socket.id} subscribing to agent ${agentId}`);
    
    socket.join(`agent:${agentId}`);
    
    try {
      if (!agentSubscribers.has(agentId)) {
        agentSubscribers.set(agentId, new Set());
      }
      agentSubscribers.get(agentId).add(socket.id);

      console.log(`🔍 Hydrating agent ${agentId} state from Redis`);

      let snapshot = getOrCreateSnapshot(agentId);

      // Start with persisted state as baseline
      try {
        const agent = await prisma.agent.findUnique({ where: { id: agentId } });
        if (agent) {
          snapshot = {
            status: agent.status,
            conversationHistory: JSON.parse(agent.conversationHistory || '[]'),
            toolCalls: JSON.parse(agent.toolCalls || '[]'),
            filesEdited: JSON.parse(agent.filesEdited || '[]'),
          };
          agentSnapshots.set(agentId, snapshot);
        }
      } catch (dbError) {
        console.error('⚠️ Failed to load agent from database:', dbError);
      }

      // Apply events from Redis stream on top of baseline
      try {
        const streamEntries = await pubClient.xRange(
          `agent:${agentId}:stream`,
          '-',
          '+',
          { COUNT: 500 }
        );

        for (const entry of streamEntries) {
          try {
            const eventData = JSON.parse(entry.message.data);
            applyEventToSnapshot(snapshot, eventData);
            updateAgentState(agentId, eventData);
          } catch (parseError) {
            console.error('⚠️ Failed to parse stream event:', parseError);
          }
        }

        if (streamEntries.length > 0) {
          agentStreamOffsets.set(agentId, streamEntries[streamEntries.length - 1].id);
        } else if (!agentStreamOffsets.has(agentId)) {
          agentStreamOffsets.set(agentId, null);
        }
      } catch (streamError) {
        console.error('⚠️ Failed to hydrate from Redis stream:', streamError);
      }

      console.log(`📤 Sending hydrated agent-state:`, {
        agentId,
        status: snapshot.status,
        messages: snapshot.conversationHistory.length,
        toolCalls: snapshot.toolCalls.length,
        filesEdited: snapshot.filesEdited.length,
      });

      socket.emit('agent-state', {
        agentId,
        status: snapshot.status,
        conversationHistory: snapshot.conversationHistory,
        toolCalls: snapshot.toolCalls,
        filesEdited: snapshot.filesEdited,
      });
    } catch (error) {
      console.error('Error sending agent state:', error);
      socket.emit('error', { message: 'Failed to load agent state' });
    }
  });
  
  socket.on('unsubscribe-agent', (agentId) => {
    console.log(`📡 Client ${socket.id} unsubscribing from agent ${agentId}`);
    socket.leave(`agent:${agentId}`);

    if (agentSubscribers.has(agentId)) {
      const sockets = agentSubscribers.get(agentId);
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        agentSubscribers.delete(agentId);
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);

    for (const [agentId, sockets] of agentSubscribers.entries()) {
      if (sockets.delete(socket.id) && sockets.size === 0) {
        agentSubscribers.delete(agentId);
      }
    }
  });
});

// Periodic sync from Redis stream (every second)
setInterval(async () => {
  for (const [agentId, sockets] of agentSubscribers.entries()) {
    if (sockets.size === 0) continue;

    try {
      const lastId = agentStreamOffsets.get(agentId);
      const startId = lastId ? `(${lastId}` : '-';
      const streamEntries = await pubClient.xRange(
        `agent:${agentId}:stream`,
        startId,
        '+',
        { COUNT: 200 }
      );

      if (streamEntries.length === 0) {
        continue;
      }

      const snapshot = getOrCreateSnapshot(agentId);

      for (const entry of streamEntries) {
        try {
          const eventData = JSON.parse(entry.message.data);
          applyEventToSnapshot(snapshot, eventData);
          updateAgentState(agentId, eventData);

          if (eventData.type === 'status' || eventData.type === 'finish' || eventData.type === 'error') {
            await saveAgentStateToDB(agentId);
          }
        } catch (parseError) {
          console.error('⚠️ Failed to parse stream event during sync:', parseError);
        }
      }

      agentStreamOffsets.set(agentId, streamEntries[streamEntries.length - 1].id);

      io.to(`agent:${agentId}`).emit('agent-state', {
        agentId,
        status: snapshot.status,
        conversationHistory: snapshot.conversationHistory,
        toolCalls: snapshot.toolCalls,
        filesEdited: snapshot.filesEdited,
      });
    } catch (error) {
      console.error('❌ Error syncing agent state from Redis stream:', error);
    }
  }
}, 1000);

// Start server
async function start() {
  try {
    await initializeRedis();
    await startRedisSubscriber();
    
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Socket.io server listening on port ${PORT}`);
      console.log(`   WebSocket endpoint: ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  
  io.close();
  
  if (pubClient) await pubClient.quit();
  if (subClient) await subClient.quit();
  if (redisSubscriber) await redisSubscriber.quit();
  
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

start();

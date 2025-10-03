import { dockerManager } from '@/lib/docker/manager';
import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

/**
 * Get or initialize Redis client
 * Automatically ensures Redis container is running
 */
export async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }
  
  console.log('🚀 Initializing Redis...');
  
  // 1. Ensure Redis container is running (via DockerManager)
  const { port } = await dockerManager.ensureRedis();
  
  // 2. Create/reconnect Redis client
  if (!redisClient) {
    redisClient = createClient({
      url: `redis://localhost:${port}`,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis connection failed after 10 retries');
            return new Error('Redis unavailable');
          }
          return retries * 100; // Exponential backoff
        }
      }
    });
    
    redisClient.on('error', (err) => console.error('Redis error:', err));
    redisClient.on('connect', () => console.log('✅ Redis connected'));
    redisClient.on('reconnecting', () => console.log('🔄 Redis reconnecting...'));
  }
  
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  
  console.log('✅ Redis ready');
  return redisClient;
}

/**
 * Cleanup on shutdown
 */
export async function shutdownInfrastructure() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

// Cleanup on process exit
process.on('SIGTERM', async () => {
  await shutdownInfrastructure();
});

process.on('SIGINT', async () => {
  await shutdownInfrastructure();
  process.exit(0);
});

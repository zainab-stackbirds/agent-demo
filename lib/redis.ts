import Redis from 'ioredis';

// Global Redis client to reuse across the application
let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redis.on('connect', () => {
      console.log('Connected to Redis');
    });
  }

  return redis;
}

export async function closeRedisConnection() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

// Generate user-specific Redis keys
const getConversationStateKey = (userId: string) => `conversation:state:${userId}`;
const getConversationUpdatesChannel = (userId: string) => `conversation:updates:${userId}`;

export interface ConversationState {
  messages: any[];
  currentMessageIndex: number;
  status: string;
  isUserMessageInPlaceholder: boolean;
  demoModeActive: boolean;
  input: string;
}

export async function getConversationState(userId: string): Promise<ConversationState | null> {
  const client = getRedisClient();
  const data = await client.get(getConversationStateKey(userId));

  if (!data) {
    return null;
  }

  return JSON.parse(data);
}

export async function setConversationState(userId: string, state: ConversationState): Promise<void> {
  const client = getRedisClient();
  await client.set(getConversationStateKey(userId), JSON.stringify(state));

  // Publish update event to user-specific channel
  await client.publish(getConversationUpdatesChannel(userId), JSON.stringify({ type: 'state_update', data: state }));
}

export async function clearConversationState(userId: string): Promise<void> {
  const client = getRedisClient();
  await client.del(getConversationStateKey(userId));

  // Publish clear event to user-specific channel
  await client.publish(getConversationUpdatesChannel(userId), JSON.stringify({ type: 'clear', data: null }));
}

// Create a subscriber connection for SSE
let subscriberRedis: Redis | null = null;

export function getSubscriberRedis(): Redis {
  if (!subscriberRedis) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    subscriberRedis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    subscriberRedis.on('error', (err) => {
      console.error('Subscriber Redis connection error:', err);
    });
  }

  return subscriberRedis;
}

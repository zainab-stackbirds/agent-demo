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

// Constants for Redis keys
const CONVERSATION_STATE_KEY = 'conversation:state';
const CONVERSATION_MESSAGES_KEY = 'conversation:messages';

export interface ConversationState {
  messages: any[];
  currentMessageIndex: number;
  status: string;
  isUserMessageInPlaceholder: boolean;
  demoModeActive: boolean;
  input: string;
}

export async function getConversationState(): Promise<ConversationState | null> {
  const client = getRedisClient();
  const data = await client.get(CONVERSATION_STATE_KEY);
  
  if (!data) {
    return null;
  }
  
  return JSON.parse(data);
}

export async function setConversationState(state: ConversationState): Promise<void> {
  const client = getRedisClient();
  await client.set(CONVERSATION_STATE_KEY, JSON.stringify(state));
  
  // Publish update event to all subscribers
  await client.publish('conversation:updates', JSON.stringify({ type: 'state_update', data: state }));
}

export async function clearConversationState(): Promise<void> {
  const client = getRedisClient();
  await client.del(CONVERSATION_STATE_KEY);
  
  // Publish clear event to all subscribers
  await client.publish('conversation:updates', JSON.stringify({ type: 'clear', data: null }));
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

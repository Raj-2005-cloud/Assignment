import Redis from 'ioredis';
import { config } from './index';

let redisConnection: Redis | null = null;

function createRedisInstance(): Redis {
  if (config.REDIS_URL) {
    const isTls = config.REDIS_URL.startsWith('rediss://');
    return new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
    });
  }

  return new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = createRedisInstance();

    redisConnection.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redisConnection.on('connect', () => {
      console.log('✅ Redis connected');
    });
  }
  return redisConnection;
}

export function createRedisConnection(): Redis {
  return createRedisInstance();
}

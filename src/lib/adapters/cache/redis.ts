/**
 * Redis Cache Adapter — production-ready cache implementation.
 */

import Redis from 'ioredis';
import type { CacheAdapter } from './types';
import { getEnv } from '@/lib/runtime/env';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Redis');

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

class RedisCacheAdapter implements CacheAdapter {
  private client: Redis;
  private keyPrefix: string;

  constructor(config: RedisConfig = {}) {
    this.keyPrefix = config.keyPrefix || 'picocart:';

    if (config.url) {
      this.client = new Redis(config.url);
    } else {
      this.client = new Redis({
        host: config.host || 'localhost',
        port: config.port || 6379,
        password: config.password,
        db: config.db || 0,
      });
    }

    this.client.on('error', (err) => {
      logger.error('Connection error', { error: err });
    });

    this.client.on('connect', () => {
      logger.info('Connected successfully');
    });
  }

  private prefixKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(this.prefixKey(key));
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error('Get error', { error });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const prefixedKey = this.prefixKey(key);

      if (ttlSeconds) {
        await this.client.setex(prefixedKey, ttlSeconds, serialized);
      } else {
        await this.client.set(prefixedKey, serialized);
      }
    } catch (error) {
      logger.error('Set error', { error });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(this.prefixKey(key));
    } catch (error) {
      logger.error('Delete error', { error });
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const prefixedPattern = this.prefixKey(pattern);
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          prefixedPattern,
          'COUNT',
          100
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      logger.error('DeletePattern error', { error });
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.client.exists(this.prefixKey(key));
      return exists === 1;
    } catch (error) {
      logger.error('Has error', { error });
      return false;
    }
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client.set(
        this.prefixKey(key),
        '1',
        'EX',
        ttlSeconds,
        'NX',
      );
      return result === 'OK';
    } catch (error) {
      logger.error('AcquireLock error', { error });
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    try {
      await this.client.del(this.prefixKey(key));
    } catch (error) {
      logger.error('ReleaseLock error', { error });
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  getStatus(): string {
    return this.client.status;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

let instance: RedisCacheAdapter | null = null;

export function getRedisCache(): RedisCacheAdapter {
  if (!instance) {
    const portStr = getEnv('REDIS_PORT');
    const dbStr = getEnv('REDIS_DB');
    instance = new RedisCacheAdapter({
      url: getEnv('REDIS_URL'),
      host: getEnv('REDIS_HOST'),
      port: portStr ? parseInt(portStr, 10) : undefined,
      password: getEnv('REDIS_PASSWORD'),
      db: dbStr ? parseInt(dbStr, 10) : undefined,
      keyPrefix: getEnv('REDIS_KEY_PREFIX') || 'picocart:',
    });
  }
  return instance;
}

export function createRedisCache(config: RedisConfig): RedisCacheAdapter {
  return new RedisCacheAdapter(config);
}

export { RedisCacheAdapter };

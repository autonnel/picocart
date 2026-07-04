/**
 * Cloudflare KV Cache Adapter — eventually consistent, edge-distributed.
 */

import type { CacheAdapter } from './types';
import { getBinding } from '@/lib/runtime/env';
import { createLogger } from '@/lib/logger';

const logger = createLogger('CloudflareKV');

export class CloudflareKVCacheAdapter implements CacheAdapter {
  private keyPrefix: string;

  constructor(keyPrefix: string = 'picocart:') {
    this.keyPrefix = keyPrefix;
  }

  private getKV(): KVNamespace {
    const kv = getBinding<KVNamespace>('CACHE_KV');
    if (!kv) throw new Error('CACHE_KV binding not available');
    return kv;
  }

  private prefixKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.getKV().get(this.prefixKey(key), 'text');
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error('Get error', { error, key });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const options: KVNamespacePutOptions = {};
      if (ttlSeconds) {
        // KV minimum TTL is 60 seconds.
        options.expirationTtl = Math.max(ttlSeconds, 60);
      }
      await this.getKV().put(this.prefixKey(key), JSON.stringify(value), options);
    } catch (error) {
      logger.error('Set error', { error, key });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.getKV().delete(this.prefixKey(key));
    } catch (error) {
      logger.error('Delete error', { error, key });
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const prefix = this.prefixKey(pattern.replace(/\*.*$/, ''));
      let cursor: string | undefined;
      do {
        const result = await this.getKV().list({ prefix, cursor });
        if (result.keys.length > 0) {
          await Promise.all(result.keys.map((k) => this.getKV().delete(k.name)));
        }
        cursor = result.list_complete ? undefined : result.cursor;
      } while (cursor);
    } catch (error) {
      logger.error('DeletePattern error', { error, pattern });
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return (await this.getKV().get(this.prefixKey(key), 'text')) !== null;
    } catch (error) {
      logger.error('Has error', { error, key });
      return false;
    }
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    // KV is eventually consistent so this is best-effort.
    try {
      const existing = await this.get<string>(key);
      if (existing !== null) return false;
      await this.set(key, '1', ttlSeconds);
      return true;
    } catch (error) {
      logger.error('AcquireLock error', { error, key });
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    await this.delete(key);
  }
}

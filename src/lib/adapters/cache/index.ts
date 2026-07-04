// Cache adapter entry point — selects CF KV / Redis / Memory based on runtime.

export * from './types';
export * from './memory';
export * from './redis';

import { getMemoryCache } from './memory';
import { getRedisCache } from './redis';
import type { CacheAdapter } from './types';
import { isCloudflareRuntime, getEnv } from '@/lib/runtime/env';
import { createLogger } from '@/lib/logger';

const _kvMod: any = isCloudflareRuntime()
  ? await import('./cloudflare-kv')
  : null;

const logger = createLogger('Cache');

let cacheAdapter: CacheAdapter | null = null;

export function getCache(): CacheAdapter {
  if (cacheAdapter) return cacheAdapter;
  let adapter: CacheAdapter;
  if (isCloudflareRuntime()) {
    logger.info('Using Cloudflare KV adapter');
    adapter = new _kvMod!.CloudflareKVCacheAdapter();
  } else if (getEnv('REDIS_URL') || getEnv('REDIS_HOST')) {
    logger.info('Using Redis adapter');
    adapter = getRedisCache();
  } else {
    logger.info('Using Memory adapter');
    adapter = getMemoryCache();
  }
  cacheAdapter = adapter;
  return adapter;
}

export function setCache(adapter: CacheAdapter): void {
  cacheAdapter = adapter;
}

export const CACHE_TTL = {
  SHORT: 5 * 60,
  TEMPORARY: 60,
  MEDIUM: 60 * 60,
  LONG: 24 * 60 * 60,
} as const;

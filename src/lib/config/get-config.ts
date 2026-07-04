import { prisma } from '@/lib/db';
import { getCurrentTenantId } from '@/lib/tenant';
import { getEnv } from '@/lib/runtime/env';
import { getCache } from '@/lib/adapters/cache';
import { createLogger } from '@/lib/logger';

const CACHE_TTL_SEC = 300;
const logger = createLogger('AppConfig');

function cacheKey(tenantId: string, key: string): string {
  return `tenant:${tenantId}:config:${key}`;
}

/**
 * Per-tenant config lookup. Order:
 * 1. AppConfig DB row for current tenant + key
 * 2. envFallback (process.env[envFallback])
 * 3. undefined
 */
export async function getConfig<T = unknown>(
  key: string,
  envFallback?: string,
): Promise<T | undefined> {
  const tenantId = getCurrentTenantId();
  const cache = getCache();
  const cacheK = cacheKey(tenantId, key);

  const cached = await cache.get<T>(cacheK);
  if (cached !== null && cached !== undefined) return cached;

  try {
    const row = await prisma.appConfig.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (row) {
      await cache.set(cacheK, row.value, CACHE_TTL_SEC);
      return row.value as T;
    }
  } catch (error) {
    logger.error('Failed to read AppConfig', { error, key, tenantId });
  }

  if (envFallback) {
    const env = getEnv(envFallback);
    if (env !== undefined) return env as T;
  }
  return undefined;
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  const tenantId = getCurrentTenantId();
  const cache = getCache();
  await prisma.appConfig.upsert({
    where: { tenantId_key: { tenantId, key } },
    create: { tenantId, key, value: value as any },
    update: { value: value as any },
  });
  await cache.delete(cacheKey(tenantId, key));
}

export async function deleteConfig(key: string): Promise<void> {
  const tenantId = getCurrentTenantId();
  const cache = getCache();
  await prisma.appConfig
    .delete({ where: { tenantId_key: { tenantId, key } } })
    .catch(() => {
      /* ignore not-found */
    });
  await cache.delete(cacheKey(tenantId, key));
}

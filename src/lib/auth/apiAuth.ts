// API key validation (Shopify-compat header auth + Bearer token).

import crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { getCache, CACHE_TTL } from '@/lib/adapters/cache';
import { getCurrentTenantId } from '@/lib/tenant/context';

const API_KEY_CACHE_PREFIX = 'apikey:';

interface CachedApiKeyData {
  userId: string;
  tenantId: string;
  expiresAt: string | null;
  writeAccess: boolean;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildApiKeyCacheKey(keyHash: string): string {
  return `${API_KEY_CACHE_PREFIX}${keyHash}`;
}

/**
 * Validate a Bearer token or X-Shopify-Access-Token against the ApiKey table.
 * Uses cache (SHORT TTL) to avoid hitting the database on every request.
 */
export async function validateApiToken(authHeader: string | null): Promise<{
  valid: boolean;
  error?: string;
  userId?: string;
  writeAccess?: boolean;
}> {
  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }

  let token: string;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    // Treat the whole header as the raw token (Shopify-style header forwarder).
    token = authHeader.trim();
  }

  if (!token) {
    return { valid: false, error: 'Empty token' };
  }

  const keyHash = hashToken(token);
  const cache = getCache();
  const cacheKey = buildApiKeyCacheKey(keyHash);
  const currentTenant = getCurrentTenantId();

  const cached = await cache.get<CachedApiKeyData>(cacheKey);
  if (cached !== null) {
    if (cached.tenantId !== currentTenant) {
      return { valid: false, error: 'Invalid token' };
    }
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }
    return { valid: true, userId: cached.userId, writeAccess: cached.writeAccess };
  }

  // Cache miss — keyHash collisions are vanishingly rare so the lookup is
  // intentionally global; tenant alignment is enforced below.
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash, isActive: true },
    select: { id: true, userId: true, tenantId: true, expiresAt: true, writeAccess: true },
  });

  if (!apiKey) {
    return { valid: false, error: 'Invalid token' };
  }

  const cacheData: CachedApiKeyData = {
    userId: apiKey.userId,
    tenantId: apiKey.tenantId,
    expiresAt: apiKey.expiresAt ? apiKey.expiresAt.toISOString() : null,
    writeAccess: apiKey.writeAccess,
  };
  await cache.set(cacheKey, cacheData, CACHE_TTL.SHORT);

  if (apiKey.tenantId !== currentTenant) {
    return { valid: false, error: 'Invalid token' };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }

  return { valid: true, userId: apiKey.userId, writeAccess: apiKey.writeAccess };
}

export async function invalidateApiKeyCache(keyHash: string): Promise<void> {
  const cache = getCache();
  await cache.delete(buildApiKeyCacheKey(keyHash));
}

export async function invalidateAllApiKeyCaches(): Promise<void> {
  const cache = getCache();
  await cache.deletePattern(`${API_KEY_CACHE_PREFIX}*`);
}

export function createUnauthorizedResponse(error: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        message: error,
        type: 'authentication_error',
        code: 'invalid_api_key',
      },
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer',
      },
    }
  );
}

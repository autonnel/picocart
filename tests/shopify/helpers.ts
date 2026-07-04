// Shared helpers for Shopify Admin REST API tests.

import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { APIContext } from 'astro';
import { runWithTenant } from '@/lib/tenant/context';

export interface ApiKeyFixture {
  rawToken: string;
  keyHash: string;
  userId: string;
  tenantId: string;
  apiKeyId: string;
}

export async function createApiKey(
  prisma: PrismaClient,
  opts: {
    tenantId: string;
    writeAccess?: boolean;
    isActive?: boolean;
    expiresAt?: Date | null;
  },
): Promise<ApiKeyFixture> {
  const tenantId = opts.tenantId;
  await prisma.tenant.upsert({
    where: { id: tenantId },
    create: { id: tenantId },
    update: {},
  });
  const user = await prisma.user.create({
    data: {
      tenantId,
      username: `test-${crypto.randomUUID().slice(0, 8)}`,
      passwordHash: 'x',
    },
  });
  const rawToken = `tk_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const apiKey = await prisma.apiKey.create({
    data: {
      tenantId,
      userId: user.id,
      key: rawToken,
      keyHash,
      isActive: opts.isActive ?? true,
      writeAccess: opts.writeAccess ?? false,
      expiresAt: opts.expiresAt ?? null,
    },
  });
  return { rawToken, keyHash, userId: user.id, tenantId, apiKeyId: apiKey.id };
}

export interface MockContextOptions {
  url: string;
  method?: string;
  body?: unknown;
  token?: string;
  params?: Record<string, string>;
  headers?: Record<string, string>;
}

export function makeContext(opts: MockContextOptions): APIContext {
  const headers = new Headers(opts.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (opts.token) headers.set('X-Shopify-Access-Token', opts.token);
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
  };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  const request = new Request(opts.url, init);
  return {
    request,
    params: opts.params ?? {},
    url: new URL(opts.url),
    cookies: undefined as unknown as APIContext['cookies'],
    redirect: ((path: string) => Response.redirect(path)) as APIContext['redirect'],
    rewrite: (() => new Response('')) as unknown as APIContext['rewrite'],
    site: undefined,
    generator: 'test',
    props: {},
    locals: {},
    clientAddress: '127.0.0.1',
    routePattern: '',
    originPathname: opts.url,
    isPrerendered: false,
    preferredLocale: undefined,
    preferredLocaleList: undefined,
    currentLocale: undefined,
    getActionResult: (() => undefined) as APIContext['getActionResult'],
    callAction: (() => Promise.resolve({ data: undefined, error: undefined })) as APIContext['callAction'],
    session: undefined,
  } as unknown as APIContext;
}

export function asTenant<T>(tenantId: string, fn: () => Promise<T> | T): Promise<T> {
  return Promise.resolve(runWithTenant({ id: tenantId }, () => fn() as Promise<T>));
}

export async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

export async function clearCache(): Promise<void> {
  const { getCache } = await import('@/lib/adapters/cache');
  const cache = getCache();
  await cache.deletePattern('apikey:*');
}

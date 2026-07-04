import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { installTestPrisma } from '../setup/global';
import { resetDb } from '../setup/db';
import { asTenant, clearCache, createApiKey, makeContext, readJson } from './helpers';

let prisma: PrismaClient | null = null;

const GRAPHQL_URL = 'http://test/admin/api/2024-01/graphql.json';
const PRODUCTS_QUERY = 'query Products($first: Int!) { products(first: $first) { nodes { id } } }';
const ORDER_CREATE = `mutation OrderCreate($order: OrderCreateOrderInput!) {
  orderCreate(order: $order) { order { id } userErrors { field message } }
}`;

async function clearAuthState() {
  if (!prisma) return;
  await prisma.apiKey.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  await clearCache();
}

beforeAll(async () => {
  prisma = await installTestPrisma();
});

beforeEach(async () => {
  if (!prisma) return;
  await resetDb(prisma);
  await clearAuthState();
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
});

const skip = () => prisma === null;

describe('Shopify GraphQL endpoint — auth', () => {
  it('rejects missing token with 401 + Shopify error shape', async () => {
    if (skip()) return;
    const { POST } = await import('@/pages/admin/api/2024-01/graphql.json');
    const ctx = makeContext({ url: GRAPHQL_URL, method: 'POST', body: { query: PRODUCTS_QUERY, variables: { first: 1 } } });
    const res = await asTenant('default', () => POST(ctx));
    expect(res.status).toBe(401);
    const body = (await readJson(res)) as { errors: string };
    expect(typeof body.errors).toBe('string');
  });

  it('rejects invalid token with 401', async () => {
    if (skip()) return;
    const { POST } = await import('@/pages/admin/api/2024-01/graphql.json');
    const ctx = makeContext({ url: GRAPHQL_URL, method: 'POST', token: 'tk_definitely_invalid', body: { query: PRODUCTS_QUERY, variables: { first: 1 } } });
    const res = await asTenant('default', () => POST(ctx));
    expect(res.status).toBe(401);
  });

  it('rejects read-only key on a mutation with 403', async () => {
    if (skip() || !prisma) return;
    const key = await createApiKey(prisma, { tenantId: 'tA', writeAccess: false });
    const { POST } = await import('@/pages/admin/api/2024-01/graphql.json');
    const ctx = makeContext({
      url: GRAPHQL_URL,
      method: 'POST',
      token: key.rawToken,
      body: { query: ORDER_CREATE, variables: { order: { lineItems: [] } } },
    });
    const res = await asTenant('tA', () => POST(ctx));
    expect(res.status).toBe(403);
  });

  it('accepts a valid key on a query', async () => {
    if (skip() || !prisma) return;
    const key = await createApiKey(prisma, { tenantId: 'tA', writeAccess: false });
    const { POST } = await import('@/pages/admin/api/2024-01/graphql.json');
    const ctx = makeContext({
      url: GRAPHQL_URL,
      method: 'POST',
      token: key.rawToken,
      body: { query: PRODUCTS_QUERY, variables: { first: 1 } },
    });
    const res = await asTenant('tA', () => POST(ctx));
    expect(res.status).toBe(200);
    const body = (await readJson(res)) as { data: { products: { nodes: unknown[] } } };
    expect(Array.isArray(body.data.products.nodes)).toBe(true);
  });

  it('cross-tenant token usage returns 401', async () => {
    if (skip() || !prisma) return;
    const key = await createApiKey(prisma, { tenantId: 'tA', writeAccess: false });
    const { POST } = await import('@/pages/admin/api/2024-01/graphql.json');
    const ctx = makeContext({ url: GRAPHQL_URL, method: 'POST', token: key.rawToken, body: { query: PRODUCTS_QUERY, variables: { first: 1 } } });
    const res = await asTenant('tB', () => POST(ctx));
    expect(res.status).toBe(401);
  });

  it('expired key returns 401', async () => {
    if (skip() || !prisma) return;
    const key = await createApiKey(prisma, {
      tenantId: 'tA',
      writeAccess: true,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const { POST } = await import('@/pages/admin/api/2024-01/graphql.json');
    const ctx = makeContext({ url: GRAPHQL_URL, method: 'POST', token: key.rawToken, body: { query: PRODUCTS_QUERY, variables: { first: 1 } } });
    const res = await asTenant('tA', () => POST(ctx));
    expect(res.status).toBe(401);
  });
});

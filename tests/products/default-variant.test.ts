import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { installTestPrisma } from '../setup/global';
import { resetDb } from '../setup/db';
import { runWithTenant } from '@/lib/tenant/context';
import { emptyDraft } from '@/components/products/types';

vi.mock('@/lib/api-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-helpers')>(
    '@/lib/api-helpers',
  );
  return {
    ...actual,
    withAuth: (_feature: string, handler: any) => async (context: any) => {
      return handler(context, { user: { id: 'u-test' }, auth: {} });
    },
  };
});

let prisma: PrismaClient | null = null;

async function ensureTenant(tenantId: string) {
  if (!prisma) return;
  await prisma.tenant.upsert({
    where: { id: tenantId },
    create: { id: tenantId },
    update: {},
  });
}

beforeAll(async () => {
  prisma = await installTestPrisma();
});

beforeEach(async () => {
  if (!prisma) return;
  await resetDb(prisma);
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
});

const skip = () => prisma === null;

describe('emptyDraft()', () => {
  it('returns a draft containing exactly one variant titled "Default Title"', () => {
    const draft = emptyDraft();
    expect(draft.variants).toHaveLength(1);
    expect(draft.variants[0].title).toBe('Default Title');
    expect(draft.variants[0].position).toBe(0);
    expect(draft.variants[0].options).toEqual([]);
    expect(draft.variants[0].prices).toEqual([]);
    expect(draft.variants[0].inventoryQuantity).toBe(0);
  });
});

describe('POST /api/products defensive default variant', () => {
  it('creates one "Default Title" variant when payload omits variants', async () => {
    if (skip() || !prisma) return;
    await ensureTenant('tA');

    const { POST } = await import('@/pages/api/products/index');
    const request = new Request('http://test/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Simple Mug', handle: 'simple-mug' }),
    });
    const ctx = { request, params: {}, url: new URL(request.url) } as any;

    const res = await runWithTenant({ id: 'tA' }, () => POST(ctx));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { product: { id: string; variants: { title: string }[] } };
    expect(body.product.variants).toHaveLength(1);
    expect(body.product.variants[0].title).toBe('Default Title');

    const dbVariants = await prisma.productVariant.findMany({
      where: { productId: body.product.id },
    });
    expect(dbVariants).toHaveLength(1);
    expect(dbVariants[0].title).toBe('Default Title');
  });

  it('creates one "Default Title" variant when payload sends an empty variants array', async () => {
    if (skip() || !prisma) return;
    await ensureTenant('tA');

    const { POST } = await import('@/pages/api/products/index');
    const request = new Request('http://test/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Empty Mug', handle: 'empty-mug', variants: [] }),
    });
    const ctx = { request, params: {}, url: new URL(request.url) } as any;

    const res = await runWithTenant({ id: 'tA' }, () => POST(ctx));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { product: { variants: { title: string }[] } };
    expect(body.product.variants).toHaveLength(1);
    expect(body.product.variants[0].title).toBe('Default Title');
  });
});

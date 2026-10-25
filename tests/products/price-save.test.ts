import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { installTestPrisma } from '../setup/global';
import { resetDb } from '../setup/db';
import { runWithTenant } from '@/lib/tenant/context';

vi.mock('@/lib/api-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-helpers')>('@/lib/api-helpers');
  return {
    ...actual,
    withAuth: (_feature: string, handler: any) => async (context: any) =>
      handler(context, { user: { id: 'u-test' }, auth: {} }),
  };
});

vi.mock('@/lib/dashboard/currencies', () => ({
  getCurrencyConfig: async () => ({
    list: ['USD', 'EUR', 'GBP'],
    default: 'USD',
    rates: { EUR: { rate: 0.9, rounding: '99' } },
  }),
}));

let prisma: PrismaClient | null = null;

beforeAll(async () => {
  prisma = await installTestPrisma();
  if (!prisma) throw new Error('Test database is required for product price save tests');
});

beforeEach(async () => {
  await resetDb(prisma!);
  await prisma!.tenant.upsert({ where: { id: 'tA' }, create: { id: 'tA' }, update: {} });
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
});

const priceRow = (variantId: string, currencyCode: string) =>
  prisma!.variantPrice.findUnique({ where: { variantId_currencyCode: { variantId, currencyCode } } });

const payloadPrices = [
  { currencyCode: 'USD', price: '12.00', compareAtPrice: null, isManual: true },
  { currencyCode: 'EUR', price: '1.00', compareAtPrice: null, isManual: false },
  { currencyCode: 'GBP', price: '8.50', compareAtPrice: null, isManual: false },
];

describe('product save keeps prices of currencies without a rate', () => {
  it('PUT keeps an auto row of an unrated currency as a manual row', async () => {
    const product = await prisma!.product.create({ data: { tenantId: 'tA', handle: 'mug', title: 'Mug' } });
    const variant = await prisma!.productVariant.create({ data: { productId: product.id, title: 'Default Title' } });
    await prisma!.variantPrice.createMany({
      data: [
        { variantId: variant.id, currencyCode: 'USD', price: '12.00' },
        { variantId: variant.id, currencyCode: 'EUR', price: '10.99', isManual: false },
        { variantId: variant.id, currencyCode: 'GBP', price: '8.50', isManual: false },
      ],
    });

    const { PUT } = await import('@/pages/api/products/[id]');
    const request = new Request(`http://test/api/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variants: [{ id: variant.id, title: 'Default Title', prices: payloadPrices }] }),
    });
    const res = await runWithTenant({ id: 'tA' }, () =>
      PUT({ request, params: { id: product.id }, url: new URL(request.url) } as any),
    );
    expect(res.status).toBe(200);

    const gbp = await priceRow(variant.id, 'GBP');
    expect(gbp?.price.toString()).toBe('8.5');
    expect(gbp?.isManual).toBe(true);
    const eur = await priceRow(variant.id, 'EUR');
    expect(eur?.price.toString()).toBe('10.99');
    expect(eur?.isManual).toBe(false);
  });

  it('POST keeps an auto row of an unrated currency as a manual row', async () => {
    const { POST } = await import('@/pages/api/products/index');
    const request = new Request('http://test/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Cup',
        handle: 'cup',
        variants: [{ title: 'Default Title', prices: payloadPrices }],
      }),
    });
    const res = await runWithTenant({ id: 'tA' }, () => POST({ request, params: {}, url: new URL(request.url) } as any));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { product: { variants: { id: string }[] } };
    const variantId = body.product.variants[0].id;

    const gbp = await priceRow(variantId, 'GBP');
    expect(gbp?.price.toString()).toBe('8.5');
    expect(gbp?.isManual).toBe(true);
    expect((await priceRow(variantId, 'EUR'))?.isManual).toBe(false);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { runWithTenant } from '@/lib/tenant/context';
import { installTestPrisma } from '../setup/global';
import { resetDb } from '../setup/db';

const configState = vi.hoisted(() => ({
  value: { list: ['USD'], default: 'USD', rates: {} } as {
    list: string[];
    default: string;
    rates: Record<string, { rate: number; rounding: string }>;
  },
}));

vi.mock('@/lib/dashboard/currencies', () => ({
  getCurrencyConfig: async () => configState.value,
}));

let prisma: PrismaClient | null = null;
let syncAutoPrices: typeof import('@/lib/pricing/auto-price-sync').syncAutoPrices;
let PrismaProductRepository: typeof import('@/lib/repositories/product.repository').PrismaProductRepository;

beforeAll(async () => {
  prisma = await installTestPrisma();
  if (!prisma) throw new Error('Test database is required for auto-price-sync tests');
  syncAutoPrices = (await import('@/lib/pricing/auto-price-sync')).syncAutoPrices;
  PrismaProductRepository = (await import('@/lib/repositories/product.repository')).PrismaProductRepository;
});

beforeEach(async () => {
  await resetDb(prisma!);
  configState.value = {
    list: ['USD', 'EUR', 'GBP'],
    default: 'USD',
    rates: { EUR: { rate: 0.9, rounding: '99' } },
  };
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
});

async function seedVariant(prices: Array<{ currencyCode: string; price: string; compareAtPrice?: string; isManual?: boolean }>) {
  const product = await prisma!.product.create({ data: { tenantId: 'tA', handle: 'h', title: 'T' } });
  const variant = await prisma!.productVariant.create({ data: { productId: product.id, title: 'V' } });
  for (const p of prices) {
    await prisma!.variantPrice.create({ data: { variantId: variant.id, ...p } });
  }
  return variant;
}

const priceRow = (variantId: string, currencyCode: string) =>
  prisma!.variantPrice.findUnique({ where: { variantId_currencyCode: { variantId, currencyCode } } });

const sync = (scope: Parameters<typeof syncAutoPrices>[1]) =>
  runWithTenant({ id: 'tA' }, () => prisma!.$transaction((tx) => syncAutoPrices(tx, scope)));

describe('syncAutoPrices', () => {
  it('fills missing auto price', async () => {
    const v = await seedVariant([{ currencyCode: 'USD', price: '10.00' }]);
    const written = await sync({ variantIds: [v.id] });
    const row = await priceRow(v.id, 'EUR');
    expect(written).toBe(1);
    expect(row?.price.toString()).toBe('9.99');
    expect(row?.isManual).toBe(false);
  });

  it('keeps manual row', async () => {
    const v = await seedVariant([
      { currencyCode: 'USD', price: '10.00' },
      { currencyCode: 'EUR', price: '12.00', isManual: true },
    ]);
    await sync({ variantIds: [v.id] });
    const row = await priceRow(v.id, 'EUR');
    expect(row?.price.toString()).toBe('12');
    expect(row?.isManual).toBe(true);
  });

  it('converts compareAtPrice', async () => {
    const v = await seedVariant([{ currencyCode: 'USD', price: '10.00', compareAtPrice: '20.00' }]);
    await sync({ variantIds: [v.id] });
    const row = await priceRow(v.id, 'EUR');
    expect(row?.compareAtPrice?.toString()).toBe('18.99');
  });

  it('skips currency without rate', async () => {
    const v = await seedVariant([{ currencyCode: 'USD', price: '10.00' }]);
    await sync({ variantIds: [v.id] });
    expect(await priceRow(v.id, 'GBP')).toBeNull();
  });

  it('recomputes an existing auto row', async () => {
    const v = await seedVariant([
      { currencyCode: 'USD', price: '10.00' },
      { currencyCode: 'EUR', price: '1.00', isManual: false },
    ]);
    await sync({ variantIds: [v.id] });
    expect((await priceRow(v.id, 'EUR'))?.price.toString()).toBe('9.99');
  });

  it('skips variants without a default price and never touches the default row', async () => {
    const v = await seedVariant([{ currencyCode: 'EUR', price: '5.00', isManual: false }]);
    expect(await sync({ variantIds: [v.id] })).toBe(0);
    expect((await priceRow(v.id, 'EUR'))?.price.toString()).toBe('5');
  });

  it('create product triggers sync', async () => {
    const repo = new PrismaProductRepository();
    const product = await runWithTenant({ id: 'tA' }, () =>
      repo.create({
        handle: 'p',
        title: 'P',
        variants: [{ title: 'V', prices: [{ currencyCode: 'USD', price: '10.00' }] }],
      }),
    );
    const row = await priceRow(product.variants[0].id, 'EUR');
    expect(row?.price.toString()).toBe('9.99');
    expect(row?.isManual).toBe(false);
  });
});

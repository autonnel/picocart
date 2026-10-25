import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { runWithTenant } from '@/lib/tenant/context';
import { installTestPrisma } from '../setup/global';
import { resetDb } from '../setup/db';

let prisma: PrismaClient | null = null;
let saveCurrencyConfig: typeof import('@/lib/dashboard/currencies').saveCurrencyConfig;
let getCurrencyConfig: typeof import('@/lib/dashboard/currencies').getCurrencyConfig;
let setCurrencyConfig: typeof import('@/lib/dashboard/currencies').setCurrencyConfig;

beforeAll(async () => {
  prisma = await installTestPrisma();
  if (!prisma) throw new Error('Test database is required for currencies settings tests');
  const mod = await import('@/lib/dashboard/currencies');
  saveCurrencyConfig = mod.saveCurrencyConfig;
  getCurrencyConfig = mod.getCurrencyConfig;
  setCurrencyConfig = mod.setCurrencyConfig;
});

beforeEach(async () => {
  await resetDb(prisma!);
  await runWithTenant({ id: 'tA' }, () => setCurrencyConfig({ list: ['USD'], default: 'USD', rates: {} }));
});

afterAll(async () => {
  await runWithTenant({ id: 'tA' }, () => setCurrencyConfig({ list: ['USD'], default: 'USD', rates: {} }));
  if (prisma) await prisma.$disconnect();
});

const inTenant = <T>(fn: () => Promise<T>) => runWithTenant({ id: 'tA' }, fn);

async function seedVariant(handle: string, prices: Array<{ currencyCode: string; price: string; isManual?: boolean }>) {
  const product = await prisma!.product.create({ data: { tenantId: 'tA', handle, title: handle } });
  const variant = await prisma!.productVariant.create({ data: { productId: product.id, title: 'V' } });
  for (const p of prices) await prisma!.variantPrice.create({ data: { variantId: variant.id, ...p } });
  return variant;
}

const priceRow = (variantId: string, currencyCode: string) =>
  prisma!.variantPrice.findUnique({ where: { variantId_currencyCode: { variantId, currencyCode } } });

describe('saveCurrencyConfig', () => {
  it('rate change recomputes auto rows', async () => {
    const auto = await seedVariant('a', [
      { currencyCode: 'USD', price: '12.00' },
      { currencyCode: 'EUR', price: '9.99', isManual: false },
    ]);
    const manual = await seedVariant('b', [
      { currencyCode: 'USD', price: '12.00' },
      { currencyCode: 'EUR', price: '15.00', isManual: true },
    ]);
    await inTenant(() =>
      saveCurrencyConfig({ list: ['USD', 'EUR'], default: 'USD', rates: { EUR: { rate: 0.9, rounding: '99' } } }),
    );
    const saved = await inTenant(() =>
      saveCurrencyConfig({ list: ['USD', 'EUR'], default: 'USD', rates: { EUR: { rate: 0.8, rounding: '99' } } }),
    );
    expect(saved.rates.EUR.rate).toBe(0.8);
    expect((await priceRow(auto.id, 'EUR'))?.price.toString()).toBe('9.99');
    expect((await priceRow(manual.id, 'EUR'))?.price.toString()).toBe('15');
    await inTenant(() =>
      saveCurrencyConfig({ list: ['USD', 'EUR'], default: 'USD', rates: { EUR: { rate: 0.7, rounding: '99' } } }),
    );
    expect((await priceRow(auto.id, 'EUR'))?.price.toString()).toBe('8.99');
    expect((await priceRow(manual.id, 'EUR'))?.price.toString()).toBe('15');
  });

  it('changing default currency clears rates', async () => {
    const v = await seedVariant('a', [
      { currencyCode: 'USD', price: '12.00' },
      { currencyCode: 'EUR', price: '9.99', isManual: false },
    ]);
    await inTenant(() =>
      saveCurrencyConfig({ list: ['USD', 'EUR'], default: 'USD', rates: { EUR: { rate: 0.9, rounding: '99' } } }),
    );
    const saved = await inTenant(() =>
      saveCurrencyConfig({ list: ['USD', 'EUR'], default: 'EUR', rates: { USD: { rate: 1.1, rounding: 'none' } } }),
    );
    expect(saved.rates).toEqual({});
    expect((await inTenant(() => getCurrencyConfig())).rates).toEqual({});
    expect((await priceRow(v.id, 'EUR'))?.price.toString()).toBe('10.99');
    expect((await priceRow(v.id, 'USD'))?.price.toString()).toBe('12');
  });
  it('removing a rate keeps the auto rows of that currency as manual rows', async () => {
    const v = await seedVariant('a', [{ currencyCode: 'USD', price: '12.00' }]);
    const config = { list: ['USD', 'EUR', 'GBP'], default: 'USD' };
    await inTenant(() =>
      saveCurrencyConfig({
        ...config,
        rates: { EUR: { rate: 0.9, rounding: '99' }, GBP: { rate: 0.8, rounding: 'none' } },
      }),
    );
    expect((await priceRow(v.id, 'GBP'))?.isManual).toBe(false);
    await inTenant(() => saveCurrencyConfig({ ...config, rates: { EUR: { rate: 0.9, rounding: '99' } } }));
    const gbp = await priceRow(v.id, 'GBP');
    expect(gbp?.price.toString()).toBe('9.6');
    expect(gbp?.isManual).toBe(true);
    expect((await priceRow(v.id, 'EUR'))?.isManual).toBe(false);
  });

  it('clearing rates by changing the default currency keeps auto rows as manual rows', async () => {
    const v = await seedVariant('a', [{ currencyCode: 'USD', price: '12.00' }]);
    await inTenant(() =>
      saveCurrencyConfig({
        list: ['USD', 'EUR', 'GBP'],
        default: 'USD',
        rates: { EUR: { rate: 0.9, rounding: '99' }, GBP: { rate: 0.8, rounding: 'none' } },
      }),
    );
    await inTenant(() => saveCurrencyConfig({ list: ['USD', 'EUR', 'GBP'], default: 'EUR', rates: {} }));
    const rows = await prisma!.variantPrice.findMany({ where: { variantId: v.id }, orderBy: { currencyCode: 'asc' } });
    expect(rows.map((r) => [r.currencyCode, r.price.toString(), r.isManual])).toEqual([
      ['EUR', '10.99', true],
      ['GBP', '9.6', true],
      ['USD', '12', true],
    ]);
  });

  it('syncs a large catalog in one save', async () => {
    const product = await prisma!.product.create({ data: { tenantId: 'tA', handle: 'bulk', title: 'bulk' } });
    const variants = await Promise.all(
      Array.from({ length: 200 }, (_, i) =>
        prisma!.productVariant.create({ data: { productId: product.id, title: `V${i}`, position: i } }),
      ),
    );
    await prisma!.variantPrice.createMany({
      data: variants.flatMap((v, i) => {
        const rows: Array<{ variantId: string; currencyCode: string; price: string; compareAtPrice?: string; isManual?: boolean }> = [
          { variantId: v.id, currencyCode: 'USD', price: `${10 + (i % 7)}.00`, ...(i % 2 ? { compareAtPrice: '30.00' } : {}) },
        ];
        if (i % 3 === 1) rows.push({ variantId: v.id, currencyCode: 'EUR', price: '1.00', isManual: false });
        if (i % 3 === 2) rows.push({ variantId: v.id, currencyCode: 'EUR', price: '50.00', isManual: true });
        return rows;
      }),
    });
    await inTenant(() =>
      saveCurrencyConfig({ list: ['USD', 'EUR'], default: 'USD', rates: { EUR: { rate: 0.9, rounding: '99' } } }),
    );
    const rows = await prisma!.variantPrice.findMany({ where: { currencyCode: 'EUR' } });
    const byVariant = new Map(rows.map((r) => [r.variantId, r]));
    expect(rows).toHaveLength(200);
    variants.forEach((v, i) => {
      const row = byVariant.get(v.id)!;
      if (i % 3 === 2) {
        expect([row.price.toString(), row.isManual]).toEqual(['50', true]);
        return;
      }
      const expected = { 10: '9.99', 11: '9.99', 12: '10.99', 13: '11.99', 14: '12.99', 15: '13.99', 16: '14.99' }[10 + (i % 7)];
      expect([row.price.toString(), row.isManual, row.compareAtPrice?.toString() ?? null]).toEqual([
        expected,
        false,
        i % 2 ? '27.99' : null,
      ]);
    });
  });
});

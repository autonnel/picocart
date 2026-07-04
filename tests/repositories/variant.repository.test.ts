import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { runWithTenant } from '@/lib/tenant/context';
import { installTestPrisma } from '../setup/global';
import { resetDb } from '../setup/db';

let prisma: PrismaClient | null = null;
let PrismaProductRepository: typeof import('@/lib/repositories/product.repository').PrismaProductRepository;
let PrismaVariantRepository: typeof import('@/lib/repositories/variant.repository').PrismaVariantRepository;
let InsufficientInventoryError: typeof import('@/lib/repositories/variant.repository').InsufficientInventoryError;

beforeAll(async () => {
  prisma = await installTestPrisma();
  if (!prisma) return;
  PrismaProductRepository = (await import('@/lib/repositories/product.repository')).PrismaProductRepository;
  const v = await import('@/lib/repositories/variant.repository');
  PrismaVariantRepository = v.PrismaVariantRepository;
  InsufficientInventoryError = v.InsufficientInventoryError;
});

beforeEach(async () => {
  if (!prisma) return;
  await resetDb(prisma);
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
});

const skipNoDb = () => prisma === null;

describe('PrismaVariantRepository', () => {
  it('decrements inventory when trackInventory=true', async () => {
    if (skipNoDb()) return;
    const productRepo = new PrismaProductRepository();
    const variantRepo = new PrismaVariantRepository();
    const product = await runWithTenant({ id: 'tA' }, () =>
      productRepo.create({
        handle: 'h',
        title: 'T',
        trackInventory: true,
        variants: [{ title: 'V', inventoryQuantity: 5 }],
      }),
    );
    const variantId = product.variants[0].id;
    const updated = await variantRepo.decrementInventory(variantId, 2);
    expect(updated.inventoryQuantity).toBe(3);
  });

  it('does NOT decrement inventory when trackInventory=false', async () => {
    if (skipNoDb()) return;
    const productRepo = new PrismaProductRepository();
    const variantRepo = new PrismaVariantRepository();
    const product = await runWithTenant({ id: 'tA' }, () =>
      productRepo.create({
        handle: 'h',
        title: 'T',
        trackInventory: false,
        variants: [{ title: 'V', inventoryQuantity: 5 }],
      }),
    );
    const variantId = product.variants[0].id;
    const updated = await variantRepo.decrementInventory(variantId, 100);
    expect(updated.inventoryQuantity).toBe(5);
  });

  it('throws InsufficientInventoryError when stock is too low (tracked)', async () => {
    if (skipNoDb()) return;
    const productRepo = new PrismaProductRepository();
    const variantRepo = new PrismaVariantRepository();
    const product = await runWithTenant({ id: 'tA' }, () =>
      productRepo.create({
        handle: 'h',
        title: 'T',
        trackInventory: true,
        variants: [{ title: 'V', inventoryQuantity: 1 }],
      }),
    );
    const variantId = product.variants[0].id;
    await expect(variantRepo.decrementInventory(variantId, 5)).rejects.toBeInstanceOf(
      InsufficientInventoryError,
    );
  });

  it('increments inventory on refund (tracked)', async () => {
    if (skipNoDb()) return;
    const productRepo = new PrismaProductRepository();
    const variantRepo = new PrismaVariantRepository();
    const product = await runWithTenant({ id: 'tA' }, () =>
      productRepo.create({
        handle: 'h',
        title: 'T',
        trackInventory: true,
        variants: [{ title: 'V', inventoryQuantity: 4 }],
      }),
    );
    const variantId = product.variants[0].id;
    const updated = await variantRepo.incrementInventory(variantId, 3);
    expect(updated.inventoryQuantity).toBe(7);
  });

  it('lists variants ordered by position', async () => {
    if (skipNoDb()) return;
    const productRepo = new PrismaProductRepository();
    const variantRepo = new PrismaVariantRepository();
    const product = await runWithTenant({ id: 'tA' }, () =>
      productRepo.create({
        handle: 'h',
        title: 'T',
        variants: [
          { title: 'B', position: 1 },
          { title: 'A', position: 0 },
          { title: 'C', position: 2 },
        ],
      }),
    );
    const list = await runWithTenant({ id: 'tA' }, () => variantRepo.listByProduct(product.id));
    expect(list.map((v) => v.title)).toEqual(['A', 'B', 'C']);
  });
});

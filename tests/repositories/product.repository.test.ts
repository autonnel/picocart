import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { runWithTenant } from '@/lib/tenant/context';
import { installTestPrisma } from '../setup/global';
import { resetDb } from '../setup/db';

let prisma: PrismaClient | null = null;
let PrismaProductRepository: typeof import('@/lib/repositories/product.repository').PrismaProductRepository;

beforeAll(async () => {
  prisma = await installTestPrisma();
  if (!prisma) return;
  const mod = await import('@/lib/repositories/product.repository');
  PrismaProductRepository = mod.PrismaProductRepository;
});

beforeEach(async () => {
  if (!prisma) return;
  await resetDb(prisma);
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
});

const skipNoDb = () => prisma === null;

describe('PrismaProductRepository', () => {
  it('creates a product with variants, options, prices, and images in a transaction', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaProductRepository();
    const product = await runWithTenant({ id: 'tA' }, () =>
      repo.create({
        handle: 't-shirt',
        title: 'T-Shirt',
        status: 'ACTIVE',
        trackInventory: true,
        tags: ['summer', 'apparel'],
        images: [{ src: 'https://cdn/x.jpg', alt: 'red shirt' }],
        variants: [
          {
            title: 'Red / S',
            sku: 'TS-R-S',
            inventoryQuantity: 10,
            options: [
              { name: 'Color', value: 'Red', position: 0 },
              { name: 'Size', value: 'S', position: 1 },
            ],
            prices: [{ currencyCode: 'USD', price: '19.99' }],
            imagePosition: 0,
          },
        ],
      }),
    );
    expect(product.id).toBeTruthy();
    expect(product.tenantId).toBe('tA');
    expect(product.variants).toHaveLength(1);
    expect(product.variants[0].options).toHaveLength(2);
    expect(product.variants[0].prices).toHaveLength(1);
    expect(product.variants[0].imageId).toBe(product.images[0].id);
  });

  it('lists products filtered by status', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaProductRepository();
    await runWithTenant({ id: 'tA' }, async () => {
      await repo.create({ handle: 'a', title: 'A', status: 'ACTIVE' });
      await repo.create({ handle: 'b', title: 'B', status: 'DRAFT' });
      await repo.create({ handle: 'c', title: 'C', status: 'ACTIVE' });
    });
    const active = await runWithTenant({ id: 'tA' }, () => repo.list({ status: 'ACTIVE' }));
    expect(active.map((p) => p.handle).sort()).toEqual(['a', 'c']);
  });

  it('paginates with sinceId cursor', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaProductRepository();
    const ids: string[] = await runWithTenant({ id: 'tA' }, async () => {
      const out: string[] = [];
      for (let i = 0; i < 4; i++) {
        const p = await repo.create({ handle: `h${i}`, title: `T${i}` });
        out.push(p.id);
      }
      return out.sort();
    });
    const page2 = await runWithTenant({ id: 'tA' }, () => repo.list({ sinceId: ids[1], limit: 2 }));
    expect(page2.map((p) => p.id)).toEqual([ids[2], ids[3]]);
  });

  it('finds a product by handle', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaProductRepository();
    await runWithTenant({ id: 'tA' }, () => repo.create({ handle: 'gizmo', title: 'Gizmo' }));
    const found = await runWithTenant({ id: 'tA' }, () => repo.getByHandle('gizmo'));
    expect(found?.title).toBe('Gizmo');
  });

  it('updates a product', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaProductRepository();
    const created = await runWithTenant({ id: 'tA' }, () => repo.create({ handle: 'h', title: 'old' }));
    const updated = await runWithTenant({ id: 'tA' }, () =>
      repo.update(created.id, { title: 'new', status: 'ARCHIVED' }),
    );
    expect(updated.title).toBe('new');
    expect(updated.status).toBe('ARCHIVED');
  });

  it('cascades on delete', async () => {
    if (skipNoDb()) return;
    if (!prisma) return;
    const repo = new PrismaProductRepository();
    const created = await runWithTenant({ id: 'tA' }, () =>
      repo.create({
        handle: 'h',
        title: 'T',
        variants: [
          {
            title: 'V1',
            options: [{ name: 'Color', value: 'Red' }],
            prices: [{ currencyCode: 'USD', price: '9.99' }],
          },
        ],
        images: [{ src: 'https://x' }],
      }),
    );
    await repo.delete(created.id);
    const orphanVariants = await prisma.productVariant.findMany({ where: { productId: created.id } });
    const orphanImages = await prisma.productImage.findMany({ where: { productId: created.id } });
    expect(orphanVariants).toHaveLength(0);
    expect(orphanImages).toHaveLength(0);
  });

  it('isolates by tenantId on read', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaProductRepository();
    await runWithTenant({ id: 'tA' }, () => repo.create({ handle: 'shared', title: 'A' }));
    await runWithTenant({ id: 'tB' }, () => repo.create({ handle: 'shared', title: 'B' }));
    const fromA = await runWithTenant({ id: 'tA' }, () => repo.getByHandle('shared'));
    const fromB = await runWithTenant({ id: 'tB' }, () => repo.getByHandle('shared'));
    expect(fromA?.title).toBe('A');
    expect(fromB?.title).toBe('B');
  });

  it('enforces unique handle per tenant', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaProductRepository();
    await runWithTenant({ id: 'tA' }, () => repo.create({ handle: 'dup', title: 'A' }));
    await expect(
      runWithTenant({ id: 'tA' }, () => repo.create({ handle: 'dup', title: 'B' })),
    ).rejects.toThrow();
  });

  it('counts products with status filter', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaProductRepository();
    await runWithTenant({ id: 'tA' }, async () => {
      await repo.create({ handle: 'a', title: 'A', status: 'ACTIVE' });
      await repo.create({ handle: 'b', title: 'B', status: 'DRAFT' });
    });
    const total = await runWithTenant({ id: 'tA' }, () => repo.count());
    const active = await runWithTenant({ id: 'tA' }, () => repo.count({ status: 'ACTIVE' }));
    expect(total).toBe(2);
    expect(active).toBe(1);
  });
});

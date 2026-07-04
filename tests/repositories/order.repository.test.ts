import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { runWithTenant } from '@/lib/tenant/context';
import { installTestPrisma } from '../setup/global';
import { resetDb } from '../setup/db';

let prisma: PrismaClient | null = null;
let PrismaOrderRepository: typeof import('@/lib/repositories/order.repository').PrismaOrderRepository;
let PrismaProductRepository: typeof import('@/lib/repositories/product.repository').PrismaProductRepository;

beforeAll(async () => {
  prisma = await installTestPrisma();
  if (!prisma) return;
  PrismaOrderRepository = (await import('@/lib/repositories/order.repository')).PrismaOrderRepository;
  PrismaProductRepository = (await import('@/lib/repositories/product.repository')).PrismaProductRepository;
});

beforeEach(async () => {
  if (!prisma) return;
  await resetDb(prisma);
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
});

const skipNoDb = () => prisma === null;

async function makeOrder(repo: InstanceType<typeof PrismaOrderRepository>, overrides: Partial<Parameters<typeof repo.create>[0]> = {}) {
  return repo.create({
    currencyCode: 'USD',
    totalPrice: '20.00',
    subtotalPrice: '20.00',
    customer: { email: 'a@example.com', firstName: 'A' },
    lineItems: [{ title: 'Item', quantity: 1, price: '20.00' }],
    ...overrides,
  });
}

describe('PrismaOrderRepository', () => {
  it('creates an order, line items, and upserts the customer', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaOrderRepository();
    const order = await runWithTenant({ id: 'tA' }, () => makeOrder(repo));
    expect(order.lineItems).toHaveLength(1);
    expect(order.customerId).toBeTruthy();
    expect(order.tenantId).toBe('tA');
  });

  it('generates sequential order numbers per tenant', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaOrderRepository();
    const a = await runWithTenant({ id: 'tA' }, () => makeOrder(repo));
    const b = await runWithTenant({ id: 'tA' }, () => makeOrder(repo));
    const c = await runWithTenant({ id: 'tA' }, () => makeOrder(repo));
    const nums = [a.orderNumber, b.orderNumber, c.orderNumber].map(Number);
    expect(nums[0]).toBe(1001);
    expect(nums[1]).toBe(1002);
    expect(nums[2]).toBe(1003);
  });

  it('filters list by financialStatus and fulfillmentStatus', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaOrderRepository();
    await runWithTenant({ id: 'tA' }, async () => {
      await makeOrder(repo, { financialStatus: 'PAID' });
      await makeOrder(repo, { financialStatus: 'PENDING' });
      await makeOrder(repo, { financialStatus: 'PAID', fulfillmentStatus: 'SHIPPED' });
    });
    const paid = await runWithTenant({ id: 'tA' }, () => repo.list({ financialStatus: 'PAID' }));
    const shipped = await runWithTenant({ id: 'tA' }, () =>
      repo.list({ fulfillmentStatus: 'SHIPPED' }),
    );
    expect(paid).toHaveLength(2);
    expect(shipped).toHaveLength(1);
  });

  it('addRefund flips status to PARTIALLY_REFUNDED then REFUNDED', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaOrderRepository();
    const order = await runWithTenant({ id: 'tA' }, () =>
      makeOrder(repo, { financialStatus: 'PAID' }),
    );
    await repo.addRefund(order.id, '5.00', 'USD');
    const partial = await runWithTenant({ id: 'tA' }, () => repo.getById(order.id));
    expect(partial?.financialStatus).toBe('PARTIALLY_REFUNDED');
    await repo.addRefund(order.id, '15.00', 'USD');
    const full = await runWithTenant({ id: 'tA' }, () => repo.getById(order.id));
    expect(full?.financialStatus).toBe('REFUNDED');
    expect(full?.refunds).toHaveLength(2);
  });

  it('isolates orders by tenant', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaOrderRepository();
    await runWithTenant({ id: 'tA' }, () => makeOrder(repo));
    await runWithTenant({ id: 'tB' }, () => makeOrder(repo));
    const a = await runWithTenant({ id: 'tA' }, () => repo.list());
    const b = await runWithTenant({ id: 'tB' }, () => repo.list());
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].id).not.toBe(b[0].id);
  });

  it('decrements inventory on order create when trackInventory=true', async () => {
    if (skipNoDb()) return;
    if (!prisma) return;
    const orderRepo = new PrismaOrderRepository();
    const productRepo = new PrismaProductRepository();
    const product = await runWithTenant({ id: 'tA' }, () =>
      productRepo.create({
        handle: 'tracked',
        title: 'T',
        trackInventory: true,
        variants: [{ title: 'V', inventoryQuantity: 10 }],
      }),
    );
    const variantId = product.variants[0].id;
    await runWithTenant({ id: 'tA' }, () =>
      orderRepo.create({
        currencyCode: 'USD',
        totalPrice: '10.00',
        subtotalPrice: '10.00',
        lineItems: [{ title: 'V', variantId, quantity: 3, price: '10.00' }],
      }),
    );
    const reread = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(reread?.inventoryQuantity).toBe(7);
  });

  it('does NOT decrement inventory when trackInventory=false', async () => {
    if (skipNoDb()) return;
    if (!prisma) return;
    const orderRepo = new PrismaOrderRepository();
    const productRepo = new PrismaProductRepository();
    const product = await runWithTenant({ id: 'tA' }, () =>
      productRepo.create({
        handle: 'untracked',
        title: 'T',
        trackInventory: false,
        variants: [{ title: 'V', inventoryQuantity: 10 }],
      }),
    );
    const variantId = product.variants[0].id;
    await runWithTenant({ id: 'tA' }, () =>
      orderRepo.create({
        currencyCode: 'USD',
        totalPrice: '10.00',
        subtotalPrice: '10.00',
        lineItems: [{ title: 'V', variantId, quantity: 3, price: '10.00' }],
      }),
    );
    const reread = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(reread?.inventoryQuantity).toBe(10);
  });

  it('updateStatus changes financial / fulfillment status', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaOrderRepository();
    const order = await runWithTenant({ id: 'tA' }, () => makeOrder(repo));
    const updated = await repo.updateStatus(order.id, {
      financialStatus: 'PAID',
      fulfillmentStatus: 'SHIPPED',
    });
    expect(updated.financialStatus).toBe('PAID');
    expect(updated.fulfillmentStatus).toBe('SHIPPED');
  });
});

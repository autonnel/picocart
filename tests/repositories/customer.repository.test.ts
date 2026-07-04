import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { runWithTenant } from '@/lib/tenant/context';
import { installTestPrisma } from '../setup/global';
import { resetDb } from '../setup/db';

let prisma: PrismaClient | null = null;
let PrismaCustomerRepository: typeof import('@/lib/repositories/customer.repository').PrismaCustomerRepository;
let PrismaOrderRepository: typeof import('@/lib/repositories/order.repository').PrismaOrderRepository;

beforeAll(async () => {
  prisma = await installTestPrisma();
  if (!prisma) return;
  PrismaCustomerRepository = (await import('@/lib/repositories/customer.repository')).PrismaCustomerRepository;
  PrismaOrderRepository = (await import('@/lib/repositories/order.repository')).PrismaOrderRepository;
});

beforeEach(async () => {
  if (!prisma) return;
  await resetDb(prisma);
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
});

const skipNoDb = () => prisma === null;

describe('PrismaCustomerRepository', () => {
  it('upsertByEmail creates a new customer when not present', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaCustomerRepository();
    const c = await runWithTenant({ id: 'tA' }, () =>
      repo.upsertByEmail({ email: 'a@example.com', firstName: 'Ann' }),
    );
    expect(c.email).toBe('a@example.com');
    expect(c.firstName).toBe('Ann');
    expect(c.tenantId).toBe('tA');
  });

  it('upsertByEmail merges fields on existing customer', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaCustomerRepository();
    await runWithTenant({ id: 'tA' }, () =>
      repo.upsertByEmail({ email: 'a@example.com', firstName: 'Ann' }),
    );
    const c2 = await runWithTenant({ id: 'tA' }, () =>
      repo.upsertByEmail({ email: 'a@example.com', lastName: 'Smith', phone: '555' }),
    );
    expect(c2.firstName).toBe('Ann');
    expect(c2.lastName).toBe('Smith');
    expect(c2.phone).toBe('555');
  });

  it('isolates customers by tenant', async () => {
    if (skipNoDb()) return;
    const repo = new PrismaCustomerRepository();
    await runWithTenant({ id: 'tA' }, () => repo.upsertByEmail({ email: 'shared@example.com', firstName: 'A' }));
    await runWithTenant({ id: 'tB' }, () => repo.upsertByEmail({ email: 'shared@example.com', firstName: 'B' }));
    const a = await runWithTenant({ id: 'tA' }, () => repo.getByEmail('shared@example.com'));
    const b = await runWithTenant({ id: 'tB' }, () => repo.getByEmail('shared@example.com'));
    expect(a?.firstName).toBe('A');
    expect(b?.firstName).toBe('B');
    expect(a?.id).not.toBe(b?.id);
  });

  it('recomputeStats sums paid orders', async () => {
    if (skipNoDb()) return;
    const customerRepo = new PrismaCustomerRepository();
    const orderRepo = new PrismaOrderRepository();
    await runWithTenant({ id: 'tA' }, async () => {
      await orderRepo.create({
        currencyCode: 'USD',
        totalPrice: '50.00',
        subtotalPrice: '50.00',
        financialStatus: 'PAID',
        customer: { email: 'x@example.com' },
        lineItems: [{ title: 'X', quantity: 1, price: '50.00' }],
      });
      await orderRepo.create({
        currencyCode: 'USD',
        totalPrice: '25.00',
        subtotalPrice: '25.00',
        financialStatus: 'PAID',
        customer: { email: 'x@example.com' },
        lineItems: [{ title: 'X', quantity: 1, price: '25.00' }],
      });
      await orderRepo.create({
        currencyCode: 'USD',
        totalPrice: '999.00',
        subtotalPrice: '999.00',
        financialStatus: 'PENDING',
        customer: { email: 'x@example.com' },
        lineItems: [{ title: 'X', quantity: 1, price: '999.00' }],
      });
    });
    const customer = await runWithTenant({ id: 'tA' }, () => customerRepo.getByEmail('x@example.com'));
    expect(customer).toBeTruthy();
    const updated = await runWithTenant({ id: 'tA' }, () => customerRepo.recomputeStats(customer!.id));
    expect(updated.ordersCount).toBe(2);
    expect(Number(updated.totalSpent)).toBe(75);
  });
});

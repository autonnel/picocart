import type { Customer, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { currentTenantId, withTenantData, withTenantWhere } from './tenant-helpers';

export interface UpsertCustomerInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

export interface ICustomerRepository {
  upsertByEmail(input: UpsertCustomerInput): Promise<Customer>;
  getById(id: string): Promise<Customer | null>;
  getByEmail(email: string): Promise<Customer | null>;
  listByTenant(): Promise<Customer[]>;
  recomputeStats(customerId: string): Promise<Customer>;
}

export class PrismaCustomerRepository implements ICustomerRepository {
  async upsertByEmail(input: UpsertCustomerInput): Promise<Customer> {
    const tenantId = currentTenantId();
    const existing = await prisma.customer.findFirst({
      where: withTenantWhere({ email: input.email }),
    });
    if (existing) {
      const data: Prisma.CustomerUpdateInput = {};
      if (input.firstName !== undefined && input.firstName !== null) {
        data.firstName = input.firstName;
      }
      if (input.lastName !== undefined && input.lastName !== null) {
        data.lastName = input.lastName;
      }
      if (input.phone !== undefined && input.phone !== null) {
        data.phone = input.phone;
      }
      if (Object.keys(data).length === 0) return existing;
      return prisma.customer.update({ where: { id: existing.id }, data });
    }
    return prisma.customer.create({
      data: withTenantData({
        email: input.email,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
        ordersCount: 0,
        totalSpent: 0,
        tenantId,
      }),
    });
  }

  async getById(id: string): Promise<Customer | null> {
    return prisma.customer.findFirst({ where: withTenantWhere({ id }) });
  }

  async getByEmail(email: string): Promise<Customer | null> {
    return prisma.customer.findFirst({ where: withTenantWhere({ email }) });
  }

  async listByTenant(): Promise<Customer[]> {
    return prisma.customer.findMany({
      where: withTenantWhere({}),
      orderBy: { createdAt: 'desc' },
    });
  }

  async recomputeStats(customerId: string): Promise<Customer> {
    const customer = await prisma.customer.findFirst({
      where: withTenantWhere({ id: customerId }),
    });
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }
    const aggregate = await prisma.order.aggregate({
      where: withTenantWhere({ customerId, financialStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] } }),
      _count: { id: true },
      _sum: { totalPrice: true },
    });
    const ordersCount = aggregate._count.id ?? 0;
    const totalSpent = aggregate._sum.totalPrice ?? 0;
    return prisma.customer.update({
      where: { id: customerId },
      data: { ordersCount, totalSpent: totalSpent as Prisma.Decimal | number },
    });
  }
}

let customerRepositoryInstance: ICustomerRepository | null = null;

export function getCustomerRepository(): ICustomerRepository {
  if (!customerRepositoryInstance) {
    customerRepositoryInstance = new PrismaCustomerRepository();
  }
  return customerRepositoryInstance;
}

export function setCustomerRepository(repository: ICustomerRepository): void {
  customerRepositoryInstance = repository;
}

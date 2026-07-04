import type { APIRoute } from 'astro';
import { withAuth, jsonResponse, jsonError } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import { getCustomerRepository } from '@/lib/repositories/customer.repository';
import { prisma } from '@/lib/db';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';

export const GET: APIRoute = withAuth(FEATURES.CUSTOMERS, async ({ params }) => {
  const id = params.id;
  if (!id) return jsonError('Missing id', 400);
  const repo = getCustomerRepository();
  const customer = await repo.getById(id);
  if (!customer) return jsonError('Not found', 404);
  const orders = await prisma.order.findMany({
    where: withTenantWhere({ customerId: id }),
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return jsonResponse({ customer, orders });
});

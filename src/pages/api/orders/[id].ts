import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withAuth, jsonResponse, jsonError } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import { getOrderRepository } from '@/lib/repositories/order.repository';
import { prisma } from '@/lib/db';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:OrderDetail');

const FUL_ENUM = z.enum(['UNFULFILLED', 'SHIPPED', 'DELIVERED']);

const UpdateOrderSchema = z.object({
  trackingNumber: z.string().nullable().optional(),
  trackingCompany: z.string().nullable().optional(),
  fulfillmentStatus: FUL_ENUM.optional(),
  note: z.string().nullable().optional(),
});

export const GET: APIRoute = withAuth(FEATURES.ORDERS, async ({ params }) => {
  const id = params.id;
  if (!id) return jsonError('Missing id', 400);
  const repo = getOrderRepository();
  const order = await repo.getById(id);
  if (!order) return jsonError('Not found', 404);
  return jsonResponse({ order });
});

export const PUT: APIRoute = withAuth(FEATURES.ORDERS, async ({ params, request }) => {
  const id = params.id;
  if (!id) return jsonError('Missing id', 400);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = UpdateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'VALIDATION', issues: parsed.error.issues }, 400);
  }

  const existing = await prisma.order.findFirst({ where: withTenantWhere({ id }) });
  if (!existing) return jsonError('Not found', 404);

  try {
    const data: Record<string, unknown> = {};
    if (parsed.data.trackingNumber !== undefined) data.trackingNumber = parsed.data.trackingNumber;
    if (parsed.data.trackingCompany !== undefined) data.trackingCompany = parsed.data.trackingCompany;
    if (parsed.data.fulfillmentStatus !== undefined) data.fulfillmentStatus = parsed.data.fulfillmentStatus;
    if (parsed.data.note !== undefined) data.note = parsed.data.note;
    await prisma.order.update({ where: { id }, data });

    const repo = getOrderRepository();
    const fresh = await repo.getById(id);
    return jsonResponse({ order: fresh });
  } catch (error) {
    logger.error('Update order failed', { error, orderId: id });
    return jsonError('Failed to update order', 500);
  }
});

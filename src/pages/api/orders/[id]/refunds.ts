import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withAuth, jsonResponse, jsonError } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import { getOrderRepository } from '@/lib/repositories/order.repository';
import { prisma } from '@/lib/db';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:OrderRefunds');

const RefundSchema = z.object({
  amount: z.union([z.number().positive(), z.string().min(1)]),
  reason: z.string().nullable().optional(),
});

export const POST: APIRoute = withAuth(FEATURES.ORDERS_REFUND, async ({ params, request }) => {
  const orderId = params.id;
  if (!orderId) return jsonError('Missing id', 400);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = RefundSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'VALIDATION', issues: parsed.error.issues }, 400);
  }
  const order = await prisma.order.findFirst({
    where: withTenantWhere({ id: orderId }),
    include: { refunds: true },
  });
  if (!order) return jsonError('Not found', 404);

  const amountNum = Number(parsed.data.amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return jsonError('Invalid amount', 400);
  }
  const refundedSoFar = order.refunds.reduce((s, r) => s + Number(r.amount), 0);
  const remaining = Number(order.totalPrice) - refundedSoFar;
  if (amountNum - remaining > 0.001) {
    return jsonError(`Amount exceeds remaining (${remaining.toFixed(2)})`, 400);
  }

  try {
    const repo = getOrderRepository();
    const refund = await repo.addRefund(
      orderId,
      parsed.data.amount,
      order.currencyCode,
      parsed.data.reason ?? null,
    );
    const fresh = await repo.getById(orderId);
    return jsonResponse({ refund, order: fresh }, 201);
  } catch (error) {
    logger.error('Create refund failed', { error, orderId });
    return jsonError('Failed to create refund', 500);
  }
});

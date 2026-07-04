import { getOrderRepository } from '@/lib/repositories/order.repository';
import { decodeGid, encodeGid } from '../gid';
import type { GraphqlVariables } from '../router';
import type { UserError } from './orders';

interface RefundTransaction {
  orderId?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  kind?: string | null;
}

interface RefundInputShape {
  orderId?: string | null;
  note?: string | null;
  notify?: boolean | null;
  transactions?: RefundTransaction[];
}

export async function resolveRefundCreate(vars: GraphqlVariables): Promise<Record<string, unknown>> {
  const input = (vars.input ?? {}) as RefundInputShape;
  const orderId = decodeGid(input.orderId ?? '');
  if (!orderId) {
    return { refundCreate: { refund: null, userErrors: [{ field: ['input', 'orderId'], message: 'orderId is required' }] } };
  }

  const repo = getOrderRepository();
  const order = await repo.getById(orderId);
  if (!order) {
    return { refundCreate: { refund: null, userErrors: [{ field: ['input', 'orderId'], message: 'Order not found' }] } };
  }

  const totalRequested = (input.transactions ?? []).reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
  const userErrors: UserError[] = [];
  if (!Number.isFinite(totalRequested) || totalRequested <= 0) {
    userErrors.push({ field: ['input', 'transactions'], message: 'Refund amount must be greater than 0' });
    return { refundCreate: { refund: null, userErrors } };
  }

  const refundedSoFar = order.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
  const remaining = Number(order.totalPrice) - refundedSoFar;
  if (totalRequested - remaining > 0.001) {
    userErrors.push({
      field: ['input', 'transactions'],
      message: `Refund exceeds remaining refundable amount (${remaining.toFixed(2)})`,
    });
    return { refundCreate: { refund: null, userErrors } };
  }

  const currency = (input.transactions?.[0]?.currency ?? order.currencyCode).toUpperCase();
  try {
    const created = await repo.addRefund(orderId, totalRequested.toFixed(2), currency, input.note ?? null);
    return {
      refundCreate: {
        refund: { id: encodeGid('Refund', created.id) },
        userErrors: [],
      },
    };
  } catch (err) {
    return {
      refundCreate: {
        refund: null,
        userErrors: [{ field: null, message: err instanceof Error ? err.message : 'refundCreate failed' }],
      },
    };
  }
}

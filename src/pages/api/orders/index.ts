import type { APIRoute } from 'astro';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import { getOrderRepository } from '@/lib/repositories/order.repository';
import type { OrderFinancialStatus, OrderFulfillmentStatus } from '@prisma/client';

const FIN_VALUES: OrderFinancialStatus[] = ['PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'];
const FUL_VALUES: OrderFulfillmentStatus[] = ['UNFULFILLED', 'SHIPPED', 'DELIVERED'];

export const GET: APIRoute = withAuth(FEATURES.ORDERS, async ({ request }) => {
  const url = new URL(request.url);
  const sp = url.searchParams;
  const limitRaw = parseInt(sp.get('limit') || '50', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 250);
  const sinceId = sp.get('sinceId') || undefined;
  const finRaw = sp.get('financialStatus') || '';
  const fulRaw = sp.get('fulfillmentStatus') || '';
  const financialStatus = FIN_VALUES.includes(finRaw as OrderFinancialStatus)
    ? (finRaw as OrderFinancialStatus)
    : undefined;
  const fulfillmentStatus = FUL_VALUES.includes(fulRaw as OrderFulfillmentStatus)
    ? (fulRaw as OrderFulfillmentStatus)
    : undefined;
  const q = (sp.get('q') || '').trim();

  const repo = getOrderRepository();
  const list = await repo.list({ financialStatus, fulfillmentStatus, sinceId, limit });
  const filtered = q
    ? list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q.toLowerCase()) ||
          (o.email ?? '').toLowerCase().includes(q.toLowerCase()),
      )
    : list;
  return jsonResponse({ orders: filtered });
});

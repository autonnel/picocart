import { prisma } from '@/lib/db';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';
import { createLogger } from '@/lib/logger';

const logger = createLogger('OverviewLoader');

export interface OverviewMetrics {
  activeProducts: number;
  totalProducts: number;
  ordersLast30d: number;
  revenueLast30d: number;
  pendingOrders: number;
  defaultCurrency: string;
}

export async function loadOverviewMetrics(defaultCurrency: string): Promise<OverviewMetrics> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    const [activeProducts, totalProducts, ordersLast30d, revenueAgg, pendingOrders] =
      await Promise.all([
        prisma.product.count({ where: withTenantWhere({ status: 'ACTIVE' }) }),
        prisma.product.count({ where: withTenantWhere({}) }),
        prisma.order.count({ where: withTenantWhere({ createdAt: { gte: since } }) }),
        prisma.order.aggregate({
          where: withTenantWhere({
            createdAt: { gte: since },
            financialStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
          }),
          _sum: { totalPrice: true },
        }),
        prisma.order.count({ where: withTenantWhere({ financialStatus: 'PENDING' }) }),
      ]);

    return {
      activeProducts,
      totalProducts,
      ordersLast30d,
      revenueLast30d: Number(revenueAgg._sum.totalPrice ?? 0),
      pendingOrders,
      defaultCurrency,
    };
  } catch (error) {
    logger.error('Failed to load overview metrics', { error });
    return {
      activeProducts: 0,
      totalProducts: 0,
      ordersLast30d: 0,
      revenueLast30d: 0,
      pendingOrders: 0,
      defaultCurrency,
    };
  }
}

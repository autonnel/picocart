import { Prisma } from '@prisma/client';
import type {
  Order,
  OrderFinancialStatus,
  OrderFulfillmentStatus,
  OrderLineItem,
  OrderRefund,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { currentTenantId, withTenantData, withTenantWhere } from './tenant-helpers';

const logger = createLogger('OrderRepo');

export interface OrderLineItemInput {
  variantId?: string | null;
  productId?: string | null;
  title: string;
  variantTitle?: string | null;
  sku?: string | null;
  quantity: number;
  price: number | string;
  totalDiscount?: number | string;
}

export interface OrderCustomerInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

export interface CreateOrderInput {
  email?: string | null;
  financialStatus?: OrderFinancialStatus;
  fulfillmentStatus?: OrderFulfillmentStatus;
  totalPrice: number | string;
  subtotalPrice: number | string;
  taxPrice?: number | string;
  shippingPrice?: number | string;
  discountPrice?: number | string;
  currencyCode: string;
  shippingAddress?: Prisma.InputJsonValue | null;
  billingAddress?: Prisma.InputJsonValue | null;
  note?: string | null;
  externalSource?: string | null;
  externalRef?: string | null;
  trackingNumber?: string | null;
  trackingCompany?: string | null;
  customer?: OrderCustomerInput | null;
  lineItems: OrderLineItemInput[];
}

export interface ListOrdersOptions {
  financialStatus?: OrderFinancialStatus;
  fulfillmentStatus?: OrderFulfillmentStatus;
  updatedAtMin?: Date;
  sinceId?: string;
  limit?: number;
}

export type OrderWithRelations = Order & {
  lineItems: OrderLineItem[];
  refunds: OrderRefund[];
};

export interface IOrderRepository {
  create(input: CreateOrderInput): Promise<OrderWithRelations>;
  getById(id: string): Promise<OrderWithRelations | null>;
  list(options?: ListOrdersOptions): Promise<OrderWithRelations[]>;
  updateStatus(
    id: string,
    statuses: { financialStatus?: OrderFinancialStatus; fulfillmentStatus?: OrderFulfillmentStatus },
  ): Promise<Order>;
  addRefund(orderId: string, amount: number | string, currencyCode: string, reason?: string | null): Promise<OrderRefund>;
  generateOrderNumber(): Promise<string>;
}

const orderInclude = {
  lineItems: true,
  refunds: true,
} satisfies Prisma.OrderInclude;

function toDecimal(v: number | string | undefined, fallback: number = 0): number | string {
  if (v === undefined) return fallback;
  return v;
}

export class PrismaOrderRepository implements IOrderRepository {
  async generateOrderNumber(): Promise<string> {
    const tenantId = currentTenantId();
    const last = await prisma.order.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true },
    });
    let next = 1001;
    if (last) {
      const parsed = parseInt(last.orderNumber, 10);
      if (Number.isFinite(parsed)) {
        next = parsed + 1;
      }
    }
    return String(next);
  }

  async create(input: CreateOrderInput): Promise<OrderWithRelations> {
    const tenantId = currentTenantId();
    const orderNumber = await this.generateOrderNumber();

    return prisma.$transaction(async (tx) => {
      let customerId: string | null = null;
      if (input.customer?.email) {
        const existing = await tx.customer.findFirst({
          where: { tenantId, email: input.customer.email },
        });
        if (existing) {
          const data: Prisma.CustomerUpdateInput = {};
          if (input.customer.firstName) data.firstName = input.customer.firstName;
          if (input.customer.lastName) data.lastName = input.customer.lastName;
          if (input.customer.phone) data.phone = input.customer.phone;
          const updated =
            Object.keys(data).length === 0
              ? existing
              : await tx.customer.update({ where: { id: existing.id }, data });
          customerId = updated.id;
        } else {
          const created = await tx.customer.create({
            data: {
              tenantId,
              email: input.customer.email,
              firstName: input.customer.firstName ?? null,
              lastName: input.customer.lastName ?? null,
              phone: input.customer.phone ?? null,
            },
          });
          customerId = created.id;
        }
      }

      const order = await tx.order.create({
        data: withTenantData({
          orderNumber,
          email: input.email ?? input.customer?.email ?? null,
          financialStatus: input.financialStatus ?? 'PENDING',
          fulfillmentStatus: input.fulfillmentStatus ?? 'UNFULFILLED',
          totalPrice: input.totalPrice as Prisma.Decimal | number | string,
          subtotalPrice: input.subtotalPrice as Prisma.Decimal | number | string,
          taxPrice: toDecimal(input.taxPrice) as Prisma.Decimal | number | string,
          shippingPrice: toDecimal(input.shippingPrice) as Prisma.Decimal | number | string,
          discountPrice: toDecimal(input.discountPrice) as Prisma.Decimal | number | string,
          currencyCode: input.currencyCode,
          customerId,
          shippingAddress: input.shippingAddress ?? Prisma.JsonNull,
          billingAddress: input.billingAddress ?? Prisma.JsonNull,
          note: input.note ?? null,
          externalSource: input.externalSource ?? null,
          externalRef: input.externalRef ?? null,
          trackingNumber: input.trackingNumber ?? null,
          trackingCompany: input.trackingCompany ?? null,
        }),
      });

      for (const li of input.lineItems) {
        await tx.orderLineItem.create({
          data: {
            orderId: order.id,
            variantId: li.variantId ?? null,
            productId: li.productId ?? null,
            title: li.title,
            variantTitle: li.variantTitle ?? null,
            sku: li.sku ?? null,
            quantity: li.quantity,
            price: li.price as Prisma.Decimal | number | string,
            totalDiscount: toDecimal(li.totalDiscount) as Prisma.Decimal | number | string,
          },
        });

        if (li.variantId) {
          const variant = await tx.productVariant.findFirst({
            where: { id: li.variantId },
            include: { product: { select: { trackInventory: true } } },
          });
          if (variant && variant.product.trackInventory) {
            if (variant.inventoryQuantity < li.quantity) {
              throw new Error(
                `Insufficient inventory for variant ${li.variantId}: requested ${li.quantity}, available ${variant.inventoryQuantity}`,
              );
            }
            await tx.productVariant.update({
              where: { id: li.variantId },
              data: { inventoryQuantity: { decrement: li.quantity } },
            });
          }
        }
      }

      if (customerId) {
        const totalNum = Number(input.totalPrice);
        const isPaid = (input.financialStatus ?? 'PENDING') === 'PAID';
        if (isPaid) {
          await tx.customer.update({
            where: { id: customerId },
            data: {
              ordersCount: { increment: 1 },
              totalSpent: { increment: totalNum },
            },
          });
        }
      }

      const reloaded = await tx.order.findFirst({
        where: { id: order.id },
        include: orderInclude,
      });
      if (!reloaded) {
        throw new Error('Order disappeared mid-transaction');
      }
      logger.info('Order created', { orderId: order.id, orderNumber });
      return reloaded as OrderWithRelations;
    });
  }

  async getById(id: string): Promise<OrderWithRelations | null> {
    const result = await prisma.order.findFirst({
      where: withTenantWhere({ id }),
      include: orderInclude,
    });
    return result as OrderWithRelations | null;
  }

  async list(options: ListOrdersOptions = {}): Promise<OrderWithRelations[]> {
    const where: Prisma.OrderWhereInput = withTenantWhere({});
    if (options.financialStatus) where.financialStatus = options.financialStatus;
    if (options.fulfillmentStatus) where.fulfillmentStatus = options.fulfillmentStatus;
    if (options.updatedAtMin) where.updatedAt = { gte: options.updatedAtMin };
    if (options.sinceId) where.id = { gt: options.sinceId };

    const limit = Math.min(Math.max(options.limit ?? 50, 1), 250);
    const result = await prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { id: 'asc' },
      take: limit,
    });
    return result as OrderWithRelations[];
  }

  async updateStatus(
    id: string,
    statuses: { financialStatus?: OrderFinancialStatus; fulfillmentStatus?: OrderFulfillmentStatus },
  ): Promise<Order> {
    const data: Prisma.OrderUpdateInput = {};
    if (statuses.financialStatus) data.financialStatus = statuses.financialStatus;
    if (statuses.fulfillmentStatus) data.fulfillmentStatus = statuses.fulfillmentStatus;
    return prisma.order.update({ where: { id }, data });
  }

  async addRefund(
    orderId: string,
    amount: number | string,
    currencyCode: string,
    reason?: string | null,
  ): Promise<OrderRefund> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId },
        include: { refunds: true },
      });
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }
      const refund = await tx.orderRefund.create({
        data: {
          orderId,
          amount: amount as Prisma.Decimal | number | string,
          currencyCode,
          reason: reason ?? null,
        },
      });
      const refundedSoFar = order.refunds.reduce(
        (sum, r) => sum + Number(r.amount),
        0,
      ) + Number(amount);
      const total = Number(order.totalPrice);
      let financialStatus: OrderFinancialStatus = order.financialStatus;
      if (refundedSoFar >= total) {
        financialStatus = 'REFUNDED';
      } else if (refundedSoFar > 0) {
        financialStatus = 'PARTIALLY_REFUNDED';
      }
      if (financialStatus !== order.financialStatus) {
        await tx.order.update({
          where: { id: orderId },
          data: { financialStatus },
        });
      }
      return refund;
    });
  }
}

let orderRepositoryInstance: IOrderRepository | null = null;

export function getOrderRepository(): IOrderRepository {
  if (!orderRepositoryInstance) {
    orderRepositoryInstance = new PrismaOrderRepository();
  }
  return orderRepositoryInstance;
}

export function setOrderRepository(repository: IOrderRepository): void {
  orderRepositoryInstance = repository;
}

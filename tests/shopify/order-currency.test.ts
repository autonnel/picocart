import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/config/get-config', () => ({ getConfig: async () => undefined }));
import { executeGraphql } from '@/lib/shopify/graphql/handler';
import { setVariantRepository, type IVariantRepository, type VariantWithRelations } from '@/lib/repositories/variant.repository';
import {
  setOrderRepository,
  type IOrderRepository,
  type OrderWithRelations,
  type CreateOrderInput,
} from '@/lib/repositories/order.repository';

const NOW = new Date('2026-06-10T00:00:00.000Z');
const VARIANT_GID = 'gid://shopify/ProductVariant/var11';

const ORDER_CREATE = `mutation OrderCreate($order: OrderCreateOrderInput!) {
  orderCreate(order: $order) { order { id } userErrors { field message } }
}`;
const DRAFT_CREATE = `mutation DraftOrderCreate($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) { draftOrder { id } userErrors { field message } }
}`;
const DRAFT_COMPLETE = `mutation DraftOrderComplete($id: ID!) {
  draftOrderComplete(id: $id) { draftOrder { id } userErrors { field message } }
}`;

let created: CreateOrderInput | null = null;

function price(currencyCode: string, value: string) {
  return { id: `pr-${currencyCode}`, variantId: 'var11', currencyCode, price: value as never, compareAtPrice: null };
}

function setup(prices: ReturnType<typeof price>[]) {
  const variant = { id: 'var11', productId: 'prod1', sku: 'SKU1', title: 'Default', prices } as unknown as VariantWithRelations;
  const variantRepo: IVariantRepository = {
    getById: async (id: string) => (id === 'var11' ? variant : null),
    listByProduct: async () => [variant],
    decrementInventory: async () => variant as never,
    incrementInventory: async () => variant as never,
  };
  const orderRepo = {
    create: async (input: CreateOrderInput) => {
      created = input;
      return {
        id: 'ord1',
        orderNumber: '1001',
        currencyCode: input.currencyCode,
        lineItems: [],
        refunds: [],
        createdAt: NOW,
        updatedAt: NOW,
      } as unknown as OrderWithRelations;
    },
  } as unknown as IOrderRepository;
  setVariantRepository(variantRepo);
  setOrderRepository(orderRepo);
}

beforeEach(() => {
  created = null;
  (globalThis as { prisma?: unknown }).prisma = { appConfig: { findUnique: async () => null } };
});

afterEach(() => {
  delete (globalThis as { prisma?: unknown }).prisma;
});

const WRITE = { writeAccess: true };

describe('order currency and line prices', () => {
  it('orderCreate uses sent currency and line price', async () => {
    setup([price('USD', '10.00'), price('EUR', '9.99')]);
    const res = await executeGraphql(
      {
        query: ORDER_CREATE,
        variables: {
          order: {
            currency: 'EUR',
            lineItems: [
              { variantId: VARIANT_GID, quantity: 1, priceSet: { shopMoney: { amount: '9.50', currencyCode: 'EUR' } } },
            ],
          },
        },
      },
      WRITE,
    );
    expect((res.body.data as any).orderCreate.userErrors).toEqual([]);
    expect(created!.currencyCode).toBe('EUR');
    expect(created!.lineItems[0].price).toBe('9.50');
    expect(created!.totalPrice).toBe('9.50');
  });

  it('orderCreate uses originalUnitPriceWithCurrency when present', async () => {
    setup([price('USD', '10.00')]);
    await executeGraphql(
      {
        query: ORDER_CREATE,
        variables: {
          order: {
            presentmentCurrencyCode: 'EUR',
            lineItems: [
              { variantId: VARIANT_GID, quantity: 2, originalUnitPriceWithCurrency: { amount: '4.25', currencyCode: 'EUR' } },
            ],
          },
        },
      },
      WRITE,
    );
    expect(created!.currencyCode).toBe('EUR');
    expect(created!.lineItems[0].price).toBe('4.25');
    expect(created!.totalPrice).toBe('8.50');
  });

  it('orderCreate errors when currency row missing', async () => {
    setup([price('USD', '10.00'), price('EUR', '9.99')]);
    const res = await executeGraphql(
      { query: ORDER_CREATE, variables: { order: { currency: 'GBP', lineItems: [{ variantId: VARIANT_GID, quantity: 1 }] } } },
      WRITE,
    );
    const data = res.body.data as any;
    expect(data.orderCreate.order).toBeNull();
    expect(data.orderCreate.userErrors[0].message).toContain('GBP');
    expect(created).toBeNull();
  });

  it('draft keeps presentment currency through complete', async () => {
    setup([price('USD', '10.00'), price('EUR', '9.99')]);
    const draft = await executeGraphql(
      { query: DRAFT_CREATE, variables: { input: { presentmentCurrencyCode: 'EUR', lineItems: [{ variantId: VARIANT_GID, quantity: 1 }] } } },
      WRITE,
    );
    const id = (draft.body.data as any).draftOrderCreate.draftOrder.id as string;
    const done = await executeGraphql({ query: DRAFT_COMPLETE, variables: { id } }, WRITE);
    expect((done.body.data as any).draftOrderComplete.userErrors).toEqual([]);
    expect(created!.currencyCode).toBe('EUR');
    expect(created!.lineItems[0].price).toBe('9.99');
  });

  it('orderCreate applies orderFixedDiscountCode to discountPrice and total', async () => {
    setup([price('EUR', '9.99')]);
    const res = await executeGraphql(
      {
        query: ORDER_CREATE,
        variables: {
          order: {
            currency: 'EUR',
            lineItems: [
              { variantId: VARIANT_GID, quantity: 2, priceSet: { shopMoney: { amount: '9.50', currencyCode: 'EUR' } } },
            ],
            discountCode: {
              orderFixedDiscountCode: { code: 'SAVE3', amountSet: { shopMoney: { amount: '3.00', currencyCode: 'EUR' } } },
            },
          },
        },
      },
      WRITE,
    );
    expect((res.body.data as any).orderCreate.userErrors).toEqual([]);
    expect(created!.subtotalPrice).toBe('19.00');
    expect(created!.discountPrice).toBe('3.00');
    expect(created!.totalPrice).toBe('16.00');
  });

  it('draft appliedDiscount survives complete', async () => {
    setup([price('EUR', '9.99')]);
    const draft = await executeGraphql(
      {
        query: DRAFT_CREATE,
        variables: {
          input: {
            presentmentCurrencyCode: 'EUR',
            lineItems: [
              { variantId: VARIANT_GID, quantity: 2, originalUnitPriceWithCurrency: { amount: '9.50', currencyCode: 'EUR' } },
            ],
            appliedDiscount: { value: 3, valueType: 'FIXED_AMOUNT', title: 'SAVE3' },
          },
        },
      },
      WRITE,
    );
    const id = (draft.body.data as any).draftOrderCreate.draftOrder.id as string;
    await executeGraphql({ query: DRAFT_COMPLETE, variables: { id } }, WRITE);
    expect(created!.subtotalPrice).toBe('19.00');
    expect(created!.discountPrice).toBe('3.00');
    expect(created!.totalPrice).toBe('16.00');
  });

  it('clamps a discount above the subtotal and omits discountPrice when absent', async () => {
    setup([price('EUR', '9.99')]);
    await executeGraphql(
      {
        query: ORDER_CREATE,
        variables: {
          order: {
            currency: 'EUR',
            lineItems: [{ variantId: VARIANT_GID, quantity: 1 }],
            discountCode: { orderFixedDiscountCode: { code: 'BIG', amountSet: { shopMoney: { amount: '50.00', currencyCode: 'EUR' } } } },
          },
        },
      },
      WRITE,
    );
    expect(created!.discountPrice).toBe('9.99');
    expect(created!.totalPrice).toBe('0.00');
    await executeGraphql(
      { query: ORDER_CREATE, variables: { order: { currency: 'EUR', lineItems: [{ variantId: VARIANT_GID, quantity: 1 }] } } },
      WRITE,
    );
    expect(created!.discountPrice).toBeUndefined();
    expect(created!.totalPrice).toBe('9.99');
  });
  it('uses the store default currency when no currency is sent, not the first price row', async () => {
    setup([price('EUR', '9.99'), price('USD', '10.00')]);
    const res = await executeGraphql(
      { query: ORDER_CREATE, variables: { order: { lineItems: [{ variantId: VARIANT_GID, quantity: 1 }] } } },
      WRITE,
    );
    expect((res.body.data as any).orderCreate.userErrors).toEqual([]);
    expect(created!.currencyCode).toBe('USD');
    expect(created!.lineItems[0].price).toBe('10.00');
  });

  it.each([['abc'], ['-1.00'], ['Infinity']])('rejects an invalid line amount %s', async (amount) => {
    setup([price('EUR', '9.99')]);
    const res = await executeGraphql(
      {
        query: ORDER_CREATE,
        variables: {
          order: {
            currency: 'EUR',
            lineItems: [{ variantId: VARIANT_GID, quantity: 1, priceSet: { shopMoney: { amount, currencyCode: 'EUR' } } }],
          },
        },
      },
      WRITE,
    );
    const data = res.body.data as any;
    expect(data.orderCreate.order).toBeNull();
    expect(data.orderCreate.userErrors[0].message).toMatch(/amount/i);
    expect(created).toBeNull();
  });

  it.each([['abc'], ['-2.00']])('rejects an invalid discount amount %s', async (amount) => {
    setup([price('EUR', '9.99')]);
    const res = await executeGraphql(
      {
        query: ORDER_CREATE,
        variables: {
          order: {
            currency: 'EUR',
            lineItems: [{ variantId: VARIANT_GID, quantity: 1 }],
            discountCode: { orderFixedDiscountCode: { code: 'X', amountSet: { shopMoney: { amount, currencyCode: 'EUR' } } } },
          },
        },
      },
      WRITE,
    );
    const data = res.body.data as any;
    expect(data.orderCreate.order).toBeNull();
    expect(data.orderCreate.userErrors[0].message).toMatch(/discount/i);
    expect(created).toBeNull();
  });
});

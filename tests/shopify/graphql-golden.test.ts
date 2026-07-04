// Golden tests: feed real Shopify-client GraphQL operation strings into the
// picocart handler and assert every field those clients read is present and
// not undefined. Repos are faked so no database is required.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { executeGraphql } from '@/lib/shopify/graphql/handler';
import {
  setProductRepository,
  type IProductRepository,
  type ProductWithRelations,
} from '@/lib/repositories/product.repository';
import {
  setVariantRepository,
  type IVariantRepository,
  type VariantWithRelations,
} from '@/lib/repositories/variant.repository';
import {
  setOrderRepository,
  type IOrderRepository,
  type OrderWithRelations,
  type CreateOrderInput,
} from '@/lib/repositories/order.repository';

const NOW = new Date('2026-06-10T00:00:00.000Z');

// ---- Shopify-client operation strings (captured verbatim) -------------------

const LEGACY_PRODUCT_FIELDS = `
  id
  title
  handle
  descriptionHtml
  featuredImage { url altText }
  images(first: 10) { edges { node { url altText } } }
  priceRangeV2 { minVariantPrice { amount currencyCode } }
  variants(first: 100) {
    edges { node {
      id
      title
      sku
      price
      compareAtPrice
      inventoryQuantity
      selectedOptions { name value }
      image { url altText }
    } }
  }
`;

const LEGACY_PRODUCTS = `query Products($first: Int!) {
        products(first: $first, sortKey: UPDATED_AT, reverse: true) {
          edges { node { ${LEGACY_PRODUCT_FIELDS} } }
        }
      }`;

const DDD_PRODUCTS = `
query Products($cursor: String, $pageSize: Int!, $country: CountryCode!) {
  products(first: $pageSize, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title status
      media(first: 5) { nodes { preview { image { url } } } }
      variants(first: 100) {
        nodes {
          id title sku inventoryQuantity inventoryPolicy
          contextualPricing(context: { country: $country }) {
            price { amount currencyCode }
            compareAtPrice { amount currencyCode }
          }
        }
      }
    }
  }
}`;

const LEGACY_PRODUCT = `query Product($id: ID!) {
          product(id: $id) { ${LEGACY_PRODUCT_FIELDS} }
        }`;

const LEGACY_VARIANT = `query Variant($id: ID!) {
          productVariant(id: $id) {
            id
            product { ${LEGACY_PRODUCT_FIELDS} }
          }
        }`;

const LEGACY_ORDER_CREATE = `mutation OrderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
        orderCreate(order: $order, options: $options) {
          order { id }
          userErrors { field message }
        }
      }`;

const LEGACY_REFUND_CREATE = `mutation RefundCreate($input: RefundInput!) {
        refundCreate(input: $input) {
          refund { id }
          userErrors { field message }
        }
      }`;

const DDD_ORDER_FULFILLMENTS = `
query OrderFulfillments($id: ID!) {
  order(id: $id) {
    fulfillments(first: 10) {
      displayStatus
      trackingInfo { company number url }
    }
  }
}`;

// ---- Fixtures + fakes -------------------------------------------------------

function makeProduct(): ProductWithRelations {
  return {
    id: 'prod1',
    tenantId: 'default',
    handle: 'tee',
    title: 'Tee',
    description: '<p>Cool</p>',
    status: 'ACTIVE',
    trackInventory: true,
    vendor: null,
    productType: null,
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    images: [
      { id: 'img1', productId: 'prod1', variantId: null, src: 'https://cdn/img.jpg', alt: 'A', position: 0, createdAt: NOW } as never,
    ],
    variants: [
      {
        id: 'var11',
        productId: 'prod1',
        sku: 'SKU1',
        title: 'Default',
        position: 0,
        inventoryQuantity: 5,
        weight: null,
        weightUnit: null,
        barcode: null,
        requiresShipping: true,
        imageId: 'img1',
        createdAt: NOW,
        updatedAt: NOW,
        prices: [
          { id: 'pr1', variantId: 'var11', currencyCode: 'USD', price: '19.99' as never, compareAtPrice: '24.99' as never },
        ],
        options: [{ id: 'o1', variantId: 'var11', name: 'Color', value: 'Red', position: 0 }],
      } as never,
    ],
  } as ProductWithRelations;
}

function fakeProductRepo(product: ProductWithRelations | null): IProductRepository {
  return {
    list: async () => (product ? [product] : []),
    getById: async (id: string) => (product && id === product.id ? product : null),
    getByHandle: async () => product,
    create: async () => product as ProductWithRelations,
    update: async () => product as never,
    delete: async () => {},
    count: async () => (product ? 1 : 0),
  };
}

function fakeVariantRepo(product: ProductWithRelations | null): IVariantRepository {
  const variant = product?.variants[0] as VariantWithRelations | undefined;
  return {
    getById: async (id: string) => (variant && id === variant.id ? variant : null),
    listByProduct: async () => (variant ? [variant] : []),
    decrementInventory: async () => variant as never,
    incrementInventory: async () => variant as never,
  };
}

function fakeOrderRepo(opts: { onCreate?: (input: CreateOrderInput) => void } = {}): IOrderRepository {
  const order: OrderWithRelations = {
    id: 'ord1',
    tenantId: 'default',
    orderNumber: '1001',
    email: 'buyer@example.com',
    financialStatus: 'PAID',
    fulfillmentStatus: 'SHIPPED',
    totalPrice: '19.99' as never,
    subtotalPrice: '19.99' as never,
    taxPrice: '0.00' as never,
    shippingPrice: '0.00' as never,
    discountPrice: '0.00' as never,
    currencyCode: 'USD',
    customerId: null,
    shippingAddress: { firstName: 'John', lastName: 'Doe', address1: '1 Main', city: 'NY', countryCode: 'US', zip: '10001' },
    billingAddress: null,
    note: null,
    externalSource: null,
    externalRef: null,
    trackingNumber: 'TRACK123',
    trackingCompany: 'UPS',
    createdAt: NOW,
    updatedAt: NOW,
    lineItems: [
      { id: 'li1', orderId: 'ord1', variantId: 'var11', productId: 'prod1', title: 'Tee', variantTitle: 'Default', sku: 'SKU1', quantity: 1, price: '19.99' as never, totalDiscount: '0.00' as never },
    ],
    refunds: [],
  } as OrderWithRelations;
  return {
    create: async (input: CreateOrderInput) => {
      opts.onCreate?.(input);
      return order;
    },
    getById: async () => order,
    list: async () => [order],
    updateStatus: async () => order,
    addRefund: async (orderId, amount, currencyCode, reason) => ({
      id: 'ref1',
      orderId,
      amount: amount as never,
      currencyCode,
      reason: reason ?? null,
      refundedAt: NOW,
    }),
    generateOrderNumber: async () => '1001',
  };
}

const WRITE = { writeAccess: true };
const READ = { writeAccess: false };

beforeEach(() => {
  // Stub the AppConfig read so currency lookups resolve to the USD default
  // without touching a database.
  (globalThis as { prisma?: any }).prisma = {
    appConfig: { findUnique: async () => null },
  };
  setProductRepository(fakeProductRepo(makeProduct()));
  setVariantRepository(fakeVariantRepo(makeProduct()));
  setOrderRepository(fakeOrderRepo());
});

afterEach(() => {
  delete (globalThis as { prisma?: PrismaClient }).prisma;
});

function dataOf(result: { status: number; body: { data?: unknown } }): Record<string, any> {
  expect(result.status).toBe(200);
  expect(result.body.data).toBeDefined();
  return result.body.data as Record<string, any>;
}

describe('GraphQL golden — Products (legacy edges/scalar-price shape)', () => {
  it('returns every field the legacy transform reads', async () => {
    const res = await executeGraphql({ query: LEGACY_PRODUCTS, variables: { first: 50 } }, READ);
    const data = dataOf(res);
    const node = data.products.edges[0].node;
    expect(node.id).toBe('gid://shopify/Product/prod1');
    expect(node.title).toBe('Tee');
    expect(node.handle).toBe('tee');
    expect(node.descriptionHtml).toBe('<p>Cool</p>');
    expect(node.featuredImage.url).toBe('https://cdn/img.jpg');
    expect(node.images.edges[0].node.url).toBe('https://cdn/img.jpg');
    expect(node.priceRangeV2.minVariantPrice.amount).toBe('19.99');
    expect(node.priceRangeV2.minVariantPrice.currencyCode).toBe('USD');
    const v = node.variants.edges[0].node;
    expect(v.id).toBe('gid://shopify/ProductVariant/var11');
    expect(v.title).toBe('Default');
    expect(v.sku).toBe('SKU1');
    expect(v.price).toBe('19.99');
    expect(v.compareAtPrice).toBe('24.99');
    expect(v.inventoryQuantity).toBe(5);
    expect(v.selectedOptions[0]).toEqual({ name: 'Color', value: 'Red' });
    expect(v.image.url).toBe('https://cdn/img.jpg');
  });
});

describe('GraphQL golden — Products (DDD nodes/contextualPricing shape)', () => {
  it('matches catalog-adapter.test.ts fixture shape', async () => {
    const res = await executeGraphql(
      { query: DDD_PRODUCTS, variables: { cursor: null, pageSize: 50, country: 'US' } },
      READ,
    );
    const data = dataOf(res);
    expect(data.products.pageInfo.hasNextPage).toBe(false);
    expect(data.products.pageInfo.endCursor).toBe('gid://shopify/Product/prod1');
    const node = data.products.nodes[0];
    expect(node.id).toBe('gid://shopify/Product/prod1');
    expect(node.title).toBe('Tee');
    expect(node.status).toBe('ACTIVE');
    expect(node.media.nodes[0].preview.image.url).toBe('https://cdn/img.jpg');
    const v = node.variants.nodes[0];
    expect(v.id).toBe('gid://shopify/ProductVariant/var11');
    expect(v.title).toBe('Default');
    expect(v.sku).toBe('SKU1');
    expect(v.inventoryQuantity).toBe(5);
    expect(v.inventoryPolicy).toBe('DENY');
    expect(v.contextualPricing.price.amount).toBe('19.99');
    expect(v.contextualPricing.price.currencyCode).toBe('USD');
    expect(v.contextualPricing.compareAtPrice.amount).toBe('24.99');
    expect(v.contextualPricing.compareAtPrice.currencyCode).toBe('USD');
  });

  it('contextualPricing is null (not error) when currency missing', async () => {
    const res = await executeGraphql(
      { query: DDD_PRODUCTS, variables: { cursor: null, pageSize: 50, country: 'JP' } },
      READ,
    );
    const data = dataOf(res);
    expect(data.products.nodes[0].variants.nodes[0].contextualPricing).toBeNull();
  });
});

describe('GraphQL golden — Product(id) and Variant(id)', () => {
  it('Product by gid round-trips and projects', async () => {
    const res = await executeGraphql(
      { query: LEGACY_PRODUCT, variables: { id: 'gid://shopify/Product/prod1' } },
      READ,
    );
    const data = dataOf(res);
    expect(data.product.id).toBe('gid://shopify/Product/prod1');
    expect(data.product.variants.edges[0].node.price).toBe('19.99');
  });

  it('Variant by gid returns product and the .find target survives round-trip', async () => {
    const res = await executeGraphql(
      { query: LEGACY_VARIANT, variables: { id: 'gid://shopify/ProductVariant/var11' } },
      READ,
    );
    const data = dataOf(res);
    expect(data.productVariant.id).toBe('gid://shopify/ProductVariant/var11');
    const found = data.productVariant.product.variants.edges
      .map((e: any) => e.node)
      .find((v: any) => v.id === data.productVariant.id);
    expect(found).toBeDefined();
  });
});

describe('GraphQL golden — OrderCreate', () => {
  it('happy path returns order id + empty userErrors', async () => {
    let captured: CreateOrderInput | null = null;
    setOrderRepository(fakeOrderRepo({ onCreate: (i) => (captured = i) }));
    const res = await executeGraphql(
      {
        query: LEGACY_ORDER_CREATE,
        variables: {
          order: { email: 'buyer@example.com', lineItems: [{ variantId: 'gid://shopify/ProductVariant/var11', quantity: 1 }] },
          options: { sendReceipt: false, sendFulfillmentReceipt: false },
        },
      },
      WRITE,
    );
    const data = dataOf(res);
    expect(data.orderCreate.userErrors).toEqual([]);
    expect(data.orderCreate.order.id).toBe('gid://shopify/Order/ord1');
    expect(captured).not.toBeNull();
    // Line-item enrichment: bare {variantId,quantity} got a title/sku/price.
    expect(captured!.lineItems[0].title).toBe('Default');
    expect(captured!.lineItems[0].sku).toBe('SKU1');
    expect(captured!.lineItems[0].price).toBe('19.99');
    expect(captured!.financialStatus).toBe('PAID');
  });

  it('userErrors path: empty lineItems yields null order + non-empty userErrors at HTTP 200', async () => {
    const res = await executeGraphql(
      { query: LEGACY_ORDER_CREATE, variables: { order: { email: 'x@y.com', lineItems: [] }, options: {} } },
      WRITE,
    );
    const data = dataOf(res);
    expect(data.orderCreate.order).toBeNull();
    expect(data.orderCreate.userErrors.length).toBeGreaterThan(0);
    expect(data.orderCreate.userErrors[0].message).toBeTruthy();
  });

  it('mutation without write access is rejected (403)', async () => {
    const res = await executeGraphql(
      { query: LEGACY_ORDER_CREATE, variables: { order: { lineItems: [{ variantId: 'gid://shopify/ProductVariant/var11', quantity: 1 }] } } },
      READ,
    );
    expect(res.status).toBe(403);
  });
});

describe('GraphQL golden — RefundCreate', () => {
  it('creates a refund and returns its gid', async () => {
    const res = await executeGraphql(
      {
        query: LEGACY_REFUND_CREATE,
        variables: {
          input: {
            orderId: 'gid://shopify/Order/ord1',
            note: 'refund',
            notify: false,
            transactions: [{ orderId: 'gid://shopify/Order/ord1', kind: 'REFUND', amount: '5.00', currency: 'USD' }],
          },
        },
      },
      WRITE,
    );
    const data = dataOf(res);
    expect(data.refundCreate.userErrors).toEqual([]);
    expect(data.refundCreate.refund.id).toBe('gid://shopify/Refund/ref1');
  });

  it('over-refund is guarded via userErrors', async () => {
    const res = await executeGraphql(
      {
        query: LEGACY_REFUND_CREATE,
        variables: {
          input: {
            orderId: 'gid://shopify/Order/ord1',
            transactions: [{ amount: '99.00', currency: 'USD' }],
          },
        },
      },
      WRITE,
    );
    const data = dataOf(res);
    expect(data.refundCreate.refund).toBeNull();
    expect(data.refundCreate.userErrors.length).toBeGreaterThan(0);
  });
});

describe('GraphQL golden — OrderFulfillments', () => {
  it('synthesizes one fulfillment node from order-level shipping fields', async () => {
    const res = await executeGraphql(
      { query: DDD_ORDER_FULFILLMENTS, variables: { id: 'gid://shopify/Order/ord1' } },
      READ,
    );
    const data = dataOf(res);
    const f = data.order.fulfillments[0];
    expect(f.displayStatus).toBe('IN_TRANSIT');
    expect(f.trackingInfo[0]).toEqual({ company: 'UPS', number: 'TRACK123', url: null });
  });
});

// Projectors turn picocart records into Shopify-Admin-GraphQL response shapes.
// Each object emits the SUPERSET of fields used by the two common client query
// styles (legacy edges/scalar-price and nodes/contextualPricing), so a single
// resolver serves both; each client simply reads the subset it selected.

import type {
  Order,
  OrderLineItem,
  OrderRefund,
  Product,
  ProductImage,
  ProductStatus,
  ProductVariant,
  VariantOption,
  VariantPrice,
} from '@prisma/client';
import { encodeGid } from './gid';
import { pickPriceOrNull } from './country';

export type VariantRecord = ProductVariant & { prices: VariantPrice[]; options: VariantOption[] };
export type ProductRecord = Product & { variants: VariantRecord[]; images: ProductImage[] };
export type OrderRecord = Order & { lineItems: OrderLineItem[]; refunds: OrderRefund[] };

function decimalString(value: { toString(): string } | string | number | null | undefined): string {
  if (value === null || value === undefined) return '0.00';
  return Number(value.toString()).toFixed(2);
}

function statusEnum(status: ProductStatus): 'ACTIVE' | 'DRAFT' | 'ARCHIVED' {
  return status;
}

// Track-inventory maps to DENY (stop selling at zero); otherwise CONTINUE.
function inventoryPolicy(trackInventory: boolean): 'DENY' | 'CONTINUE' {
  return trackInventory ? 'DENY' : 'CONTINUE';
}

function imageNode(image: ProductImage | undefined): { url: string; altText: string | null } | null {
  if (!image) return null;
  return { url: image.src, altText: image.alt ?? null };
}

function variantImage(variant: ProductVariant, images: ProductImage[]): ProductImage | undefined {
  if (variant.imageId) return images.find((i) => i.id === variant.imageId);
  return undefined;
}

function selectedOptions(options: VariantOption[]): Array<{ name: string; value: string }> {
  return [...options]
    .sort((a, b) => a.position - b.position)
    .map((o) => ({ name: o.name, value: o.value }));
}

export function projectVariant(
  variant: VariantRecord,
  trackInventory: boolean,
  images: ProductImage[],
  currencyCode: string,
): Record<string, unknown> {
  const price = pickPriceOrNull(variant.prices, currencyCode);
  const hasCompareAt = price && price.compareAtPrice !== null && price.compareAtPrice !== undefined;
  const compareAtPrice = hasCompareAt ? decimalString(price.compareAtPrice as unknown as string) : null;
  const contextual = price
    ? {
        price: {
          amount: decimalString(price.price as unknown as string),
          currencyCode: price.currencyCode,
        },
        compareAtPrice: hasCompareAt
          ? { amount: compareAtPrice as string, currencyCode: price.currencyCode }
          : null,
      }
    : null;
  return {
    id: encodeGid('ProductVariant', variant.id),
    title: variant.title,
    sku: variant.sku ?? null,
    price: price ? decimalString(price.price as unknown as string) : '0.00',
    compareAtPrice,
    inventoryQuantity: variant.inventoryQuantity,
    inventoryPolicy: inventoryPolicy(trackInventory),
    selectedOptions: selectedOptions(variant.options),
    image: imageNode(variantImage(variant, images)),
    contextualPricing: contextual,
  };
}

export function projectProduct(product: ProductRecord, currencyCode: string): Record<string, unknown> {
  const sortedVariants = [...product.variants].sort((a, b) => a.position - b.position);
  const sortedImages = [...product.images].sort((a, b) => a.position - b.position);
  const featured = sortedImages[0];
  const variantNodes = sortedVariants.map((v) =>
    projectVariant(v, product.trackInventory, sortedImages, currencyCode),
  );
  const minPrice = variantNodes
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)[0];

  return {
    id: encodeGid('Product', product.id),
    title: product.title,
    handle: product.handle,
    status: statusEnum(product.status),
    descriptionHtml: product.description ?? null,
    featuredImage: imageNode(featured),
    images: { edges: sortedImages.map((img) => ({ node: imageNode(img) })) },
    media: {
      nodes: sortedImages.map((img) => ({ preview: { image: { url: img.src } } })),
    },
    priceRangeV2: {
      minVariantPrice: {
        amount: decimalString(minPrice ?? 0),
        currencyCode,
      },
    },
    variants: {
      edges: variantNodes.map((node) => ({ node })),
      nodes: variantNodes,
    },
  };
}

function moneySet(amount: string, currencyCode: string): Record<string, unknown> {
  const money = { amount, currencyCode };
  return { shopMoney: money, presentmentMoney: money };
}

function financialStatusEnum(order: Order): string {
  switch (order.financialStatus) {
    case 'PAID':
      return 'PAID';
    case 'PARTIALLY_REFUNDED':
      return 'PARTIALLY_REFUNDED';
    case 'REFUNDED':
      return 'REFUNDED';
    default:
      return 'PENDING';
  }
}

function fulfillmentStatusEnum(order: Order): string {
  switch (order.fulfillmentStatus) {
    case 'SHIPPED':
    case 'DELIVERED':
      return 'FULFILLED';
    default:
      return 'UNFULFILLED';
  }
}

function addressNode(addr: unknown): Record<string, unknown> | null {
  if (!addr || typeof addr !== 'object') return null;
  const a = addr as Record<string, unknown>;
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = a[k];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return null;
  };
  return {
    firstName: pick('firstName', 'first_name'),
    lastName: pick('lastName', 'last_name'),
    company: pick('company'),
    address1: pick('address1'),
    address2: pick('address2'),
    city: pick('city'),
    province: pick('province'),
    provinceCode: pick('provinceCode', 'province_code'),
    zip: pick('zip', 'postalCode'),
    country: pick('country'),
    countryCode: pick('countryCode', 'country_code'),
    phone: pick('phone'),
  };
}

function lineItemNode(li: OrderLineItem): Record<string, unknown> {
  const unit = decimalString(li.price as unknown as string);
  return {
    id: encodeGid('Order', li.id),
    name: li.title,
    sku: li.sku ?? null,
    quantity: li.quantity,
    variant: {
      id: li.variantId ? encodeGid('ProductVariant', li.variantId) : null,
      image: null,
      product: { id: li.productId ? encodeGid('Product', li.productId) : null },
    },
    originalUnitPriceSet: moneySet(unit, ''),
  };
}

// One fulfillment node synthesized from order-level shipping fields; empty list
// while UNFULFILLED. SHIPPED -> IN_TRANSIT, DELIVERED -> DELIVERED.
export function projectFulfillments(order: Order): Array<Record<string, unknown>> {
  if (order.fulfillmentStatus === 'UNFULFILLED') return [];
  const displayStatus = order.fulfillmentStatus === 'DELIVERED' ? 'DELIVERED' : 'IN_TRANSIT';
  return [
    {
      id: encodeGid('Fulfillment', order.id),
      status: 'SUCCESS',
      displayStatus,
      createdAt: order.updatedAt.toISOString(),
      trackingInfo: [
        {
          company: order.trackingCompany ?? null,
          number: order.trackingNumber ?? null,
          url: null,
        },
      ],
    },
  ];
}

export function projectOrder(order: OrderRecord): Record<string, unknown> {
  const currency = order.currencyCode;
  const lineItemNodes = order.lineItems.map(lineItemNode).map((node) => {
    const set = node.originalUnitPriceSet as { shopMoney: { amount: string } };
    return {
      ...node,
      originalUnitPriceSet: moneySet(set.shopMoney.amount, currency),
    };
  });
  return {
    id: encodeGid('Order', order.id),
    name: `#${order.orderNumber}`,
    displayFinancialStatus: financialStatusEnum(order),
    displayFulfillmentStatus: fulfillmentStatusEnum(order),
    email: order.email ?? null,
    createdAt: order.createdAt.toISOString(),
    currencyCode: currency,
    presentmentCurrencyCode: currency,
    subtotalPriceSet: moneySet(decimalString(order.subtotalPrice as unknown as string), currency),
    totalShippingPriceSet: moneySet(decimalString(order.shippingPrice as unknown as string), currency),
    totalTaxSet: moneySet(decimalString(order.taxPrice as unknown as string), currency),
    totalDiscountsSet: moneySet(decimalString(order.discountPrice as unknown as string), currency),
    totalPriceSet: moneySet(decimalString(order.totalPrice as unknown as string), currency),
    shippingAddress: addressNode(order.shippingAddress),
    billingAddress: addressNode(order.billingAddress),
    lineItems: { edges: lineItemNodes.map((node) => ({ node })) },
    fulfillments: projectFulfillments(order),
  };
}

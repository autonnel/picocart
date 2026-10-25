import { getOrderRepository, type CreateOrderInput, type OrderLineItemInput } from '@/lib/repositories/order.repository';
import { getVariantRepository } from '@/lib/repositories/variant.repository';
import { getDefaultCurrencyCode } from '@/lib/shopify/api-utils';
import { decodeGid, encodeGid } from '../gid';
import { projectOrder } from '../projectors';
import type { GraphqlVariables } from '../router';
import type { Prisma } from '@prisma/client';

export interface UserError {
  field: string[] | null;
  message: string;
}

interface OrderInputLine {
  variantId?: string | null;
  quantity?: number | null;
  priceSet?: { shopMoney?: { amount: string; currencyCode: string } };
  originalUnitPriceWithCurrency?: { amount: string; currencyCode: string };
}

interface OrderInputShape {
  email?: string | null;
  lineItems?: OrderInputLine[];
  shippingAddress?: Record<string, unknown> | null;
  billingAddress?: Record<string, unknown> | null;
  note?: string | null;
  tags?: string[];
  financialStatus?: string | null;
  currency?: string;
  presentmentCurrencyCode?: string;
  discountCode?: { orderFixedDiscountCode?: { code?: string; amountSet?: { shopMoney?: { amount: string } } } };
  appliedDiscount?: { value?: number | string; valueType?: string };
}

function requestedDiscount(input: OrderInputShape): number {
  const fromCode = input.discountCode?.orderFixedDiscountCode?.amountSet?.shopMoney?.amount;
  const applied = input.appliedDiscount;
  const raw = fromCode ?? (applied?.valueType === 'FIXED_AMOUNT' ? applied.value : undefined);
  if (raw === undefined) return 0;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid discount amount: ${raw}`);
  return amount;
}

function toBase64Url(json: string): string {
  return Buffer.from(json, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

export function encodeDraftId(input: OrderInputShape): string {
  return encodeGid('DraftOrder', toBase64Url(JSON.stringify(input)));
}

export function decodeDraftInput(draftGid: string): OrderInputShape {
  const encoded = decodeGid(draftGid);
  return JSON.parse(fromBase64Url(encoded)) as OrderInputShape;
}

// Enriches client line items ({variantId, quantity}) into full OrderLineItem
// inputs by looking up each variant; returns resolved currency + computed totals.
async function buildLineItems(
  input: OrderInputShape,
): Promise<{ lineItems: OrderLineItemInput[]; subtotal: number; currency: string }> {
  const variantRepo = getVariantRepository();
  const fallbackCurrency = await getDefaultCurrencyCode();
  const lines: OrderLineItemInput[] = [];
  let subtotal = 0;
  // Older clients send no currency; with auto-pricing a variant has several price rows in no
  // defined order, so the order must fall back to the store default, never to the first row.
  const currency = (input.currency ?? input.presentmentCurrencyCode)?.toUpperCase() || fallbackCurrency;

  for (const li of input.lineItems ?? []) {
    const quantity = li.quantity ?? 1;
    const variantId = li.variantId ? decodeGid(li.variantId) : null;
    if (!variantId) {
      lines.push({ title: 'Item', quantity, price: '0.00' });
      continue;
    }
    const variant = await variantRepo.getById(variantId);
    if (!variant) {
      lines.push({ variantId, title: 'Item', quantity, price: '0.00' });
      continue;
    }
    const sentAmount = li.priceSet?.shopMoney?.amount ?? li.originalUnitPriceWithCurrency?.amount;
    let unit: number;
    if (sentAmount !== undefined) {
      unit = Number(sentAmount);
      if (!Number.isFinite(unit) || unit < 0) throw new Error(`Invalid line amount: ${sentAmount}`);
    } else {
      const priceRow = variant.prices.find((p) => p.currencyCode.toUpperCase() === currency);
      if (!priceRow) throw new Error(`No price for variant ${variantId} in ${currency}`);
      unit = Number(priceRow.price.toString());
    }
    subtotal += unit * quantity;
    lines.push({
      variantId,
      productId: variant.productId,
      title: variant.title || 'Item',
      sku: variant.sku ?? null,
      quantity,
      price: unit.toFixed(2),
    });
  }

  return { lineItems: lines, subtotal, currency };
}

async function createPaidOrder(input: OrderInputShape) {
  const requested = requestedDiscount(input);
  const { lineItems, subtotal, currency } = await buildLineItems(input);
  const repo = getOrderRepository();
  const discount = Math.min(requested, subtotal);
  const createInput: CreateOrderInput = {
    email: input.email ?? null,
    financialStatus: 'PAID',
    totalPrice: (subtotal - discount).toFixed(2),
    subtotalPrice: subtotal.toFixed(2),
    ...(discount > 0 ? { discountPrice: discount.toFixed(2) } : {}),
    currencyCode: currency,
    shippingAddress: (input.shippingAddress ?? undefined) as Prisma.InputJsonValue | undefined,
    billingAddress: (input.billingAddress ?? undefined) as Prisma.InputJsonValue | undefined,
    note: input.note ?? null,
    customer: input.email ? { email: input.email } : null,
    lineItems,
  };
  return repo.create(createInput);
}

export async function resolveOrder(vars: GraphqlVariables): Promise<Record<string, unknown>> {
  const id = decodeGid((vars.id as string) ?? '');
  const repo = getOrderRepository();
  const order = id ? await repo.getById(id) : null;
  return { order: order ? projectOrder(order) : null };
}

export async function resolveOrderCreate(vars: GraphqlVariables): Promise<Record<string, unknown>> {
  const input = (vars.order ?? {}) as OrderInputShape;
  const userErrors: UserError[] = [];
  if (!input.lineItems || input.lineItems.length === 0) {
    userErrors.push({ field: ['order', 'lineItems'], message: 'At least one line item is required' });
    return { orderCreate: { order: null, userErrors } };
  }
  try {
    const order = await createPaidOrder(input);
    return { orderCreate: { order: projectOrder(order), userErrors: [] } };
  } catch (err) {
    return {
      orderCreate: {
        order: null,
        userErrors: [{ field: null, message: err instanceof Error ? err.message : 'orderCreate failed' }],
      },
    };
  }
}

export async function resolveDraftOrderCreate(vars: GraphqlVariables): Promise<Record<string, unknown>> {
  const input = (vars.input ?? {}) as OrderInputShape;
  const userErrors: UserError[] = [];
  if (!input.lineItems || input.lineItems.length === 0) {
    userErrors.push({ field: ['input', 'lineItems'], message: 'At least one line item is required' });
    return { draftOrderCreate: { draftOrder: null, userErrors } };
  }
  return {
    draftOrderCreate: {
      draftOrder: { id: encodeDraftId(input) },
      userErrors: [],
    },
  };
}

export async function resolveDraftOrderComplete(vars: GraphqlVariables): Promise<Record<string, unknown>> {
  const draftGid = (vars.id as string) ?? '';
  let input: OrderInputShape;
  try {
    input = decodeDraftInput(draftGid);
  } catch {
    return {
      draftOrderComplete: {
        draftOrder: null,
        userErrors: [{ field: ['id'], message: 'Invalid draft order id' }],
      },
    };
  }
  try {
    const order = await createPaidOrder(input);
    return {
      draftOrderComplete: {
        draftOrder: { id: draftGid, order: projectOrder(order) },
        userErrors: [],
      },
    };
  } catch (err) {
    return {
      draftOrderComplete: {
        draftOrder: null,
        userErrors: [{ field: null, message: err instanceof Error ? err.message : 'draftOrderComplete failed' }],
      },
    };
  }
}

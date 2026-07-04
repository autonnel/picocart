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
}

interface OrderInputShape {
  email?: string | null;
  lineItems?: OrderInputLine[];
  shippingAddress?: Record<string, unknown> | null;
  billingAddress?: Record<string, unknown> | null;
  note?: string | null;
  tags?: string[];
  financialStatus?: string | null;
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
  let currency: string | null = null;

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
    if (!currency) {
      currency = variant.prices[0]?.currencyCode ?? fallbackCurrency;
    }
    const priceRow =
      variant.prices.find((p) => p.currencyCode.toUpperCase() === currency!.toUpperCase()) ??
      variant.prices[0];
    const unit = priceRow ? Number(priceRow.price.toString()) : 0;
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

  return { lineItems: lines, subtotal, currency: currency ?? fallbackCurrency };
}

async function createPaidOrder(input: OrderInputShape) {
  const { lineItems, subtotal, currency } = await buildLineItems(input);
  const repo = getOrderRepository();
  const createInput: CreateOrderInput = {
    email: input.email ?? null,
    financialStatus: 'PAID',
    totalPrice: subtotal.toFixed(2),
    subtotalPrice: subtotal.toFixed(2),
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

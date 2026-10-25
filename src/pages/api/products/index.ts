import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withAuth, jsonResponse, jsonError } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import { getProductRepository } from '@/lib/repositories/product.repository';
import type { ProductStatus } from '@prisma/client';
import { getCurrencyConfig } from '@/lib/dashboard/currencies';
import { forceDefaultCurrencyManual } from '@/lib/pricing/auto-price';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:Products');

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'product';
}

const StatusEnum = z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']);

const VariantPriceSchema = z.object({
  currencyCode: z.string().min(1),
  price: z.union([z.number(), z.string()]),
  compareAtPrice: z.union([z.number(), z.string(), z.null()]).optional(),
  isManual: z.boolean().optional(),
});

const VariantOptionSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
  position: z.number().int().optional(),
});

const VariantSchema = z.object({
  sku: z.string().nullable().optional(),
  title: z.string().min(1),
  position: z.number().int().optional(),
  inventoryQuantity: z.number().int().optional(),
  weight: z.number().nullable().optional(),
  weightUnit: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  requiresShipping: z.boolean().optional(),
  options: z.array(VariantOptionSchema).optional(),
  prices: z.array(VariantPriceSchema).optional(),
});

const ImageSchema = z.object({
  src: z.string().url(),
  alt: z.string().nullable().optional(),
  position: z.number().int().optional(),
});

const CreateProductSchema = z.object({
  title: z.string().min(1).max(200),
  handle: z.string().min(1).max(120).optional(),
  status: StatusEnum.optional(),
  description: z.string().nullable().optional(),
  trackInventory: z.boolean().optional(),
  vendor: z.string().nullable().optional(),
  productType: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  variants: z.array(VariantSchema).optional(),
  images: z.array(ImageSchema).optional(),
});

export const GET: APIRoute = withAuth(FEATURES.PRODUCTS, async ({ request }) => {
  const url = new URL(request.url);
  const sp = url.searchParams;
  const limitRaw = parseInt(sp.get('limit') || '50', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 250);
  const sinceId = sp.get('sinceId') || undefined;
  const statusRaw = (sp.get('status') || '').toUpperCase();
  const status: ProductStatus | undefined =
    statusRaw === 'ACTIVE' || statusRaw === 'DRAFT' || statusRaw === 'ARCHIVED'
      ? (statusRaw as ProductStatus)
      : undefined;
  const q = (sp.get('q') || '').trim();

  const repo = getProductRepository();
  const list = await repo.list({ status, sinceId, limit });
  const filtered = q
    ? list.filter(
        (p) =>
          p.title.toLowerCase().includes(q.toLowerCase()) ||
          p.handle.toLowerCase().includes(q.toLowerCase()),
      )
    : list;
  return jsonResponse({ products: filtered });
});

export const POST: APIRoute = withAuth(FEATURES.PRODUCTS_WRITE, async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = CreateProductSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'VALIDATION', issues: parsed.error.issues }, 400);
  }
  const data = parsed.data;
  const handle = data.handle ? slugify(data.handle) : slugify(data.title);
  const repo = getProductRepository();

  try {
    const { default: defaultCurrency } = await getCurrencyConfig();
    const variants =
      !data.variants || data.variants.length === 0
        ? [{ title: 'Default Title', position: 0, prices: [], options: [] }]
        : forceDefaultCurrencyManual(data.variants, defaultCurrency);
    const product = await repo.create({
      title: data.title,
      handle,
      status: data.status,
      description: data.description ?? null,
      trackInventory: data.trackInventory ?? false,
      vendor: data.vendor ?? null,
      productType: data.productType ?? null,
      tags: data.tags ?? [],
      variants,
      images: data.images ?? [],
    });
    return jsonResponse({ product }, 201);
  } catch (error) {
    logger.error('Create product failed', { error });
    return jsonError('Failed to create product', 500);
  }
});

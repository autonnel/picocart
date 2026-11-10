import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withAuth, jsonResponse, jsonError } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import { getProductRepository } from '@/lib/repositories/product.repository';
import { prisma } from '@/lib/db';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';
import { Prisma } from '@prisma/client';
import { syncAutoPrices } from '@/lib/pricing/auto-price-sync';
import { getCurrencyConfig } from '@/lib/dashboard/currencies';
import { forceDefaultCurrencyManual, pricesToWrite } from '@/lib/pricing/auto-price';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:ProductDetail');

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
  id: z.string().optional(),
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
  imageId: z.string().nullable().optional(),
  imagePosition: z.number().int().min(0).optional(),
});

const UPDATE_TRANSACTION_TIMEOUT_MS = 60_000;

const ImageSchema = z.object({
  id: z.string().optional(),
  src: z.string().url(),
  alt: z.string().nullable().optional(),
  position: z.number().int().optional(),
});

const UpdateProductSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  handle: z.string().min(1).max(120).optional(),
  status: StatusEnum.optional(),
  description: z.string().nullable().optional(),
  trackInventory: z.boolean().optional(),
  vendor: z.string().nullable().optional(),
  productType: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  variants: z.array(VariantSchema).optional(),
  variantChanges: z
    .object({
      upsert: z.array(VariantSchema),
      remove: z.array(z.string()),
    })
    .optional(),
  images: z.array(ImageSchema).optional(),
});

export const GET: APIRoute = withAuth(FEATURES.PRODUCTS, async ({ params }) => {
  const id = params.id;
  if (!id) return jsonError('Missing id', 400);
  const repo = getProductRepository();
  const product = await repo.getById(id);
  if (!product) return jsonError('Not found', 404);
  return jsonResponse({ product });
});

export const PUT: APIRoute = withAuth(FEATURES.PRODUCTS_WRITE, async ({ params, request }) => {
  const id = params.id;
  if (!id) return jsonError('Missing id', 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = UpdateProductSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'VALIDATION', issues: parsed.error.issues }, 400);
  }
  const data = parsed.data;

  try {
    const existing = await prisma.product.findFirst({
      where: withTenantWhere({ id }),
      include: { variants: { include: { prices: true, options: true } }, images: true },
    });
    if (!existing) return jsonError('Not found', 404);

    const { default: defaultCurrency, rates } = await getCurrencyConfig();

    const existingVariantIds = new Set(existing.variants.map((row) => row.id));
    let variantPlan: { upsert: z.infer<typeof VariantSchema>[]; remove: string[] } | null = null;
    if (data.variantChanges !== undefined) {
      const foreign = data.variantChanges.upsert.find((v) => v.id && !existingVariantIds.has(v.id));
      if (foreign) return jsonError(`Variant ${foreign.id} does not belong to this product`, 400);
      variantPlan = {
        upsert: forceDefaultCurrencyManual(data.variantChanges.upsert, defaultCurrency),
        remove: data.variantChanges.remove.filter((variantId) => existingVariantIds.has(variantId)),
      };
    } else if (data.variants !== undefined) {
      const incoming =
        data.variants.length === 0
          ? [{ title: 'Default Title', position: 0, options: [], prices: [] }]
          : forceDefaultCurrencyManual(data.variants, defaultCurrency);
      const incomingIds = new Set(incoming.filter((v) => v.id).map((v) => v.id as string));
      variantPlan = {
        upsert: incoming,
        remove: [...existingVariantIds].filter((variantId) => !incomingIds.has(variantId)),
      };
    }

    await prisma.$transaction(async (tx) => {
      const productData: Prisma.ProductUpdateInput = {};
      if (data.title !== undefined) productData.title = data.title;
      if (data.handle !== undefined) productData.handle = data.handle;
      if (data.description !== undefined) productData.description = data.description;
      if (data.status !== undefined) productData.status = data.status;
      if (data.trackInventory !== undefined) productData.trackInventory = data.trackInventory;
      if (data.vendor !== undefined) productData.vendor = data.vendor;
      if (data.productType !== undefined) productData.productType = data.productType;
      if (data.tags !== undefined) productData.tags = data.tags;
      if (Object.keys(productData).length > 0) {
        await tx.product.update({ where: { id }, data: productData });
      }

      let imageIds = [...existing.images].sort((a, b) => a.position - b.position).map((img) => img.id);
      if (data.images !== undefined) {
        imageIds = [];
        const incomingIds = new Set(
          data.images.filter((i) => i.id).map((i) => i.id as string),
        );
        for (const img of existing.images) {
          if (!incomingIds.has(img.id)) {
            await tx.productImage.delete({ where: { id: img.id } });
          }
        }
        for (let i = 0; i < data.images.length; i++) {
          const img = data.images[i];
          if (img.id) {
            await tx.productImage.update({
              where: { id: img.id },
              data: { src: img.src, alt: img.alt ?? null, position: img.position ?? i },
            });
            imageIds.push(img.id);
          } else {
            const created = await tx.productImage.create({
              data: {
                productId: id,
                src: img.src,
                alt: img.alt ?? null,
                position: img.position ?? i,
              },
            });
            imageIds.push(created.id);
          }
        }
      }

      const variantImageId = (v: { imageId?: string | null; imagePosition?: number }) => {
        if (v.imagePosition !== undefined) return imageIds[v.imagePosition] ?? null;
        if (v.imageId === undefined) return undefined;
        return v.imageId && imageIds.includes(v.imageId) ? v.imageId : null;
      };

      if (variantPlan) {
        for (const variantId of variantPlan.remove) {
          await tx.productVariant.delete({ where: { id: variantId } });
        }
        const touchedVariantIds: string[] = [];
        for (let i = 0; i < variantPlan.upsert.length; i++) {
          const v = variantPlan.upsert[i];
          const fields = {
            sku: v.sku ?? null,
            title: v.title,
            position: v.position ?? i,
            inventoryQuantity: v.inventoryQuantity ?? 0,
            weight: v.weight ?? null,
            weightUnit: v.weightUnit ?? null,
            barcode: v.barcode ?? null,
            requiresShipping: v.requiresShipping ?? true,
          };
          let variantId: string;
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: { ...fields, imageId: variantImageId(v) },
            });
            variantId = v.id;
          } else {
            const created = await tx.productVariant.create({
              data: { ...fields, productId: id, imageId: variantImageId(v) ?? null },
            });
            variantId = created.id;
          }
          touchedVariantIds.push(variantId);

          await tx.variantOption.deleteMany({ where: { variantId } });
          const opts = v.options ?? [];
          if (opts.length > 0) {
            await tx.variantOption.createMany({
              data: opts.map((o, oi) => ({
                variantId,
                name: o.name,
                value: o.value,
                position: o.position ?? oi,
              })),
            });
          }

          await tx.variantPrice.deleteMany({ where: { variantId } });
          const priceRows = pricesToWrite(v.prices ?? [], rates).map((p) => ({
            variantId,
            currencyCode: p.currencyCode,
            price: p.price as Prisma.Decimal | number | string,
            compareAtPrice:
              p.compareAtPrice === undefined || p.compareAtPrice === null
                ? null
                : (p.compareAtPrice as Prisma.Decimal | number | string),
          }));
          if (priceRows.length > 0) await tx.variantPrice.createMany({ data: priceRows });
        }
        if (touchedVariantIds.length > 0) await syncAutoPrices(tx, { variantIds: touchedVariantIds });
      }
    }, { timeout: UPDATE_TRANSACTION_TIMEOUT_MS });

    const repo = getProductRepository();
    const fresh = await repo.getById(id);
    return jsonResponse({ product: fresh });
  } catch (error) {
    logger.error('Update product failed', { error, productId: id });
    return jsonError('Failed to update product', 500);
  }
});

export const DELETE: APIRoute = withAuth(FEATURES.PRODUCTS_WRITE, async ({ params }) => {
  const id = params.id;
  if (!id) return jsonError('Missing id', 400);
  const repo = getProductRepository();
  try {
    await repo.delete(id);
    return jsonResponse({ ok: true });
  } catch (error) {
    logger.error('Delete product failed', { error, productId: id });
    return jsonError('Failed to delete product', 500);
  }
});

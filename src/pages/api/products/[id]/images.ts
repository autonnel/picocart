import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withAuth, jsonResponse, jsonError } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:ProductImages');

const ImageSchema = z.object({
  src: z.string().url(),
  alt: z.string().nullable().optional(),
  position: z.number().int().optional(),
});

export const POST: APIRoute = withAuth(FEATURES.PRODUCTS_WRITE, async ({ params, request }) => {
  const productId = params.id;
  if (!productId) return jsonError('Missing id', 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = ImageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'VALIDATION', issues: parsed.error.issues }, 400);
  }

  const product = await prisma.product.findFirst({
    where: withTenantWhere({ id: productId }),
    select: { id: true },
  });
  if (!product) return jsonError('Not found', 404);

  try {
    const count = await prisma.productImage.count({ where: { productId } });
    const image = await prisma.productImage.create({
      data: {
        productId,
        src: parsed.data.src,
        alt: parsed.data.alt ?? null,
        position: parsed.data.position ?? count,
      },
    });
    return jsonResponse({ image }, 201);
  } catch (error) {
    logger.error('Create image failed', { error, productId });
    return jsonError('Failed to add image', 500);
  }
});

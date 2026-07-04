import type { APIRoute } from 'astro';
import { withAuth, jsonResponse, jsonError } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';
import { getStorageConfig } from '@/lib/dashboard/storage-config';
import { EdgeS3Client } from '@/lib/adapters/storage/s3';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:ProductUploadImage');

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const MAX_BYTES = 10 * 1024 * 1024;

function extFromContentType(contentType: string): string {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('avif')) return 'avif';
  return 'bin';
}

function randomKeyPart(): string {
  const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function buildPublicUrl(opts: {
  publicBaseUrl?: string | null;
  endpoint?: string | null;
  bucket: string;
  key: string;
}): string {
  const { publicBaseUrl, endpoint, bucket, key } = opts;
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
  if (endpoint) {
    return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
  }
  return `https://${bucket}.s3.amazonaws.com/${key}`;
}

export const POST: APIRoute = withAuth(FEATURES.PRODUCTS_WRITE, async ({ params, request }) => {
  const productId = params.id;
  if (!productId) return jsonError('Missing id', 400);

  const product = await prisma.product.findFirst({
    where: withTenantWhere({ id: productId }),
    select: { id: true },
  });
  if (!product) return jsonError('Not found', 404);

  const storage = await getStorageConfig();
  if (!storage) {
    return jsonResponse(
      {
        error: 'S3_NOT_CONFIGURED',
        message: 'Configure storage in Settings → Storage',
      },
      412,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Expected multipart/form-data body', 400);
  }
  const fileEntry = form.get('file');
  if (!(fileEntry instanceof File)) {
    return jsonError('Missing file field', 400);
  }
  const file = fileEntry;
  if (file.size <= 0) return jsonError('Empty file', 400);
  if (file.size > MAX_BYTES) return jsonError('File too large (max 10MB)', 413);

  const contentType = file.type || 'application/octet-stream';
  if (!ALLOWED_TYPES.has(contentType)) {
    return jsonError(`Unsupported content type: ${contentType}`, 415);
  }

  const ext = extFromContentType(contentType);
  const key = `products/${productId}/${randomKeyPart()}.${ext}`;

  try {
    const client = new EdgeS3Client({
      endpoint: storage.endpoint || `https://s3.${storage.region}.amazonaws.com`,
      region: storage.region,
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
      bucket: storage.bucket,
    });
    const buffer = await file.arrayBuffer();
    await client.putObject(key, buffer, contentType, 'public, max-age=31536000');

    const src = buildPublicUrl({
      publicBaseUrl: storage.publicBaseUrl,
      endpoint: storage.endpoint,
      bucket: storage.bucket,
      key,
    });

    const count = await prisma.productImage.count({ where: { productId } });
    const altRaw = form.get('alt');
    const alt = typeof altRaw === 'string' && altRaw.length > 0 ? altRaw : null;

    const image = await prisma.productImage.create({
      data: {
        productId,
        src,
        alt,
        position: count,
      },
    });
    return jsonResponse({ image }, 201);
  } catch (error) {
    logger.error('Upload image failed', { error, productId });
    return jsonError('Failed to upload image', 500);
  }
});

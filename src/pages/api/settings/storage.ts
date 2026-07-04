import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import {
  getStorageConfig,
  getStorageConfigPublic,
  setStorageConfig,
} from '@/lib/dashboard/storage-config';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:SettingsStorage');

const Schema = z.object({
  bucket: z.string().min(1),
  region: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().optional(),
  endpoint: z.string().nullable().optional(),
  publicBaseUrl: z.string().nullable().optional(),
});

export const GET: APIRoute = withAuth(FEATURES.SETTINGS_STORAGE, async () => {
  return jsonResponse({ storage: await getStorageConfigPublic() });
});

export const PUT: APIRoute = withAuth(FEATURES.SETTINGS_STORAGE, async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'VALIDATION', issues: parsed.error.issues }, 400);
  }
  try {
    const existing = await getStorageConfig();
    const secretAccessKey =
      parsed.data.secretAccessKey && parsed.data.secretAccessKey.length > 0
        ? parsed.data.secretAccessKey
        : existing?.secretAccessKey ?? '';
    if (!secretAccessKey) {
      return jsonResponse({ error: 'secretAccessKey is required for first-time setup' }, 400);
    }
    await setStorageConfig({
      bucket: parsed.data.bucket,
      region: parsed.data.region,
      accessKeyId: parsed.data.accessKeyId,
      secretAccessKey,
      endpoint: parsed.data.endpoint ?? null,
      publicBaseUrl: parsed.data.publicBaseUrl ?? null,
    });
    return jsonResponse({ storage: await getStorageConfigPublic() });
  } catch (error) {
    logger.error('Update storage failed', { error });
    return jsonResponse({ error: 'Failed to update storage' }, 500);
  }
});

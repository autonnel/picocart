import type { APIRoute } from 'astro';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:SettingsApiKeyDetail');

export const DELETE: APIRoute = withAuth(FEATURES.SETTINGS_API_KEYS, async ({ params }) => {
  const id = params.id;
  if (!id) return jsonResponse({ error: 'Missing id' }, 400);
  const existing = await prisma.apiKey.findFirst({ where: withTenantWhere({ id }) });
  if (!existing) return jsonResponse({ error: 'Not found' }, 404);
  try {
    await prisma.apiKey.delete({ where: { id } });
    return jsonResponse({ ok: true });
  } catch (error) {
    logger.error('Delete api key failed', { error, keyId: id });
    return jsonResponse({ error: 'Failed to delete API key' }, 500);
  }
});

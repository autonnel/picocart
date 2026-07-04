import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES, getPermissionRepository, type FeatureId } from '@/lib/permissions';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:SettingsRoleFeatures');

const VALID_FEATURE_IDS = new Set<string>(Object.values(FEATURES));

const Schema = z.object({
  featureIds: z.array(z.string()),
});

export const PUT: APIRoute = withAuth(FEATURES.SETTINGS_PERMISSIONS, async ({ params, request }) => {
  const id = params.id;
  if (!id) return jsonResponse({ error: 'Missing id' }, 400);
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
  const filtered = parsed.data.featureIds.filter((f) => VALID_FEATURE_IDS.has(f)) as FeatureId[];
  try {
    const repo = getPermissionRepository();
    const role = await repo.getRoleById(id);
    if (!role) return jsonResponse({ error: 'Not found' }, 404);
    if (role.isSystem) return jsonResponse({ error: 'System role features cannot be changed' }, 400);
    await repo.setRoleFeatures(id, filtered);
    return jsonResponse({ ok: true, featureIds: filtered });
  } catch (error) {
    logger.error('Update role features failed', { error, roleId: id });
    return jsonResponse({ error: 'Failed to update features' }, 500);
  }
});

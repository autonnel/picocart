import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES, FEATURE_LABELS, getPermissionRepository } from '@/lib/permissions';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:SettingsRoles');

const CreateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).nullable().optional(),
});

export const GET: APIRoute = withAuth(FEATURES.SETTINGS_PERMISSIONS, async () => {
  const repo = getPermissionRepository();
  const roles = await repo.listRoles();
  const withFeatures = await Promise.all(
    roles.map(async (r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      features: await repo.listRoleFeatures(r.id),
    })),
  );
  return jsonResponse({
    roles: withFeatures,
    catalog: Object.values(FEATURES).map((f) => ({ id: f, label: FEATURE_LABELS[f] })),
  });
});

export const POST: APIRoute = withAuth(FEATURES.SETTINGS_PERMISSIONS, async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'VALIDATION', issues: parsed.error.issues }, 400);
  }
  try {
    const repo = getPermissionRepository();
    const role = await repo.createRole({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    });
    return jsonResponse({ role }, 201);
  } catch (error) {
    logger.error('Create role failed', { error });
    return jsonResponse({ error: 'Failed to create role' }, 500);
  }
});

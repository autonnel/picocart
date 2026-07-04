import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES, getPermissionRepository } from '@/lib/permissions';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:SettingsRoleDetail');

const UpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).nullable().optional(),
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
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'VALIDATION', issues: parsed.error.issues }, 400);
  }
  try {
    const repo = getPermissionRepository();
    const updated = await repo.updateRole(id, parsed.data);
    return jsonResponse({ role: updated });
  } catch (error) {
    logger.error('Update role failed', { error, roleId: id });
    return jsonResponse({ error: (error as Error).message || 'Failed to update role' }, 500);
  }
});

export const DELETE: APIRoute = withAuth(FEATURES.SETTINGS_PERMISSIONS, async ({ params }) => {
  const id = params.id;
  if (!id) return jsonResponse({ error: 'Missing id' }, 400);
  try {
    const repo = getPermissionRepository();
    await repo.deleteRole(id);
    return jsonResponse({ ok: true });
  } catch (error) {
    logger.error('Delete role failed', { error, roleId: id });
    return jsonResponse({ error: (error as Error).message || 'Failed to delete role' }, 500);
  }
});

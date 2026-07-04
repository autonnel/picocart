import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES, getPermissionRepository } from '@/lib/permissions';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:SettingsUserRole');

const Schema = z.object({
  roleIds: z.array(z.string()),
});

export const PUT: APIRoute = withAuth(FEATURES.SETTINGS_USERS, async ({ params, request }) => {
  const userId = params.id;
  if (!userId) return jsonResponse({ error: 'Missing id' }, 400);
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
    const repo = getPermissionRepository();
    await repo.setUserRoles(userId, parsed.data.roleIds);
    return jsonResponse({ ok: true });
  } catch (error) {
    logger.error('Update user roles failed', { error, userId });
    return jsonResponse({ error: 'Failed to update roles' }, 500);
  }
});

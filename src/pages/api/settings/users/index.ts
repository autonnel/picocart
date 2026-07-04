import type { APIRoute } from 'astro';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES, getPermissionRepository } from '@/lib/permissions';

export const GET: APIRoute = withAuth(FEATURES.SETTINGS_USERS, async () => {
  const repo = getPermissionRepository();
  const users = await repo.listAllUsersWithRoles();
  return jsonResponse({ users });
});

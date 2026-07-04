import type { APIRoute } from 'astro';
import { z } from 'zod';
import { withAuth, jsonResponse } from '@/lib/api-helpers';
import { FEATURES, getPermissionRepository } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Api:SettingsUsersInvite');

const Schema = z.object({
  email: z.string().email(),
  roleName: z.string().min(1),
  expiresInHours: z.number().int().min(1).max(720).optional(),
});

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const POST: APIRoute = withAuth(FEATURES.SETTINGS_USERS, async ({ request }, { user }) => {
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
  const repo = getPermissionRepository();
  const role = await repo.getRoleByName(parsed.data.roleName);
  if (!role) return jsonResponse({ error: 'Unknown role' }, 400);

  const tenantId = getCurrentTenantId();
  const token = generateToken();
  const hours = parsed.data.expiresInHours ?? 168;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  try {
    const invitation = await prisma.userInvitation.create({
      data: {
        tenantId,
        email: parsed.data.email,
        invitedById: user.id,
        token,
        role: role.name,
        expiresAt,
      },
    });
    return jsonResponse(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          token: invitation.token,
        },
      },
      201,
    );
  } catch (error) {
    logger.error('Create invitation failed', { error });
    return jsonResponse({ error: 'Failed to create invitation' }, 500);
  }
});

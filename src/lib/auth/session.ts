// Session lifecycle helpers (create / validate / delete) and the canonical
// cookie name. Kept separate from individual auth providers (built-in
// username/password and plugin-supplied) so multiple providers can share it.

import { prisma } from '@/lib/db';
import type { User, Session } from '@prisma/client';
import { getCurrentTenantId } from '@/lib/tenant/context';

export const SESSION_COOKIE_NAME = 'picocart_session';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(
  userId: string,
  tenantId: string = getCurrentTenantId(),
): Promise<Session> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  return prisma.session.create({
    data: { tenantId, userId, token, expiresAt },
  });
}

// Lookup is intentionally global (token is unique); tenant alignment is
// enforced by the caller comparing session.tenantId against the request tenant.
export async function validateSession(token: string): Promise<{
  session: Session;
  user: User;
} | null> {
  const session = await prisma.session.findUnique({ where: { token } });
  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;
  // Defense in depth: a session must belong to the same tenant as the user.
  if (user.tenantId !== session.tenantId) return null;
  return { session, user };
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

import type { APIRoute } from 'astro';
import { register, createSession, SESSION_COOKIE_NAME } from '@/lib/auth/username-password-provider';
import { jsonResponse, jsonError } from '@/lib/api-helpers';
import { createLogger } from '@/lib/logger';
import { getEnv } from '@/lib/runtime/env';
import { getCurrentTenantId } from '@/lib/tenant/context';

const logger = createLogger('Api:AuthRegister');

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { username?: string; password?: string; email?: string; invitationToken?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const username = (body.username ?? '').trim();
  const password = body.password ?? '';
  const email = body.email?.trim() || undefined;
  const invitationToken = body.invitationToken?.trim() || undefined;

  if (!username || !password) {
    return jsonError('Username and password required', 400);
  }
  if (password.length < 8) {
    return jsonError('Password must be at least 8 characters', 400);
  }

  try {
    const user = await register({ username, password, email, invitationToken });
    const tenantId = getCurrentTenantId();
    const session = await createSession(user.id, tenantId);

    cookies.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: getEnv('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      expires: session.expiresAt,
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    const message = (err as Error).message;
    logger.warn('Register failed', { username, error: message });
    return jsonError(message, 400);
  }
};

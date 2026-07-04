import type { APIRoute } from 'astro';
import { login, createSession, SESSION_COOKIE_NAME } from '@/lib/auth/username-password-provider';
import { jsonResponse, jsonError } from '@/lib/api-helpers';
import { createLogger } from '@/lib/logger';
import { getEnv } from '@/lib/runtime/env';
import { getCurrentTenantId } from '@/lib/tenant/context';

const logger = createLogger('Api:AuthLogin');

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const username = (body.username ?? '').trim();
  const password = body.password ?? '';
  if (!username || !password) {
    return jsonError('Username and password required', 400);
  }

  try {
    const user = await login({ username, password });
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
    logger.warn('Login failed', { username, error: (err as Error).message });
    return jsonError('Invalid credentials', 401);
  }
};

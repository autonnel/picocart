// Common API response helpers and an authenticated route wrapper.

import type { APIRoute, APIContext } from 'astro';
import { checkAuth, type AuthUser, type AuthResult } from '@/lib/auth/middleware';
import {
  userHasFeature,
  canAccessPermissionsPageAsync,
  FEATURES,
  type FeatureId,
} from '@/lib/permissions';
import { createLogger } from '@/lib/logger';

const logger = createLogger('APIHelpers');

// tenantId is internal scoping data and must never reach API clients.
export const omitTenantId = (key: string, value: unknown) =>
  key === 'tenantId' ? undefined : value;

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, omitTenantId), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface AuthContext {
  user: AuthUser;
  auth: AuthResult;
}

type AuthenticatedHandler = (
  context: APIContext,
  authCtx: AuthContext,
) => Response | Promise<Response>;

export function withAuth(feature: FeatureId, handler: AuthenticatedHandler): APIRoute {
  return async (context: APIContext) => {
    const auth = await checkAuth(context);
    if (!auth.authenticated || !auth.user) {
      return jsonError('Unauthorized', 401);
    }

    const hasAccess = await userHasFeature(auth.user.id, feature);
    if (!hasAccess) {
      if (
        feature !== FEATURES.SETTINGS_PERMISSIONS ||
        !(await canAccessPermissionsPageAsync(auth.user.id, auth.user.providerId))
      ) {
        return jsonError('Forbidden', 403);
      }
    }

    try {
      return await handler(context, { user: auth.user, auth });
    } catch (error) {
      logger.error('API handler error', { error });
      return jsonError('Internal server error', 500);
    }
  };
}

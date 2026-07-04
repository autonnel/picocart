// Auth middleware helpers used by Astro pages and API routes.

import type { AstroGlobal, APIContext } from 'astro';
import { validateSession, SESSION_COOKIE_NAME } from './session';
import {
  getUserRoles,
  getUserFeatures,
  deriveAccessibleNavIds,
  userHasFeature,
  canAccessPermissionsPageAsync,
  type FeatureId,
} from '@/lib/permissions';
import { getCurrentTenantId } from '@/lib/tenant/context';

export interface AuthUser {
  id: string;
  providerId: string;
  email: string;
  username: string;
  name: string | null;
  avatar: string | null;
}

export interface AuthResult {
  authenticated: boolean;
  user: AuthUser | null;
  roles: string[];
  features: string[];
  accessibleNavIds: string[];
}

type AstroContext = AstroGlobal | APIContext;

export async function checkAuth(context: AstroContext): Promise<AuthResult> {
  const sessionToken = context.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return { authenticated: false, user: null, roles: [], features: [], accessibleNavIds: [] };
  }
  const result = await validateSession(sessionToken);
  if (!result) {
    return { authenticated: false, user: null, roles: [], features: [], accessibleNavIds: [] };
  }
  if (result.session.tenantId !== getCurrentTenantId()) {
    return { authenticated: false, user: null, roles: [], features: [], accessibleNavIds: [] };
  }

  const user: AuthUser = {
    id: result.user.id,
    providerId: result.user.providerId ?? '',
    email: result.user.email ?? '',
    username: result.user.username ?? '',
    name: result.user.name,
    avatar: result.user.avatar,
  };

  const [roles, features] = await Promise.all([
    getUserRoles(user.id),
    getUserFeatures(user.id),
  ]);

  const accessibleNavIds = deriveAccessibleNavIds(features, user.id, user.providerId);

  return {
    authenticated: true,
    user,
    roles,
    features,
    accessibleNavIds,
  };
}

export async function requireAuth(context: AstroGlobal): Promise<AuthUser | Response> {
  const { authenticated, user } = await checkAuth(context);
  if (!authenticated || !user) {
    return context.redirect('/login');
  }
  return user;
}

export async function checkFeatureAccess(
  context: AstroContext,
  feature: FeatureId
): Promise<boolean> {
  const { authenticated, user } = await checkAuth(context);
  if (!authenticated || !user) return false;
  return userHasFeature(user.id, feature);
}

export async function checkPermissionsAccess(
  context: AstroContext
): Promise<boolean> {
  const { authenticated, user } = await checkAuth(context);
  if (!authenticated || !user) return false;
  return canAccessPermissionsPageAsync(user.id, user.providerId);
}
